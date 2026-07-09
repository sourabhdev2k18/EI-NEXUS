"""
ARIA — Autonomous RCA Intelligence Assistant.

A conversational Q&A layer on top of everything the system already knows:
fleet telemetry, the autonomous agent's narrated log, resolved incidents,
and the same 4-tool MCP retrieval used by the main RCA pipeline.

Design goal: purely additive. This module reads from existing state
(twin, autonomous.agent, tools) and never mutates it — it cannot break any
existing functionality because it has no write path into the twin, the
agent, or the data files.

Two synthesis paths, same pattern as gemini_client.py:
  - Gemini (optional): a natural conversational answer, still grounded only
    in the context assembled below.
  - Rule-based (always available): intent-classified templated answers so
    ARIA is never just "the AI is offline, sorry" — it always has something
    useful to say from the same structured data.
"""
import re
import time

from . import twin as twin_module
from . import autonomous
from . import anomaly
from .tools import FAILURE_MODES, tool_ticket_search, tool_design_doc_search
# from .gemini_client import GEMINI_API_KEY

# try:
#     import requests
# except ImportError:
#     requests = None

# from .gemini_client import GEMINI_URL

from .groq_client import ask_llm

BOT_NAME = "ARIA"

# Rolling chat history — in-memory only, mirrors the pattern used by _rca_log in app.py
_chat_history = []
MAX_HISTORY = 100


def _log_message(role, text, used_llm=None):
    entry = {"role": role, "text": text, "ts": time.time()}
    if used_llm is not None:
        entry["used_llm"] = used_llm
    _chat_history.append(entry)
    if len(_chat_history) > MAX_HISTORY:
        _chat_history.pop(0)
    return entry


def get_history():
    return list(_chat_history)


def clear_history():
    _chat_history.clear()


# ---------------------------------------------------------------------------
# Context gathering — read-only, touches no shared mutable state
# ---------------------------------------------------------------------------
def _gather_context(query: str):
    fleet_snapshot = twin_module.fleet.fleet_snapshot()
    agent_status = autonomous.agent.status()

    # try to spot an asset id mentioned in the question, e.g. "MC-2201-007"
    asset_match = re.search(r"MC-2201-\d{3}", query.upper())
    mentioned_asset = asset_match.group(0) if asset_match else None

    findings_by_asset = {}
    for snap in fleet_snapshot:
        findings = anomaly.detect(snap)
        findings_by_asset[snap["asset_id"]] = findings

    return {
        "fleet_snapshot": fleet_snapshot,
        "agent_status": agent_status,
        "mentioned_asset": mentioned_asset,
        "findings_by_asset": findings_by_asset,
    }


# ---------------------------------------------------------------------------
# Rule-based intent classification + templated answers (always available)
# ---------------------------------------------------------------------------
def _rule_based_answer(query: str, ctx: dict) -> str:
    q = query.lower()
    resolved = ctx["agent_status"]["resolved_incidents"]
    log = ctx["agent_status"]["log"]
    mentioned = ctx["mentioned_asset"]

    def fmt_incident(inc):
        return f"{inc['asset_id']} — {inc['failure_mode']}, resolved in {inc['elapsed_seconds']}s"

    # Intent: asked about a specific asset
    if mentioned:
        findings = ctx["findings_by_asset"].get(mentioned, [])
        snap = next((s for s in ctx["fleet_snapshot"] if s["asset_id"] == mentioned), None)
        if not snap:
            return f"I don't have an asset called {mentioned} in this fleet. The 4 assets I track are MC-2201-001, MC-2201-007, MC-2201-013, and MC-2201-019."
        incs = [i for i in resolved if i["asset_id"] == mentioned]
        lines = [f"**{mentioned}** ({snap['site']}) is currently **{snap['status']}**."]
        if findings:
            top = findings[0]
            lines.append(f"Active concern: {top['signal']} = {top['value']} ({top['severity']}, {int(top['combined_confidence']*100)}% confidence, likely {top['failure_mode']}).")
        if incs:
            lines.append(f"Resolved incidents this session: " + "; ".join(fmt_incident(i) for i in incs) + ".")
        else:
            lines.append("No incidents resolved on this asset yet this session.")
        return " ".join(lines)

    # Intent: "how many" / "count" (checked before the general incident/history
    # branch below, since "how many incidents" would otherwise match on the
    # word "incident" first and never reach this more specific branch)
    if any(k in q for k in ["how many", "count", "total"]):
        counts = ctx["agent_status"]["resolved_counts"]
        if not counts:
            return "No incidents resolved yet this session, so there's nothing to count."
        parts = [f"{mode}: {n}" for mode, n in counts.items()]
        return f"Resolved incident counts by failure mode this session — " + ", ".join(parts) + "."

    # Intent: "what happened" / "incidents" / "failures" / "history"
    if any(k in q for k in ["what happened", "incident", "failure", "history", "log"]):
        if not resolved:
            return "No incidents have been resolved yet this session. Engage Autonomous Mode or manually inject a fault to generate some history I can report on."
        recent = resolved[-5:]
        lines = "; ".join(fmt_incident(i) for i in recent)
        return f"In this session, {len(resolved)} incident(s) have been resolved. Most recent: {lines}."

    # Intent: "why" / "root cause" / "diagnose"
    if any(k in q for k in ["why", "root cause", "diagnos", "cause"]):
        diag_entries = [e for e in log if e["stage"] == "DIAGNOSING" and (e.get("detail") or {}).get("synthesis")]
        if diag_entries:
            last = diag_entries[-1]
            return f"Most recent diagnosis: {last['detail']['synthesis'][:400]}"
        return "I haven't run a diagnosis yet this session. Ask me to look into a specific asset, or click 'Run 4-Tool MCP Agent' to trigger one."

    # Intent: threshold / optimization
    if any(k in q for k in ["threshold", "optimi", "learn", "smarter"]):
        opt_entries = [e for e in log if e["stage"] == "OPTIMIZING"]
        if opt_entries:
            return opt_entries[-1]["message"]
        return "No detection thresholds have been tightened yet this session — that happens automatically after the same failure mode recurs a second time."

    # Intent: fleet-wide status
    if any(k in q for k in ["status", "fleet", "overview", "how are", "all assets"]):
        parts = [f"{s['asset_id']}: {s['status']}" for s in ctx["fleet_snapshot"]]
        return "Fleet status — " + ", ".join(parts) + "."

    # Intent: greeting / help
    if any(k in q for k in ["hello", "hi", "help", "what can you"]):
        return (f"I'm {BOT_NAME}. Ask me things like: \"what happened?\", \"why did MC-2201-001 fail?\", "
                f"\"how many incidents this session?\", \"has it optimized any thresholds?\", or \"fleet status?\".")

    # Default fallback — always show something useful rather than "I don't understand"
    parts = [f"{s['asset_id']}: {s['status']}" for s in ctx["fleet_snapshot"]]
    return (f"I'm not sure exactly what you're asking, but here's the current picture — " +
            ", ".join(parts) + f". Try asking \"what happened\", \"why\", or name an asset directly.")


def _build_gemini_prompt(query: str, ctx: dict) -> str:
    resolved = ctx["agent_status"]["resolved_incidents"]
    log_tail = ctx["agent_status"]["log"][-12:]
    fleet_lines = "\n".join(f"- {s['asset_id']} ({s['site']}): {s['status']}" for s in ctx["fleet_snapshot"])
    log_lines = "\n".join(f"- [{e['stage']}] {e['message']}" for e in log_tail)
    incident_lines = "\n".join(f"- {i['asset_id']}: {i['failure_mode']}, resolved in {i['elapsed_seconds']}s" for i in resolved) or "none yet"

    return f"""You are {BOT_NAME}, a concise engineering assistant embedded in an industrial digital-twin
dashboard called EI-Nexus. Answer the user's question using ONLY the grounded context below.
Never invent an asset ID, incident, or number that isn't listed. If the context doesn't cover
the question, say so plainly and suggest what the user could do (e.g. inject a fault, engage
autonomous mode, run the RCA agent).

CURRENT FLEET STATUS:
{fleet_lines}

RESOLVED INCIDENTS THIS SESSION:
{incident_lines}

RECENT AUTONOMOUS AGENT LOG (most recent last):
{log_lines}

USER QUESTION: {query}

Answer in 2-4 sentences, conversational but precise. Use markdown bold for asset IDs and key numbers."""


# def _synthesize_with_gemini_chat(query: str, ctx: dict):
#     if not GEMINI_API_KEY or requests is None:
#         return None, False
#     prompt = _build_gemini_prompt(query, ctx)
#     payload = {
#         "contents": [{"parts": [{"text": prompt}]}],
#         "generationConfig": {"temperature": 0.3, "maxOutputTokens": 300},
#     }
#     try:
#         resp = requests.post(f"{GEMINI_URL}?key={GEMINI_API_KEY}", json=payload, timeout=10)
#         if not resp.ok:
#             return None, False
#         data = resp.json()
#         text = data["candidates"][0]["content"]["parts"][0]["text"]
#         return text.strip(), True
#     except Exception as e:  # noqa: BLE001 — chat must never crash on network issues
#         print(f"[aria] Falling back to rule-based answer: {e}")
#         return None, False


def _synthesize_with_gemini_chat(query: str, ctx: dict):
    """
    Uses Groq instead of Gemini.
    Keeps the same function name so the rest of the app doesn't change.
    """

    prompt = _build_gemini_prompt(query, ctx)

    try:
        answer = ask_llm(
            prompt,
            system_prompt=(
                f"You are {BOT_NAME}, a concise engineering assistant embedded "
                "in the EI-Nexus digital twin platform. "
                "Answer ONLY from the supplied context. "
                "Never invent asset IDs, incidents or numbers."
            ),
            temperature=0.3,
        )

        return answer.strip(), True

    except Exception as e:
        print(f"[ARIA] Groq failed: {e}")
        return None, False


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def ask(query: str, use_llm: bool = True):
    query = (query or "").strip()
    if not query:
        return {"reply": f"Ask me anything about the fleet — try \"what happened?\" or \"why did an asset fail?\"", "used_llm": False}

    _log_message("user", query)
    ctx = _gather_context(query)

    reply = None
    used_llm = False
    if use_llm:
        reply, used_llm = _synthesize_with_gemini_chat(query, ctx)
    if not reply:
        reply = _rule_based_answer(query, ctx)
        used_llm = False

    _log_message("assistant", reply, used_llm=used_llm)
    return {"reply": reply, "used_llm": used_llm, "bot_name": BOT_NAME}
