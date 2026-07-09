"""
The 4 MCP tools, each a self-contained callable with a JSON schema — this is the
"wow moment" of the demo: an agent reasoning step-by-step across 4 real tools with
cited evidence, not a black-box LLM answer.

Each tool returns structured, cited results. No tool ever fabricates an id that
isn't in the underlying dataset — this is the hallucination guard the battle plan
calls out as a judge-confidence multiplier.

Data source: SQLite (backend/db.py), not raw JSON in memory. The public names
below (TICKETS, BOM_SPECS, DESIGN_DOCS, PAST_FIXES) and every tool function's
signature are unchanged from the JSON-backed version — this was a swap of the
storage layer underneath, not a rewrite of the interface, so nothing else in
the codebase (mcp_server.py, autonomous.py, app.py) needed to change.
"""
import json
import os

from .rag import TfidfIndex
from . import db as db_module

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load(name):
    with open(os.path.join(DATA_DIR, name)) as f:
        return json.load(f)


# Ensure the database exists and is seeded before anything queries it —
# idempotent, safe on every process start.
db_module.init_db()

TICKETS = db_module.fetch_all_tickets()
BOM_SPECS = db_module.fetch_all_bom()
DESIGN_DOCS = db_module.fetch_all_design_docs()
PAST_FIXES = db_module.fetch_all_past_fixes()
FAILURE_MODES = _load("failure_modes.json")  # taxonomy/config, not corpus data — stays as JSON

ticket_index = TfidfIndex(TICKETS, "ticket_id", ["symptom_description", "failure_mode", "component_flagged"])
design_doc_index = TfidfIndex(DESIGN_DOCS, "doc_id", ["title", "content"])
fix_index = TfidfIndex(PAST_FIXES, "fix_id", ["fix_description", "failure_mode_link"])


# ---------------------------------------------------------------------------
# MCP Tool 1 — Service Ticket Search (RAG over historical tickets)
# ---------------------------------------------------------------------------
def tool_ticket_search(query: str, top_k: int = 5):
    results = ticket_index.search(query, top_k=top_k)
    return {
        "tool": "ticket_search",
        "query": query,
        "results": [
            {
                "ticket_id": r["document"]["ticket_id"],
                "similarity": r["score"],
                "asset_id": r["document"]["asset_id"],
                "site": r["document"]["site"],
                "failure_mode": r["document"]["failure_mode"],
                "severity": r["document"]["severity"],
                "symptom": r["document"]["symptom_description"],
                "downtime_hours": r["document"]["downtime_hours"],
            }
            for r in results
        ],
    }


# ---------------------------------------------------------------------------
# MCP Tool 2 — BOM Spec Lookup (real SQL query, not a Python list filter)
# ---------------------------------------------------------------------------
def tool_bom_lookup(failure_mode: str):
    matches = db_module.fetch_bom_by_mode(failure_mode)
    return {
        "tool": "bom_lookup",
        "failure_mode": failure_mode,
        "results": matches,
    }


# ---------------------------------------------------------------------------
# MCP Tool 3 — Design Doc Semantic Search (RAG over engineering docs)
# ---------------------------------------------------------------------------
def tool_design_doc_search(query: str, top_k: int = 3):
    results = design_doc_index.search(query, top_k=top_k, min_score=0.0)
    return {
        "tool": "design_doc_search",
        "query": query,
        "results": [
            {
                "doc_id": r["document"]["doc_id"],
                "similarity": r["score"],
                "title": r["document"]["title"],
                "content": r["document"]["content"],
                "revision": r["document"]["revision"],
            }
            for r in results
        ],
    }


# ---------------------------------------------------------------------------
# MCP Tool 4 — Prior-Fix Retrieval (real SQL query, ORDER BY + LIMIT)
# ---------------------------------------------------------------------------
def tool_past_fix_retrieval(failure_mode: str, top_k: int = 3):
    matches = db_module.fetch_fixes_by_mode(failure_mode, top_k=top_k)
    return {
        "tool": "past_fix_retrieval",
        "failure_mode": failure_mode,
        "results": matches,
    }


TOOL_REGISTRY = {
    "ticket_search": {
        "fn": tool_ticket_search,
        "description": "Search historical field-failure service tickets by symptom text (RAG/TF-IDF).",
        "schema": {"query": "string", "top_k": "int (optional)"},
    },
    "bom_lookup": {
        "fn": tool_bom_lookup,
        "description": "Cross-reference bill-of-materials specs against a failure mode.",
        "schema": {"failure_mode": "string enum[OVERTEMP,VIBRATION,VOLTAGE,CURRENT]"},
    },
    "design_doc_search": {
        "fn": tool_design_doc_search,
        "description": "Semantic search over engineering design guideline documents (RAG).",
        "schema": {"query": "string", "top_k": "int (optional)"},
    },
    "past_fix_retrieval": {
        "fn": tool_past_fix_retrieval,
        "description": "Retrieve validated past fixes for a given failure mode, ranked by effectiveness.",
        "schema": {"failure_mode": "string enum[OVERTEMP,VIBRATION,VOLTAGE,CURRENT]"},
    },
}
