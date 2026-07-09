"""
MCP-style orchestration layer.

This implements the *pattern* of an MCP (Model Context Protocol) tool-calling
agent loop: a planner decides which tool to call next based on prior tool
outputs, every call is logged as a reasoning-trace step, and the final answer
must cite the specific ticket/doc/fix ids it used (hallucination guard).

Note on the real MCP SDK: for the hackathon demo this ships as a lightweight,
dependency-free orchestrator so the whole project runs offline out of the box.
To swap in the official `mcp` Python SDK and expose these same 4 tools over a
real MCP server (stdio/SSE transport) for use from Claude Desktop or another
MCP client, see mcp_stdio_server.py — the tool functions in tools.py are
already MCP-shaped (name, description, schema, callable) and can be registered
with `@server.call_tool()` directly.
"""
import time

from . import tools
from .gemini_client import synthesize_with_gemini, synthesize_rule_based


def run_rca_pipeline(symptom_query: str, use_llm: bool = True):
    """
    Runs the 4-tool MCP agent loop against a natural-language failure
    description (e.g. pasted from a field ticket) and returns a structured
    reasoning trace + final cited RCA report.
    """
    trace = []
    t0 = time.time()

    # Step 1 — Ticket Search: find similar historical failures
    step_start = time.time()
    ticket_result = tools.tool_ticket_search(symptom_query, top_k=5)
    trace.append({
        "step": 1,
        "tool": "ticket_search",
        "thought": f"Searching {len(tools.TICKETS)} historical tickets for symptoms matching: \"{symptom_query[:80]}\"",
        "input": {"query": symptom_query, "top_k": 5},
        "output": ticket_result,
        "latency_ms": round((time.time() - step_start) * 1000, 1),
    })

    # Infer the most likely failure mode from top matching tickets
    top_matches = ticket_result["results"]
    if top_matches:
        mode_votes = {}
        for m in top_matches:
            mode_votes[m["failure_mode"]] = mode_votes.get(m["failure_mode"], 0) + m["similarity"]
        inferred_mode = max(mode_votes, key=mode_votes.get)
        confidence = round(mode_votes[inferred_mode] / sum(mode_votes.values()), 3) if mode_votes else 0.0
    else:
        inferred_mode = "OVERTEMP"
        confidence = 0.0

    # Step 2 — BOM Lookup
    step_start = time.time()
    bom_result = tools.tool_bom_lookup(inferred_mode)
    trace.append({
        "step": 2,
        "tool": "bom_lookup",
        "thought": f"Top matching tickets point to failure mode '{inferred_mode}' "
                    f"(confidence {confidence}). Cross-referencing BOM specs for the linked component.",
        "input": {"failure_mode": inferred_mode},
        "output": bom_result,
        "latency_ms": round((time.time() - step_start) * 1000, 1),
    })

    # Step 3 — Design Doc Semantic Search
    step_start = time.time()
    design_query = f"{inferred_mode} {symptom_query}"
    design_result = tools.tool_design_doc_search(design_query, top_k=3)
    trace.append({
        "step": 3,
        "tool": "design_doc_search",
        "thought": "Running semantic search over engineering design guideline docs "
                    "to trace this field symptom to a design-level root cause.",
        "input": {"query": design_query, "top_k": 3},
        "output": design_result,
        "latency_ms": round((time.time() - step_start) * 1000, 1),
    })

    # Step 4 — Prior Fix Retrieval
    step_start = time.time()
    fix_result = tools.tool_past_fix_retrieval(inferred_mode, top_k=3)
    trace.append({
        "step": 4,
        "tool": "past_fix_retrieval",
        "thought": f"Retrieving validated past fixes for failure mode '{inferred_mode}', "
                    "ranked by field-proven effectiveness.",
        "input": {"failure_mode": inferred_mode},
        "output": fix_result,
        "latency_ms": round((time.time() - step_start) * 1000, 1),
    })

    # Step 5 — Synthesis (Gemini if available, otherwise grounded rule-based template)
    step_start = time.time()
    context = {
        "symptom_query": symptom_query,
        "inferred_mode": inferred_mode,
        "mode_confidence": confidence,
        "tickets": top_matches,
        "bom": bom_result["results"],
        "design_docs": design_result["results"],
        "fixes": fix_result["results"],
    }

    llm_used = False
    if use_llm:
        synthesis, llm_used = synthesize_with_gemini(context)
    else:
        synthesis = synthesize_rule_based(context)

    if not synthesis:
        synthesis = synthesize_rule_based(context)

    trace.append({
        "step": 5,
        "tool": "synthesis" + (" (gemini)" if llm_used else " (rule-based)"),
        "thought": "Synthesizing final root-cause report grounded ONLY in the evidence "
                    "retrieved from the 4 tools above. Every claim must cite a ticket, "
                    "BOM spec, design doc, or fix id.",
        "input": {"context_summary": f"{len(top_matches)} tickets, {len(bom_result['results'])} BOM specs, "
                                      f"{len(design_result['results'])} design docs, {len(fix_result['results'])} fixes"},
        "output": {"synthesis": synthesis, "llm_used": llm_used},
        "latency_ms": round((time.time() - step_start) * 1000, 1),
    })

    total_latency_ms = round((time.time() - t0) * 1000, 1)

    citations = []
    citations += [t["ticket_id"] for t in top_matches[:3]]
    citations += [b["component_id"] for b in bom_result["results"]]
    citations += [d["doc_id"] for d in design_result["results"]]
    citations += [f["fix_id"] for f in fix_result["results"]]

    return {
        "trace": trace,
        "inferred_failure_mode": inferred_mode,
        "mode_confidence": confidence,
        "synthesis": synthesis,
        "llm_used": llm_used,
        "citations": citations,
        "total_latency_ms": total_latency_ms,
    }
