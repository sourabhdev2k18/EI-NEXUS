# EI-Nexus — Technical Design Document
### Autonomous Engineering Intelligence Twin (AEIT)
**Team MCP Mavericks · LTTS OpenHack 2026**
**Primary use case:** GOH-UC-034 · **Secondary:** GOH-UC-010, GOH-UC-046, GOH-UC-065
**Document version:** 1.0 · **Status:** Hackathon build, Stage 1 (local/offline-first)

---

## 1. Overview & Purpose

EI-Nexus is an agentic AI-powered digital twin that autonomously monitors a
fleet of industrial motor-controller assets, detects anomalies, performs
root-cause analysis via a 4-tool MCP agent, applies a validated fix,
confirms recovery, and tightens its own detection thresholds fleet-wide —
closing the loop from reactive to predictive maintenance without a human in
the decision path.

This document describes the system's architecture, data model, behavior,
deployment, and quality attributes at a level of detail suitable for
engineering review, onboarding a new contributor, or defending design
decisions to judges/stakeholders.

### 1.1 Goals

- Trace a field failure symptom to a cited, design-level root cause in
  under 90 seconds, end to end, including the fix.
- Ground every synthesized claim in a real ticket/spec/doc/fix ID —
  never hallucinate an identifier.
- Run fully offline with zero required external services or API keys.
- Manage more than one asset concurrently (fleet-scale, not single-machine).
- Get measurably better at detection over time without retraining a model.
- Be defensible: every quoted metric (precision, recall, latency, ROI) is
  computed live from the running system, not hardcoded.

### 1.2 Non-Goals (for this build stage)

- Real sensor/PLC integration — the digital twin is a physics-flavored
  simulation, not a live SCADA connector (see Roadmap, §10).
- Production-grade authentication, multi-tenancy, or audit logging.
- A trained ML anomaly model — the detector is intentionally rule +
  statistical for explainability at this stage (see §6).
- Persistent storage across restarts — state is in-memory by design for a
  fast, always-clean demo reset.

---

## 2. System Context

```
                    ┌─────────────────────────┐
                    │   Judge / Presenter      │
                    │   (web browser)          │
                    └────────────┬─────────────┘
                                 │ HTTP :8000
                    ┌────────────▼─────────────┐
                    │      EI-Nexus Backend     │
                    │   (Flask, single process) │
                    └────────────┬─────────────┘
                                 │ HTTPS (optional)
                    ┌────────────▼─────────────┐
                    │   Google Gemini API        │
                    │   (graceful fallback if    │
                    │    unreachable/no key)     │
                    └───────────────────────────┘
```

The system has exactly one required external dependency surface (the
browser talking to the local Flask server) and one **optional** one (Gemini).
Everything else — simulation, detection, retrieval, orchestration, ROI — is
self-contained Python with no database server, no vector DB, and no GPU.

---

## 3. Architecture — Component View

![Component Diagram](docs/diagrams/05_component_diagram.png)

| Component | File | Responsibility |
|---|---|---|
| Frontend Dashboard | `frontend/index.html` | Single-page UI: fleet grid, telemetry charts, autonomous log, RCA trace, ROI panel. Polls REST endpoints; no build step. |
| REST API Routes | `backend/app.py` | Flask routes; thin — delegates to domain modules, never contains business logic itself. |
| Digital Twin + Fleet | `backend/twin.py` | Per-asset telemetry simulation, fault injection, fix application, history buffer. `Fleet` manages N `DigitalTwin` instances. |
| Hybrid Anomaly Detector | `backend/anomaly.py` | Rule-threshold + rolling z-score statistical detection with a variance floor (see §6.2 for the bug this fixed). |
| Autonomous Agent | `backend/autonomous.py` | The closed-loop state machine: MONITORING → DETECTED → DIAGNOSING → FIXING → VALIDATING → OPTIMIZING, run per-asset, concurrently, in daemon threads. |
| MCP Orchestrator | `backend/mcp_server.py` | Calls the 4 tools in sequence, infers the failure mode from ticket similarity, assembles the cited synthesis. |
| 4 MCP Tools | `backend/tools.py` | `tool_ticket_search`, `tool_bom_lookup`, `tool_design_doc_search`, `tool_past_fix_retrieval` — each a pure function with a declared schema, MCP-shaped for a 1:1 mapping onto the real MCP SDK. |
| TF-IDF RAG Engine | `backend/rag.py` | Dependency-free TF-IDF vectorization + cosine similarity search (no sklearn, no vector DB). |
| Gemini Client | `backend/gemini_client.py` | Optional LLM synthesis with full diagnostic capture (HTTP status, error body) and deterministic rule-based fallback. |
| Metrics + ROI | `backend/metrics.py` | Retrieval evaluation harness (RAG vs. keyword baseline), latency percentiles, live ROI calculator. |
| Real MCP SDK Server | `mcp_stdio_server.py` | Optional: exposes the same 4 tools over the actual MCP protocol (stdio transport) for Claude Desktop or any MCP client. |

---

## 4. Data Model

The synthetic dataset (tickets, BOM specs, design docs, past fixes) is
authored as JSON by `scripts/generate_tickets.py` (seeded for
reproducibility, `random.seed(42)`) but is no longer the runtime source of
truth — as of v1.3.0, all of it lives in a real SQLite database
(`backend/db.py`), seeded from the JSON on first run. See ADR-005 for the
reasoning. The JSON remains the human-editable authoring format; the
database is what the running system actually queries, and what durably
records everything the system *produces* (resolved incidents, ARIA chat
history) across restarts.

| Entity | Count | Key Fields | Used By |
|---|---|---|---|
| **Ticket** | 60 | `ticket_id, asset_id, site, failure_mode, severity, symptom_description, downtime_hours, resolved` | Tool 1 (ticket_search) |
| **BOM Spec** | 4 | `component_id, component_name, failure_mode_link, design_spec_summary, current_revision, supplier, rated_tolerance` | Tool 2 (bom_lookup) — now a real SQL `WHERE` query |
| **Design Doc** | 6 | `doc_id, title, failure_mode_link, content, revision` | Tool 3 (design_doc_search) |
| **Past Fix** | 12 | `fix_id, failure_mode_link, fix_description, validated, effectiveness_score, date_applied` | Tool 4 (past_fix_retrieval) — now a real SQL `ORDER BY ... LIMIT` query |
| **Resolved Incident** | grows over time | `asset_id, failure_mode, elapsed_seconds, ts, session_id` | Durable audit trail + lifetime ROI; survives restarts |
| **Chat Message** | grows over time | `role, text, used_llm, ts, session_id` | ARIA conversation history; survives restarts |
| **Failure Mode Taxonomy** | 4 modes | `OVERTEMP, VIBRATION, VOLTAGE, CURRENT` — each with symptoms list, linked component, root_cause, fix | Ground truth for twin simulation + all 4 tools; stays as JSON config, not corpus data |

### 4.1 Class Diagram

![Class Diagram](docs/diagrams/01_class_diagram.png)

Key relationships:
- A `Fleet` owns exactly 4 `DigitalTwin` instances (composition — a twin
  has no meaningful existence outside its fleet in this build).
- `AutonomousAgent` depends on `Fleet`, `AnomalyDetector`, `MCPServer`, and
  `MetricsModule` but owns none of them — pure orchestration.
- `MCPServer` orchestrates the 4 tools and the `GeminiClient`; it has no
  knowledge of the twin or the agent (clean separation between "diagnose"
  and "act").
- `TfidfIndex` is instantiated once per searchable corpus (tickets, design
  docs) at process startup and held in memory, built from rows fetched
  from the database rather than raw JSON.

### 4.2 Entity-Relationship Diagram (persistence layer)

![ER Diagram](docs/diagrams/07_er_diagram.png)

`failure_mode` / `failure_mode_link` acts as a logical foreign key across
`tickets`, `bom_specs`, `design_docs`, `past_fixes`, and
`resolved_incidents` — there's no formal `FOREIGN KEY` constraint (the
taxonomy is fixed config, not a separate table with its own primary key),
but every one of those columns is indexed and the relationship is exactly
how the 4 MCP tools cross-reference evidence: infer a failure mode from
ticket similarity, then pull BOM/design-doc/fix rows that share it.

---

## 5. Behavioral Views

### 5.1 Manual RCA Request — Sequence Diagram

Triggered when a user clicks **"Run 4-Tool MCP Agent"** in the dashboard.

![Sequence — Manual RCA](docs/diagrams/02_sequence_rca.png)

Notable design decisions:
- The failure mode is **inferred from ticket similarity**, not passed in by
  the caller — this is what lets a free-text symptom description drive the
  whole pipeline, matching how a field engineer would actually describe a
  problem.
- The Gemini call is wrapped in an `alt` — synthesis always succeeds from
  the caller's point of view; the *quality* of the narrative differs, not
  the reliability of the response.

### 5.2 Autonomous Closed Loop — Sequence Diagram

Triggered when **Autonomous Mode** is engaged; runs continuously per asset.

![Sequence — Autonomous Loop](docs/diagrams/03_sequence_autonomous.png)

Notable design decisions:
- Each incident is handled in its **own daemon thread**, tracked via a
  `busy_assets` set guarded by a lock — this is what allows two different
  fleet assets to be mid-incident at the same time without one blocking
  the other's detection loop.
- The **"genuine threshold breach" guard** (see §6.2) is what stops the
  agent from ever trying to "fix" an asset that was never actually faulted.

### 5.3 Agent State Machine

![State Diagram](docs/diagrams/04_state_diagram.png)

| State | Entry Condition | Exit Condition |
|---|---|---|
| MONITORING | Idle, or previous incident closed | A rule-triggered anomaly is found on some asset |
| DETECTED | Anomaly found, asset marked busy | 4-tool MCP pipeline invoked |
| DIAGNOSING | MCP pipeline running | Synthesis + citations returned |
| FIXING | Fix applied to the twin | Recovery polling begins |
| VALIDATING | Polling telemetry every 1.2s | Status returns to NOMINAL, or 60-tick (~72s) timeout |
| OPTIMIZING | Incident resolved | Threshold tightened (2nd+ occurrence) or logged (1st) |
| ESCALATED | Recovery timeout | Logged for human follow-up; asset released |

---

## 6. Detection Design

### 6.1 Hybrid Rule + Statistical Detector

`backend/anomaly.py` combines two signals per telemetry channel:

1. **Rule-based thresholds** — hard warning/critical bounds per signal
   (e.g., temperature warning at 75°C, critical at 95°C). Deterministic,
   instantly explainable to a judge or an engineer.
2. **Rolling z-score** — `|value - rolling_mean| / rolling_stdev` over a
   trailing window (minimum 15 samples), squashed to a 0–1 confidence.
   Catches slow drift that hasn't yet crossed a hard threshold.

Combined confidence = `0.65 × rule_confidence + 0.35 × statistical_confidence`.

### 6.2 Case Study — the false-positive bug we found and fixed

During fleet-wide concurrency stress testing, the statistical half of the
detector occasionally fired on **pure baseline noise** for a freshly-started
asset. Root cause: a trailing window with near-zero variance (by chance, a
few ticks in a row landing close together) made the z-score denominator
tiny, so even an ordinary fluctuation produced an inflated z-score.

Because the "anomaly" wasn't a real injected fault, `apply_fix()` silently
no-op'd (no `active_fault` was set), and the validation check passed on the
very next tick (status was already NOMINAL) — meaning the agent would
"resolve" a phantom incident in ~1 second and log it as a real, ROI-counted
event.

**Fix, two layers deep:**
1. **Variance floor** in `zscore_confidence()` — `stdev = max(raw_stdev, abs(mean) * 0.015, 0.05)`
   — prevents the divide-by-near-zero blow-up.
2. **Actionability guard** in the autonomous loop — a full incident episode
   is only ever spawned on a **rule-triggered** finding; statistics alone
   are surfaced in `/api/telemetry` for visibility but never drive an
   autonomous fix. This is defense in depth: even if the statistical layer
   misfires again in the future, it structurally cannot corrupt the ROI
   numbers or the demo narrative.

Verified with a 75-second concurrent fleet stress test post-fix: zero false
positives, all resolved incidents traced to genuine injected faults.

---

## 7. Retrieval (RAG) Design

`backend/rag.py` implements TF-IDF vectorization and cosine similarity from
scratch, with **zero** ML dependency (no scikit-learn, no sentence-transformers,
no vector database). Rationale:

- Fully transparent and auditable — every retrieval score is explainable
  in one sentence to a judge, versus a black-box embedding call.
- Runs identically online or fully offline.
- Sufficient corpus size (60 tickets, 6 design docs) that TF-IDF's
  bag-of-words limitation vs. dense embeddings is not the bottleneck.

Swap-in path documented for scale: replacing `TfidfIndex` with a
FAISS/Chroma-backed embedding retriever is a drop-in change behind the same
`search(query, top_k)` interface — see Roadmap §10, Stage 2.

Evaluation methodology (`backend/metrics.py:run_retrieval_eval`): a
held-out set of 12 queries, deliberately **paraphrased** away from the
seed ticket phrasing (e.g., "controller is running very hot and shut
itself down" rather than the ticket's original wording), scored for
Precision@1 and Recall@3 against both the TF-IDF retriever and a naive
keyword-overlap baseline. Current session result: **100% / 100%** for
EI-Nexus RAG vs. **83% / 100%** for the naive baseline.

---

## 8. Reliability & Failure Handling

| Failure mode | Handling |
|---|---|
| No Gemini API key configured | `gemini_client.synthesize_with_gemini` returns `(None, False)` immediately; `mcp_server` falls back to `synthesize_rule_based`. |
| Gemini API key invalid / quota exceeded / network unreachable | HTTP error body captured verbatim into `_last_status`, surfaced via `/api/gemini_status` and directly in the RCA report UI — never a silent failure, never a crashed request. |
| Recovery never converges (simulated fix doesn't resolve in time) | 60-tick (~72s) timeout in the VALIDATING state transitions to ESCALATED and releases the asset lock — the agent never hangs indefinitely. |
| Statistical detector misfires | Actionability guard (§6.2) — never spawns an incident on statistics alone. |
| Concurrent incidents on the same asset | `busy_assets` set + lock prevents a second episode from starting on an asset already mid-incident. |
| Browser refresh mid-demo | All state is server-side; polling resumes and reflects current state immediately on reload. |

---

## 9. Deployment View

![Deployment Diagram](docs/diagrams/06_deployment_diagram.png)

Current deployment (Stage 1) is intentionally minimal: a single Python
process (`python run.py`) runs the Flask dev server, a 1Hz background tick
thread for the whole fleet, and one daemon thread per in-flight incident.
All state — twin telemetry, TF-IDF indices, autonomous logs — lives in
process memory. The only files read from disk are the seed JSON dataset
and an optional `.env` for the Gemini key.

See the Deployment Plan (companion document / pitch deck) for Stage 2
(containerized cloud pilot) and Stage 3 (Kubernetes fleet-scale platform).

---

## 10. API Reference

| Route | Method | Purpose |
|---|---|---|
| `/` | GET | Serves the dashboard |
| `/api/fleet` | GET | Status + top anomaly for all 4 assets |
| `/api/telemetry?asset_id=` | GET | Full telemetry + history for one asset |
| `/api/inject_fault` | POST | `{asset_id, failure_mode}` — simulate a field failure |
| `/api/apply_fix` | POST | `{asset_id}` — manually apply the fix |
| `/api/reset` | POST | Reset entire fleet, agent, and thresholds |
| `/api/analyze_rca` | POST | `{query, use_llm}` — run the 4-tool MCP pipeline once |
| `/api/rca_log` | GET | Recent manual RCA runs |
| `/api/autonomous/start` | POST | `{auto_inject}` — engage the closed loop |
| `/api/autonomous/stop` | POST | Disengage |
| `/api/autonomous/status` | GET | State, narrated log, resolved incidents |
| `/api/roi` | GET | Live business-impact numbers |
| `/api/metrics` | GET | Retrieval evaluation + latency percentiles |
| `/api/tools` | GET | The 4 MCP tool schemas |
| `/api/gemini_status` | GET | Key presence + last-call diagnostics |

---

## 11. Non-Functional Requirements

| Attribute | Target | Actual (measured) |
|---|---|---|
| RCA pipeline latency (compute only) | < 100ms | P50/P95 < 1ms (TF-IDF is fast at this corpus size) |
| End-to-end incident (detect→fix→validate) | < 90s | ~17s average, measured over multiple runs |
| Offline operation | Fully functional with zero network calls | Verified — rule-based synthesis path has no network dependency |
| Concurrent asset handling | ≥ 2 simultaneous incidents | Verified up to all 4 assets concurrently in stress testing |
| False-positive rate (autonomous incidents) | 0% on untouched assets | Verified via 75s stress test post-fix (see §6.2) |

---

## 12. Security & Data Considerations

- All ticket/BOM/design-doc/fix data is **synthetic**, generated locally —
  no real customer, plant, or personal data is used anywhere in this build.
- The only secret in the system is `GEMINI_API_KEY`, read from a local
  `.env` file (git-ignored) and never logged or transmitted anywhere
  except directly to Google's API over HTTPS.
- No authentication layer exists at this stage (Stage 1, local-only) —
  see Deployment Plan Stage 2/3 for the planned auth + per-plant isolation.

---

## 13. Testing Summary

(Full detail in `DEMO_GUIDE.md` and the pitch deck's Testing Plan slide.)

- **Retrieval evaluation** — 12 held-out paraphrased queries, run automatically on every `/api/metrics` call.
- **Integration** — every endpoint exercised via Flask test client and live HTTP, including the full fault→fix→validate cycle.
- **Concurrency/stress** — 75-second fleet-wide autonomous test with simultaneous multi-asset incidents; this is where the §6.2 bug was caught.
- **Live demo rehearsal** — 12-point manual checklist run before every presentation.

---

## 14. Roadmap (post-hackathon)

| Horizon | Focus |
|---|---|
| 30 days | Real vector DB (FAISS/Chroma) + embeddings; Dockerized pilot deployment; SAP/CMMS ticket ingestion |
| 60 days | Factory-wide digital twin at true multi-machine scale; time-series DB for real sensor feeds; ML-based anomaly detection |
| 90 days | Computer-vision inspection integration; voice-enabled maintenance assistant; autonomous scheduling; field-engineer mobile app |

---

## Appendix A — Project File Layout

```
ei-nexus-rca/
├── run.py                     entry point
├── requirements.txt
├── .env.example
├── Dockerfile                 container image definition
├── docker-compose.yml         local container parity testing
├── .dockerignore
├── LICENSE                    MIT
├── CHANGELOG.md                version history
├── DEPLOYMENT_GUIDE.md         GCP / Azure / AWS deployment instructions
├── mcp_stdio_server.py        optional real MCP protocol server
├── backend/
│   ├── app.py                 Flask routes
│   ├── twin.py                DigitalTwin + Fleet
│   ├── anomaly.py             hybrid detector
│   ├── autonomous.py          closed-loop agent
│   ├── mcp_server.py          orchestration + reasoning trace
│   ├── tools.py                4 MCP tools (now DB-backed)
│   ├── rag.py                 TF-IDF engine
│   ├── gemini_client.py       LLM synthesis + fallback + diagnostics
│   ├── metrics.py             retrieval eval + ROI + latency
│   ├── chatbot.py             ARIA — chat Q&A over live state
│   └── db.py                  SQLite persistence layer
├── data/                      synthetic JSON knowledge base + ei_nexus.db (generated)
├── scripts/generate_tickets.py
├── frontend/index.html        single-page dashboard (incl. ARIA widget)
├── sprint_board/index.html    Kanban sprint tracker
├── tests/test_api.py          automated integration test suite
├── .github/workflows/ci.yml   CI: tests + Docker build on every push
└── docs/
    ├── DESIGN_DOC.md            this document
    ├── SDLC_OVERVIEW.md         methodology, phase-by-phase artifact map
    ├── TEST_PLAN.md             test case matrix + stress test log
    ├── REQUIREMENTS_TRACEABILITY_MATRIX.md   use case -> feature -> test
    ├── openapi.yaml             formal API contract
    ├── adr/ARCHITECTURE_DECISIONS.md          why each key decision was made
    └── diagrams/                UML source (.mmd) + rendered PNGs
```

## Appendix B — Failure Mode Taxonomy

| Mode | Signal | Component | Root Cause (design-level) |
|---|---|---|---|
| OVERTEMP | temperature | MC-2201-HS (Heat Sink) | Fin density 18% below continuous-duty thermal requirement; simulation assumed intermittent duty |
| VIBRATION | vibration | MC-2201-BRG (Bearing Set) | Preload torque spec insufficient for actual field dynamic load (22% above design case) |
| VOLTAGE | voltage | MC-2201-PSU (Power Supply) | Capacitor bank sized for nominal only, no margin for grid sag/swell (±12% actual vs ±5% design) |
| CURRENT | current | MC-2201-WDG (Stator Winding) | Insulation class under-rated for high-ambient (45°C+) deployment sites |

## Appendix C — Glossary

- **AEIT** — Autonomous Engineering Intelligence Twin, this project's positioning.
- **MCP** — Model Context Protocol; here used both as an architectural pattern (tool-calling agent loop) and, optionally, the real protocol via `mcp_stdio_server.py`.
- **RAG** — Retrieval-Augmented Generation; here implemented via TF-IDF, not embeddings.
- **RCA** — Root Cause Analysis.
- **Fleet** — the set of `DigitalTwin` instances managed concurrently by the system.
