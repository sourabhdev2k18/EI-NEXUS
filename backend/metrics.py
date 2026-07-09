"""
Evaluation harness — computes retrieval quality (precision / recall@k) against
a held-out labeled query set, compares the RAG retriever to a naive keyword-
search baseline, and tracks system latency percentiles across recent RCA runs.

This directly answers the battle plan's "Eval Checklist Before Demo": baseline
established, held-out test set, metrics defended with real numbers.
"""
import time
import statistics

from . import tools

# Held-out labeled eval set: (query, expected_failure_mode)
# Distinct from the synthetic tickets used to seed the index — built from the
# symptom phrasing bank so it exercises the retriever on paraphrased language.
EVAL_QUERIES = [
    ("controller is running very hot and shut itself down", "OVERTEMP"),
    ("thermal alarm keeps tripping under heavy load", "OVERTEMP"),
    ("unit overheating, fan can't keep up", "OVERTEMP"),
    ("shaking and rattling noise from the bearing area", "VIBRATION"),
    ("strong vibration on startup, coupling might be loose", "VIBRATION"),
    ("resonance getting worse week over week", "VIBRATION"),
    ("power keeps dipping and the controller resets", "VOLTAGE"),
    ("brownout during motor start, bus voltage sagging", "VOLTAGE"),
    ("grid fluctuation causing lockouts", "VOLTAGE"),
    ("phases are drawing uneven current", "CURRENT"),
    ("overcurrent trip when ramping load up", "CURRENT"),
    ("winding current has been climbing for weeks", "CURRENT"),
]


def _naive_keyword_baseline(query: str, top_k: int = 3):
    """Simple substring/keyword overlap baseline — no TF-IDF weighting."""
    q_words = set(query.lower().split())
    scored = []
    for t in tools.TICKETS:
        text_words = set((t["symptom_description"] + " " + t["failure_mode"]).lower().split())
        overlap = len(q_words & text_words)
        if overlap > 0:
            scored.append((overlap, t))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [t for _, t in scored[:top_k]]


def run_retrieval_eval(top_k: int = 3):
    rag_hits = 0
    baseline_hits = 0
    rag_recall_hits = 0
    baseline_recall_hits = 0
    latencies = []

    for query, expected_mode in EVAL_QUERIES:
        start = time.time()
        rag_results = tools.tool_ticket_search(query, top_k=top_k)["results"]
        latencies.append((time.time() - start) * 1000)

        rag_modes = [r["failure_mode"] for r in rag_results]
        if rag_modes and rag_modes[0] == expected_mode:
            rag_hits += 1
        if expected_mode in rag_modes:
            rag_recall_hits += 1

        baseline_results = _naive_keyword_baseline(query, top_k=top_k)
        baseline_modes = [t["failure_mode"] for t in baseline_results]
        if baseline_modes and baseline_modes[0] == expected_mode:
            baseline_hits += 1
        if expected_mode in baseline_modes:
            baseline_recall_hits += 1

    n = len(EVAL_QUERIES)
    latencies.sort()

    def pctl(p):
        if not latencies:
            return 0.0
        idx = min(len(latencies) - 1, int(len(latencies) * p))
        return round(latencies[idx], 2)

    return {
        "n_eval_queries": n,
        "rag": {
            "precision_at_1": round(rag_hits / n, 3),
            "recall_at_k": round(rag_recall_hits / n, 3),
        },
        "baseline_keyword": {
            "precision_at_1": round(baseline_hits / n, 3),
            "recall_at_k": round(baseline_recall_hits / n, 3),
        },
        "improvement_over_baseline_pct": round(
            ((rag_hits - baseline_hits) / max(baseline_hits, 1)) * 100, 1
        ) if baseline_hits else "N/A (baseline scored 0)",
        "latency_ms": {
            "p50": pctl(0.50),
            "p95": pctl(0.95),
            "p99": pctl(0.99),
        },
        "top_k": top_k,
    }


# ---------------------------------------------------------------------------
# ROI / Business Impact calculator — turns the session's actual resolved
# incidents into a dollar figure, instead of a slide claim. Assumptions are
# stated explicitly (and are adjustable) so it's defensible under questioning.
# ---------------------------------------------------------------------------
ROI_ASSUMPTIONS = {
    "traditional_rca_hours": 14 * 24,       # "2-3 weeks" -> using 14 days as a conservative midpoint
    "downtime_cost_per_hour_usd": 2400,     # mid-size industrial line, unplanned downtime — adjustable
    "engineer_loaded_cost_per_hour_usd": 85,
    "avg_engineer_hours_per_manual_rca": 12,
}


def compute_roi(resolved_incidents: list):
    """
    resolved_incidents: list of {failure_mode, elapsed_seconds} from the
    autonomous agent's session log — i.e. this is computed from what actually
    happened in the demo, not a hardcoded number.
    """
    n = len(resolved_incidents)
    if n == 0:
        return {
            "incidents_resolved": 0,
            "downtime_hours_avoided": 0,
            "downtime_cost_avoided_usd": 0,
            "engineer_hours_saved": 0,
            "engineer_cost_saved_usd": 0,
            "total_savings_usd": 0,
            "avg_resolution_seconds": 0,
            "assumptions": ROI_ASSUMPTIONS,
        }

    total_elapsed_seconds = sum(i.get("elapsed_seconds", 0) for i in resolved_incidents)
    avg_elapsed = total_elapsed_seconds / n

    traditional_hours_total = n * ROI_ASSUMPTIONS["traditional_rca_hours"]
    actual_hours_total = total_elapsed_seconds / 3600.0
    downtime_hours_avoided = round(traditional_hours_total - actual_hours_total, 1)
    downtime_cost_avoided = round(downtime_hours_avoided * ROI_ASSUMPTIONS["downtime_cost_per_hour_usd"], 0)

    engineer_hours_saved = round(n * ROI_ASSUMPTIONS["avg_engineer_hours_per_manual_rca"], 1)
    engineer_cost_saved = round(engineer_hours_saved * ROI_ASSUMPTIONS["engineer_loaded_cost_per_hour_usd"], 0)

    return {
        "incidents_resolved": n,
        "downtime_hours_avoided": downtime_hours_avoided,
        "downtime_cost_avoided_usd": downtime_cost_avoided,
        "engineer_hours_saved": engineer_hours_saved,
        "engineer_cost_saved_usd": engineer_cost_saved,
        "total_savings_usd": round(downtime_cost_avoided + engineer_cost_saved, 0),
        "avg_resolution_seconds": round(avg_elapsed, 1),
        "assumptions": ROI_ASSUMPTIONS,
    }


# Rolling latency tracker for live RCA pipeline runs (populated by app.py)
_rca_latencies = []


def record_rca_latency(ms: float):
    _rca_latencies.append(ms)
    if len(_rca_latencies) > 200:
        _rca_latencies.pop(0)


def rca_latency_summary():
    if not _rca_latencies:
        return {"p50": None, "p95": None, "p99": None, "count": 0}
    ordered = sorted(_rca_latencies)

    def pctl(p):
        idx = min(len(ordered) - 1, int(len(ordered) * p))
        return round(ordered[idx], 1)

    return {
        "p50": pctl(0.50),
        "p95": pctl(0.95),
        "p99": pctl(0.99),
        "count": len(ordered),
        "mean": round(statistics.mean(ordered), 1),
    }
