# Requirements Traceability Matrix (RTM)

Maps every use case this project claims alignment with, down through the
specific feature that implements it, the code that owns it, and the test
that proves it — so any claim in the pitch can be traced to working code,
not just a slide bullet.

| Use Case | Requirement | Feature | Implementation | Verified By |
|---|---|---|---|---|
| **GOH-UC-034** (Primary) — AI Agent for RCA & Process Optimization | Agent autonomously diagnoses and acts on failures without human input | Autonomous closed-loop agent (Monitor→Detect→Diagnose→Fix→Validate→Optimize) | `backend/autonomous.py` | 75-second concurrent fleet stress test; live demo checklist item #6-8 in `DEMO_GUIDE.md` |
| GOH-UC-034 | Root cause must be evidence-grounded, not hallucinated | 4-tool MCP agent with citation enforcement | `backend/mcp_server.py`, `backend/tools.py` | `/api/analyze_rca` integration test asserts `citations` list is non-empty and every ID exists in the source dataset |
| GOH-UC-034 | Process optimization — the system should improve, not just repeat | Self-tightening detection thresholds after repeat incidents | `backend/autonomous.py::_tighten_threshold` | Test: inject same failure mode twice, assert `THRESHOLDS[signal]` value changes between occurrence 1 and 2 |
| **GOH-UC-010** — Predictive Maintenance | Detect degradation trends before hard failure | Rolling z-score statistical layer | `backend/anomaly.py::zscore_confidence` | Unit-level check: statistical confidence rises with simulated drift before rule threshold is crossed |
| GOH-UC-010 | Detection should get more sensitive after real incidents | Threshold tightening (2% per repeat occurrence) | `backend/autonomous.py::_tighten_threshold` | Same as GOH-UC-034 optimization test above |
| **GOH-UC-046** — Fault Detection | Explainable, low-false-positive anomaly detection | Hybrid rule + statistics with variance floor and actionability guard | `backend/anomaly.py`, `backend/autonomous.py` | 75-second stress test: 0 false positives on untouched assets (see ADR-004) |
| GOH-UC-046 | Multiple signal types must be monitored | 6-signal telemetry per asset (temp, vibration, load, voltage, current, fan speed) | `backend/twin.py::DigitalTwin` | `/api/telemetry` schema test — all 6 keys present in every snapshot |
| **GOH-UC-065** — Agentic Asset Management | Manage more than one asset; act, not just report | Fleet of 4 concurrently-monitored, concurrently-actionable assets | `backend/twin.py::Fleet`, `backend/autonomous.py` (per-asset `busy_assets` locking) | Test: inject faults on 2 different assets simultaneously, assert both resolve independently without blocking each other |
| GOH-UC-065 | Fleet-wide learning, not per-asset silos | Threshold tightening applies globally to `anomaly.THRESHOLDS`, shared across all assets | `backend/anomaly.py` (module-level dict) | Test: tighten threshold via asset A's repeat incident, assert asset B's detector uses the same tightened value |

---

## Non-functional requirements traceability

| Requirement | Target | Implementation | Verified By |
|---|---|---|---|
| Offline operation | Zero required network calls | Rule-based synthesis fallback, TF-IDF (no embedding API), SQLite (no DB server) | Manual test: disconnect network, full RCA cycle still completes |
| Graceful LLM degradation | Never block on Gemini failure | try/except around every Gemini call, diagnostic capture, deterministic fallback | `backend/gemini_client.py`; reproduced live when API quota was exhausted during development |
| Data durability | Incident/chat history survives restart | SQLite persistence layer | Physical file inspection post-restart: `SELECT * FROM resolved_incidents` returns pre-restart data (ADR-005) |
| No functionality regression on each change | 100% of pre-existing routes/flows still pass after every feature addition | Full regression suite re-run before/after every structural change (ARIA, DB layer) | Every addition confirmed zero regressions before shipping |
| Concurrency safety | ≥2 assets handled simultaneously without interference | Per-asset `busy_assets` lock + independent daemon threads | 75-second stress test with simultaneous multi-asset incidents |

---

## Traceability to spot-award categories (informal, but useful for judges)

| Category | Primary Evidence |
|---|---|
| Best Use of AI Agents | GOH-UC-034 row above — live, cited, autonomous |
| Best Technical Execution | ADR-004 (found and fixed a real concurrency bug via deliberate stress testing) |
| Most Innovative | GOH-UC-010/065 rows — self-tightening thresholds, fleet-wide |
| Best Business Case | Live ROI calculator (`backend/metrics.py::compute_roi`), computed from real resolved incidents each session |
