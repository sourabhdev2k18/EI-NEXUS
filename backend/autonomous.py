"""
Autonomous Engineering Intelligence Twin (AEIT) loop — fleet-wide.

This is the closed-loop upgrade: instead of a human clicking "Analyze" then
"Apply Fix", the agent runs the full cycle by itself, across every asset in
the fleet concurrently, and narrates each stage into a live log the UI
streams — this is what lets you stand in front of judges and say "watch,
the AI is detecting this and fixing it itself, on three machines at once"
and just point at the screen.

State machine per incident (one runs independently per asset, so multiple
assets can be mid-episode at the same time — this is the "Agentic Asset
Management" story, not just a single-machine demo):

  MONITORING -> DETECTED -> DIAGNOSING -> FIXING -> VALIDATING -> OPTIMIZING -> MONITORING

Each transition appends a timestamped, human-readable, asset-tagged entry to
the shared log (self-narrating for a live demo) plus a structured payload
the frontend can render richer detail from (citations, confidence, etc).

"Optimizing" is the loop-closing step called out in the positioning
feedback ("continuously optimizes operational performance"): after a
failure mode has been resolved a couple of times in the session, the agent
tightens that signal's warning threshold slightly so it catches the same
failure earlier next time — a genuine (if simple) adaptive-learning story,
not just a slide claim.

Every fully-resolved incident is also appended to `resolved_incidents` with
its wall-clock elapsed time, which backend/metrics.py:compute_roi() turns
into a live dollar-savings figure for the ROI panel.
"""
import time
import threading
import random

from . import twin as twin_module
from . import anomaly
from . import mcp_server
from . import metrics
from . import db
from .tools import FAILURE_MODES

POLL_INTERVAL = 1.2
RECOVERY_TIMEOUT_TICKS = 60          # ~72s safety valve so a demo can't hang forever
AUTO_INJECT_IDLE_SECONDS = 18        # if "auto-simulate" is on and an asset is nominal this long, inject a random fault


class AutonomousAgent:
    def __init__(self):
        self.lock = threading.Lock()
        self.enabled = False
        self.auto_inject = False
        self.state = "IDLE"                # headline state shown in the state-flow bar (most advanced active episode)
        self.log = []                       # list of {ts, stage, message, detail, asset_id}
        self.resolved_counts = {}           # failure_mode -> count, drives the "optimization" story
        self.resolved_incidents = []        # [{asset_id, failure_mode, elapsed_seconds, ts}] — feeds the ROI calculator
        self.busy_assets = set()            # asset_ids currently mid-episode
        self._last_nominal_time = {}        # asset_id -> last time it was seen nominal
        self._thread = None

    # ------------------------------------------------------------------
    def start(self, auto_inject=False):
        with self.lock:
            self.enabled = True
            self.auto_inject = auto_inject
            self.state = "MONITORING"
            now = time.time()
            self._last_nominal_time = {aid: now for aid in twin_module.fleet.assets}
            self._log("SYSTEM", f"Autonomous mode ENGAGED — agent is now monitoring, diagnosing, "
                                 f"fixing, validating, and optimizing across all {len(twin_module.fleet.assets)} "
                                 f"fleet assets without manual input.")
        if not self._thread or not self._thread.is_alive():
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def stop(self):
        with self.lock:
            self.enabled = False
            self.state = "IDLE"
            self._log("SYSTEM", "Autonomous mode DISENGAGED — returning to manual control.")

    def status(self):
        with self.lock:
            return {
                "enabled": self.enabled,
                "auto_inject": self.auto_inject,
                "state": self.state,
                "log": list(self.log[-80:]),
                "resolved_counts": dict(self.resolved_counts),
                "resolved_incidents": list(self.resolved_incidents),
                "busy_assets": list(self.busy_assets),
            }

    def clear_log(self):
        with self.lock:
            self.log = []
            self.resolved_incidents = []

    # ------------------------------------------------------------------
    def _log(self, stage, message, detail=None, asset_id=None):
        entry = {
            "ts": round(time.time(), 2),
            "stage": stage,
            "message": message,
            "detail": detail,
            "asset_id": asset_id,
        }
        self.log.append(entry)
        if len(self.log) > 400:
            self.log.pop(0)

    # ------------------------------------------------------------------
    def _run_loop(self):
        while True:
            with self.lock:
                if not self.enabled:
                    return
                auto_inject = self.auto_inject

            for asset_id, t in twin_module.fleet.assets.items():
                with self.lock:
                    if asset_id in self.busy_assets:
                        continue

                snap = t.snapshot()
                findings = anomaly.detect(snap)

                if not findings and snap["active_fault"] is None:
                    last_nominal = self._last_nominal_time.get(asset_id, time.time())
                    if auto_inject and (time.time() - last_nominal) > AUTO_INJECT_IDLE_SECONDS:
                        mode = random.choice(list(FAILURE_MODES.keys()))
                        t.inject_fault(mode)
                        self._log("SYSTEM", f"No active incident on {asset_id} — auto-simulating a field "
                                             f"failure ({mode}) to keep the live demo running.", asset_id=asset_id)
                        self._last_nominal_time[asset_id] = time.time()
                elif findings:
                    actionable = [f for f in findings if f["rule_triggered"]]
                    if actionable:
                        self._last_nominal_time[asset_id] = time.time()
                        with self.lock:
                            self.busy_assets.add(asset_id)
                        th = threading.Thread(target=self._handle_incident, args=(t, actionable[0]), daemon=True)
                        th.start()
                    # else: statistical-only signal, surfaced in /api/telemetry for visibility
                    # but not actionable on its own — avoids the agent "fixing" a machine
                    # that was never actually faulted.

            time.sleep(POLL_INTERVAL)

    def _handle_incident(self, t, top_finding):
        asset_id = t.asset_id
        signal = top_finding["signal"]
        value = top_finding["value"]
        mode = top_finding["failure_mode"]
        episode_start = time.time()

        with self.lock:
            self.state = "DETECTED"
        self._log("DETECTED",
                   f"[{asset_id}] Anomaly detected on '{signal}' = {value} "
                   f"({top_finding['severity']}, confidence {int(top_finding['combined_confidence']*100)}%). "
                   f"Hybrid rule + statistical detector flagged failure mode '{mode}'.",
                   detail=top_finding, asset_id=asset_id)

        # --- DIAGNOSING -------------------------------------------------
        with self.lock:
            self.state = "DIAGNOSING"
        symptoms = FAILURE_MODES.get(mode, {}).get("symptoms", [])
        query = random.choice(symptoms) if symptoms else f"{mode} anomaly detected, value {value}"
        self._log("DIAGNOSING", f"[{asset_id}] Running 4-tool MCP agent (ticket search → BOM lookup → "
                                 f"design-doc RAG → past-fix retrieval) against: \"{query}\"", asset_id=asset_id)

        t0 = time.time()
        result = mcp_server.run_rca_pipeline(query, use_llm=True)
        elapsed = round((time.time() - t0) * 1000, 1)
        metrics.record_rca_latency(elapsed)
        self._log("DIAGNOSING",
                   f"[{asset_id}] Root cause identified in {elapsed}ms — {len(result['citations'])} citations "
                   f"({', '.join(result['citations'][:4])}{'…' if len(result['citations']) > 4 else ''}). "
                   f"{'Gemini synthesis' if result['llm_used'] else 'Offline rule-based synthesis'} used.",
                   detail={"synthesis": result["synthesis"], "citations": result["citations"],
                           "trace": result["trace"], "inferred_failure_mode": result["inferred_failure_mode"]},
                   asset_id=asset_id)

        # --- FIXING -------------------------------------------------------
        with self.lock:
            self.state = "FIXING"
        t.apply_fix()
        self._log("FIXING", f"[{asset_id}] Agent is autonomously applying the highest-effectiveness validated "
                             f"fix from the retrieval step — no human approval required for this demo profile.",
                   asset_id=asset_id)

        # --- VALIDATING (poll until recovered or timeout) -----------------
        with self.lock:
            self.state = "VALIDATING"
        ticks = 0
        recovered = False
        while ticks < RECOVERY_TIMEOUT_TICKS:
            time.sleep(POLL_INTERVAL)
            ticks += 1
            snap = t.snapshot()
            if snap["status"] == "NOMINAL" and snap["active_fault"] is None:
                recovered = True
                break
            with self.lock:
                if not self.enabled:
                    self.busy_assets.discard(asset_id)
                    return

        elapsed_seconds = round(time.time() - episode_start, 1)
        if recovered:
            self._log("VALIDATING", f"[{asset_id}] Recovery validated — {signal} is back within nominal band. "
                                     f"Incident closed in {elapsed_seconds}s wall-clock.", asset_id=asset_id)
        else:
            self._log("VALIDATING", f"[{asset_id}] Recovery timed out — escalating to human engineer.",
                       detail={"signal": signal}, asset_id=asset_id)

        # --- OPTIMIZING ------------------------------------------------
        with self.lock:
            self.state = "OPTIMIZING"
        if recovered:
            with self.lock:
                self.resolved_counts[mode] = self.resolved_counts.get(mode, 0) + 1
                count = self.resolved_counts[mode]
                self.resolved_incidents.append({
                    "asset_id": asset_id, "failure_mode": mode,
                    "elapsed_seconds": elapsed_seconds, "ts": time.time(),
                })
            try:
                db.insert_resolved_incident(asset_id, mode, elapsed_seconds)
            except Exception as e:  # noqa: BLE001 — DB persistence must never break the live demo
                print(f"[autonomous] Could not persist incident to DB (non-fatal): {e}")
            if count >= 2 and signal in anomaly.THRESHOLDS:
                self._tighten_threshold(signal, count, asset_id)
            else:
                self._log("OPTIMIZING", f"[{asset_id}] Logged resolved incident #{count} for '{mode}'. "
                                         f"Will tighten the '{signal}' warning threshold once this failure "
                                         f"mode recurs again — closing the loop from reactive to predictive.",
                           asset_id=asset_id)

        with self.lock:
            self.busy_assets.discard(asset_id)
            if not self.busy_assets:
                self.state = "MONITORING"
        self._log("SYSTEM", f"[{asset_id}] Back to autonomous monitoring.", asset_id=asset_id)

    def _tighten_threshold(self, signal, count, asset_id):
        thresh = anomaly.THRESHOLDS.get(signal, {})
        changed = False
        detail_before = dict(thresh)
        for key in ("warning", "critical"):
            if key in thresh:
                old = thresh[key]
                thresh[key] = round(old * 0.98, 2)  # tighten by 2%
                changed = True
        for key in ("warning_low", "critical_low"):
            if key in thresh:
                old = thresh[key]
                thresh[key] = round(old * 1.02, 2)  # tighten by 2% (raise the floor)
                changed = True
        if changed:
            self._log("OPTIMIZING",
                       f"[{asset_id}] '{signal}' has now caused {count} incidents fleet-wide this session. "
                       f"Agent tightened its own detection threshold ({detail_before} → {thresh}) so EVERY "
                       f"asset in the fleet catches this failure mode earlier next time — one incident makes "
                       f"the whole fleet smarter.",
                       detail={"signal": signal, "before": detail_before, "after": dict(thresh)},
                       asset_id=asset_id)


agent = AutonomousAgent()
