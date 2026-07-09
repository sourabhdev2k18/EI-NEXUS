"""
EI-Nexus RCA — Flask API server.

Serves the dashboard frontend and exposes the REST API for:
  - live digital twin telemetry
  - fault injection / auto-fix
  - the 4-tool MCP root-cause-analysis agent pipeline (+ optional Gemini synthesis)
  - evaluation metrics (precision/recall@k vs baseline, latency percentiles)

Run: python3 run.py   (from the project root)
"""
import os
import time

from flask import Flask, jsonify, request, send_from_directory

from . import twin as twin_module
from . import mcp_server
from . import metrics
from . import anomaly
from . import autonomous
from . import gemini_client
from . import chatbot
from .tools import TOOL_REGISTRY, TICKETS, BOM_SPECS, DESIGN_DOCS, PAST_FIXES

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# Simple before/after log so the dashboard can render the "quantified improvement" chart
_rca_log = []


@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------------------------------------------------------------------
# Digital Twin endpoints (asset_id defaults to the first fleet asset)
# ---------------------------------------------------------------------------
def _resolve_asset(asset_id=None):
    asset_id = asset_id or twin_module.fleet.default_asset_id()
    return twin_module.fleet.get(asset_id) or twin_module.twin


@app.route("/api/fleet")
def api_fleet():
    """Overview of every asset in the fleet — status + headline anomaly, for the
    Fleet grid (GOH-UC-065 Agentic Asset Management)."""
    out = []
    for snap in twin_module.fleet.fleet_snapshot():
        findings = anomaly.detect(snap)
        out.append({
            "asset_id": snap["asset_id"],
            "site": snap["site"],
            "asset_type": snap["asset_type"],
            "status": snap["status"],
            "active_fault": snap["active_fault"],
            "top_anomaly": findings[0] if findings else None,
            "state": snap["state"],
        })
    return jsonify(out)


@app.route("/api/telemetry")
def api_telemetry():
    asset_id = request.args.get("asset_id")
    t = _resolve_asset(asset_id)
    snap = t.snapshot()
    findings = anomaly.detect(snap)
    return jsonify({**snap, "anomalies": findings})


@app.route("/api/inject_fault", methods=["POST"])
def api_inject_fault():
    body = request.get_json(force=True, silent=True) or {}
    mode = body.get("failure_mode", "OVERTEMP")
    t = _resolve_asset(body.get("asset_id"))
    ok = t.inject_fault(mode)
    return jsonify({"ok": ok, "failure_mode": mode, "asset_id": t.asset_id})


@app.route("/api/apply_fix", methods=["POST"])
def api_apply_fix():
    body = request.get_json(force=True, silent=True) or {}
    t = _resolve_asset(body.get("asset_id"))
    ok = t.apply_fix()
    return jsonify({"ok": ok, "asset_id": t.asset_id})


@app.route("/api/reset", methods=["POST"])
def api_reset():
    for t in twin_module.fleet.assets.values():
        t.reset()
    autonomous.agent.stop()
    autonomous.agent.clear_log()
    autonomous.agent.resolved_counts = {}
    chatbot.clear_history()
    # restore original anomaly thresholds (autonomous mode may have tightened them)
    import importlib
    importlib.reload(anomaly)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# MCP Root Cause Agent
# ---------------------------------------------------------------------------
@app.route("/api/analyze_rca", methods=["POST"])
def api_analyze_rca():
    body = request.get_json(force=True, silent=True) or {}
    query = body.get("query", "").strip()
    use_llm = body.get("use_llm", True)

    if not query:
        # auto-build a query from the live twin's active fault + anomaly signal
        t = _resolve_asset(body.get("asset_id"))
        snap = t.snapshot()
        findings = anomaly.detect(snap)
        if findings:
            top = findings[0]
            mode = top["failure_mode"]
            from .tools import FAILURE_MODES
            symptoms = FAILURE_MODES.get(mode, {}).get("symptoms", [])
            query = symptoms[0] if symptoms else f"{mode} anomaly detected, value {top['value']}"
        else:
            query = "controller running hot and shut itself down"

    t0 = time.time()
    result = mcp_server.run_rca_pipeline(query, use_llm=use_llm)
    elapsed_ms = round((time.time() - t0) * 1000, 1)
    metrics.record_rca_latency(elapsed_ms)

    log_entry = {
        "query": query,
        "inferred_failure_mode": result["inferred_failure_mode"],
        "latency_ms": elapsed_ms,
        "timestamp": time.time(),
    }
    _rca_log.append(log_entry)
    if len(_rca_log) > 50:
        _rca_log.pop(0)

    result["query"] = query
    result["wall_clock_ms"] = elapsed_ms
    return jsonify(result)


@app.route("/api/rca_log")
def api_rca_log():
    return jsonify(_rca_log)


# ---------------------------------------------------------------------------
# Autonomous Engineering Intelligence Twin (AEIT) — closed-loop agent
# ---------------------------------------------------------------------------
@app.route("/api/autonomous/start", methods=["POST"])
def api_autonomous_start():
    body = request.get_json(force=True, silent=True) or {}
    auto_inject = bool(body.get("auto_inject", True))
    autonomous.agent.start(auto_inject=auto_inject)
    return jsonify({"ok": True})


@app.route("/api/autonomous/stop", methods=["POST"])
def api_autonomous_stop():
    autonomous.agent.stop()
    return jsonify({"ok": True})


@app.route("/api/autonomous/status")
def api_autonomous_status():
    return jsonify(autonomous.agent.status())


@app.route("/api/autonomous/clear_log", methods=["POST"])
def api_autonomous_clear_log():
    autonomous.agent.clear_log()
    return jsonify({"ok": True})


@app.route("/api/roi")
def api_roi():
    status = autonomous.agent.status()
    return jsonify(metrics.compute_roi(status["resolved_incidents"]))


# ---------------------------------------------------------------------------
# Metrics / Evaluation
# ---------------------------------------------------------------------------
@app.route("/api/metrics")
def api_metrics():
    retrieval_eval = metrics.run_retrieval_eval(top_k=3)
    rca_latency = metrics.rca_latency_summary()
    return jsonify({
        "retrieval_eval": retrieval_eval,
        "rca_pipeline_latency_ms": rca_latency,
        "dataset_size": {
            "tickets": len(TICKETS),
            "bom_specs": len(BOM_SPECS),
            "design_docs": len(DESIGN_DOCS),
            "past_fixes": len(PAST_FIXES),
        },
        "anomaly_detection_note": (
            "Hybrid rule-based threshold + rolling z-score statistical detector "
            "(offline, zero external dependency). See backend/anomaly.py."
        ),
    })


@app.route("/api/tools")
def api_tools():
    return jsonify({
        name: {"description": t["description"], "schema": t["schema"]}
        for name, t in TOOL_REGISTRY.items()
    })


@app.route("/api/gemini_status")
def api_gemini_status():
    key_present = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    diagnostics = gemini_client.get_diagnostics()
    return jsonify({"gemini_configured": key_present, **diagnostics})


# ---------------------------------------------------------------------------
# ARIA — Autonomous RCA Intelligence Assistant (chatbot)
# Purely additive: reads existing state, never mutates twin/agent/data.
# ---------------------------------------------------------------------------
@app.route("/api/chat", methods=["POST"])
def api_chat():
    body = request.get_json(force=True, silent=True) or {}
    message = body.get("message", "")
    use_llm = body.get("use_llm", True)
    result = chatbot.ask(message, use_llm=use_llm)
    return jsonify(result)


@app.route("/api/chat/history")
def api_chat_history():
    return jsonify(chatbot.get_history())


@app.route("/api/chat/clear", methods=["POST"])
def api_chat_clear():
    chatbot.clear_history()
    return jsonify({"ok": True})


def create_app():
    twin_module.start_background_thread()
    return app


if __name__ == "__main__":
    twin_module.start_background_thread()
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
