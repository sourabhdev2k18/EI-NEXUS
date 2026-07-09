# Changelog

All notable changes to EI-Nexus are documented here, in reverse chronological
order. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Stage 2 planning
- Cloud deployment artifacts (Docker, GCP/Azure/AWS guides) — see `DEPLOYMENT_GUIDE.md`
- Managed database migration path documented for multi-instance deployment

## [1.3.0] — Database + Documentation Hardening
### Added
- SQLite persistence layer (`backend/db.py`) — real schema for tickets, BOM
  specs, design docs, past fixes, resolved incidents, and chat history.
  Zero new dependency (`sqlite3` is Python stdlib).
- Resolved incidents and ARIA chat history now durably survive a process
  restart — previously in-memory only.
- New endpoints: `GET /api/db/stats`, `GET /api/db/incidents/lifetime`.
- Architecture Decision Records (`docs/adr/ARCHITECTURE_DECISIONS.md`).
- Requirements Traceability Matrix (`docs/REQUIREMENTS_TRACEABILITY_MATRIX.md`).
- ER diagram for the new schema (`docs/diagrams/07_er_diagram.png`).
### Changed
- `backend/tools.py` now sources data from SQLite instead of loading raw
  JSON into memory at import time. Public interface (`TICKETS`, `BOM_SPECS`,
  `DESIGN_DOCS`, `PAST_FIXES`, all 4 tool function signatures) unchanged.
- `tool_bom_lookup` and `tool_past_fix_retrieval` now execute real SQL
  queries (`WHERE`, `ORDER BY`, `LIMIT`) instead of Python list filtering.
### Verified
- Full regression suite (all pre-existing routes + UI flows) re-run and
  passed before and after this change — zero functionality lost.

## [1.2.0] — ARIA Chatbot
### Added
- ARIA (Autonomous RCA Intelligence Assistant) — conversational Q&A widget
  grounded in live fleet state and autonomous agent history
  (`backend/chatbot.py`, floating chat widget in `frontend/index.html`).
- Endpoints: `POST /api/chat`, `GET /api/chat/history`, `POST /api/chat/clear`.
### Fixed
- `AttributeError` in ARIA's "why" intent path — `.get("detail", {})` returns
  `None` (not the default) when the key exists with an explicit `None`
  value, which several log entries have. Fixed with `(e.get("detail") or {})`.
- **Pre-existing latent bug found while testing ARIA:** an uncaught
  `ReferenceError` when the Chart.js CDN fails to load (e.g. no internet)
  halted the *entire* dashboard script — not just the chart, but fleet grid,
  telemetry polling, and now ARIA's own initialization. Wrapped `initChart()`
  in try/catch so a CDN failure only costs the line chart, never the rest
  of the app.
- ARIA panel failed to open due to a script/DOM ordering issue (the
  `<script>` tag closed before the newly-added widget HTML was parsed,
  so `getElementById` returned `null` at execution time). Fixed by
  deferring ARIA's setup to `DOMContentLoaded`.
### Verified
- Full regression suite passed before and after. Concurrency, autonomous
  mode, manual fault injection/fix, RCA pipeline, ROI, and metrics all
  re-confirmed working alongside the new chat widget.

## [1.1.0] — Fleet Scale + Autonomous Optimization
### Added
- Multi-asset `Fleet` (4 concurrently-monitored assets), replacing the
  single-twin model.
- Self-tightening detection thresholds after a failure mode recurs
  (fleet-wide, not per-asset).
- Live ROI / business-impact calculator (`backend/metrics.py::compute_roi`).
- Fleet Overview UI panel, per-asset selection.
### Fixed
- **Concurrency stress-test bug:** the statistical anomaly detector could
  false-trigger on baseline noise for an untouched asset when its trailing
  window happened to have near-zero variance (z-score divide-by-near-zero).
  Because no real fault was active, the agent would "resolve" the phantom
  incident in ~1 second, corrupting the ROI ledger. Fixed with a variance
  floor plus a structural guard: the autonomous loop only acts on
  rule-triggered findings, never statistics alone. See ADR-004 for the
  full case study.
### Verified
- 75-second concurrent fleet stress test, zero false positives post-fix.

## [1.0.0] — Autonomous Closed Loop
### Added
- Full closed-loop autonomous agent: MONITORING → DETECTED → DIAGNOSING →
  FIXING → VALIDATING → OPTIMIZING (`backend/autonomous.py`).
- Live narrated operations log in the dashboard.
- Repositioned project as "Autonomous Engineering Intelligence Twin (AEIT)"
  per use-case alignment feedback (GOH-UC-034 primary, 010/046/065 secondary).

## [0.2.0] — MCP Agent + RAG
### Added
- 4-tool MCP agent: ticket search, BOM lookup, design-doc search, past-fix
  retrieval (`backend/tools.py`, `backend/mcp_server.py`).
- Dependency-free TF-IDF + cosine-similarity retrieval engine (`backend/rag.py`).
- Gemini-optional LLM synthesis with deterministic rule-based fallback
  (`backend/gemini_client.py`).
- Evaluation harness: retrieval precision/recall@k vs. naive keyword baseline.

## [0.1.0] — Initial Digital Twin
### Added
- Single-asset digital twin simulation, 6-signal telemetry, fault injection.
- Hybrid rule-based + statistical anomaly detector.
- Flask API + single-page dashboard.
- Synthetic dataset generator (`scripts/generate_tickets.py`).
