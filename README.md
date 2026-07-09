# 🏭 EI-Nexus — Autonomous Engineering Intelligence Twin (AEIT)

> **LTTS OpenHack 2026 · Team MCP Mavericks**
> **Primary use case:** GOH-UC-034 — AI Agent for Root Cause Analysis and Process Optimization
> **Secondary use cases:** GOH-UC-010 Predictive Maintenance · GOH-UC-046 Fault Detection · GOH-UC-065 Agentic Asset Management
> **Aligned Big Bets:** Energy & Automation · Digital Manufacturing

## 🎯 Positioning (this is the pitch — lead with it)

> *"An agentic AI-powered digital twin that autonomously monitors industrial
> assets, predicts failures, performs root-cause analysis, orchestrates
> corrective actions using AI agents, validates recovery, and continuously
> optimizes operational performance."*

That's a **closed loop**, not a dashboard: **Monitor → Predict → Diagnose →
Fix → Validate → Optimize** — and the whole loop now runs itself. Click
**Autonomous Mode** and the agent detects an anomaly, runs the 4-tool MCP
RCA pipeline, applies the fix, validates the recovery, and tightens its own
detection thresholds afterward — all narrated live in the Autonomous
Operations Log, so you can stand in front of the judges and just say
*"watch — it's diagnosing itself right now"* and point at the screen.

This directly matches the Big Bet strategy better than presenting it as a
predictive-maintenance tool: it's positioned as GOH-UC-034 (an *agent*, not
a monitor), with GOH-UC-010/046/065 as the secondary capabilities it's built
on top of.

---

## 🏆 One-line pitch

> "Field failures cost weeks of root-cause analysis across disconnected
> tickets, BOM specs, and design docs. EI-Nexus doesn't just find the root
> cause — it fixes it, validates the fix worked, and gets smarter about
> catching it earlier next time. Watch it do all of that with nobody
> touching the keyboard."

---

## 🚀 Quick Start (2 minutes, zero API keys required)

```bash
# 1. Install dependencies (just Flask + requests)
pip install -r requirements.txt

# 2. Run
python3 run.py

# 3. Open
http://localhost:8000
```

That's it — the digital twin starts streaming immediately, the RAG index
builds in-memory from the synthetic dataset in `data/`, and the MCP agent
works fully offline using the rule-based synthesis fallback.

### Optional: enable Gemini for richer RCA narrative synthesis

```bash
cp .env.example .env
# edit .env and paste your key:
# GEMINI_API_KEY=your_key_here
python3 run.py
```

The header will show **"Gemini connected"** once configured. If the key is
missing, invalid, or the network call fails for any reason, the app silently
falls back to the deterministic rule-based synthesis — **the demo can never
break on stage because of a flaky network call.**

---

## 🧠 System Architecture — the closed loop

```
                     ┌───────────────────────────────────────────┐
                     │            MONITOR                        │
                     │  Digital Twin streams live telemetry:     │
                     │  Temperature|Vibration|Load|Voltage|Current│
                     └───────────────────┬─────────────────────┬─┘
                                          │                     │
                                          ▼                     │
                     ┌───────────────────────────────┐          │
                     │           DETECT               │          │
                     │  Hybrid rule-based + rolling    │          │
                     │  z-score statistical detector   │          │
                     └───────────────┬─────────────────┘          │
                                      ▼                            │
   ┌──────────────────────────────────────────────────────────┐   │
   │  DIAGNOSE — 4-tool MCP agent (THE WOW MOMENT, live trace)│   │
   │  Tool 1 → Service Ticket Search    (TF-IDF RAG, 60 tix)  │   │
   │  Tool 2 → BOM Spec Lookup          (structured cross-ref)│   │
   │  Tool 3 → Design Doc Semantic Search (TF-IDF RAG, 6 docs)│   │
   │  Tool 4 → Prior-Fix Retrieval      (ranked by fix score) │   │
   │  Synthesis → Gemini (optional) / grounded rule-based     │   │
   └───────────────────────────┬────────────────────────────┘   │
                                ▼                                 │
                     ┌────────────────────┐                       │
                     │        FIX          │  agent auto-applies  │
                     │  highest-effectiveness validated fix        │
                     └──────────┬──────────┘                       │
                                ▼                                   │
                     ┌────────────────────┐                        │
                     │      VALIDATE       │  polls telemetry until │
                     │  confirms recovery  │  signal is nominal     │
                     └──────────┬──────────┘                        │
                                ▼                                    │
                     ┌────────────────────┐                         │
                     │      OPTIMIZE       │  tightens its own       │
                     │  on repeat incidents│  detection threshold →──┘
                     └────────────────────┘  (genuinely adaptive,
                                                not a slide claim)
```

**Autonomous Mode** (`backend/autonomous.py`) drives this entire loop in a
background thread with zero clicks: MONITORING → DETECTED → DIAGNOSING →
FIXING → VALIDATING → OPTIMIZING → back to MONITORING — each transition
narrated into a live log the dashboard streams, so the demo literally reads
like a sentence: *"detected a temperature anomaly → diagnosed it against 5
historical tickets and 2 design docs → applied fix FIX-002 → validated
recovery in 17 seconds → tightened the temperature threshold because this
is the second time it's happened."*

Manual controls (Inject Fault / Apply Fix / Analyze) still work
side-by-side for judges who want to see any single stage in isolation.

**Why this beats a plain LLM chatbot:** every one of the 4 tool calls is
visible on screen as it happens, with its own latency, its own retrieved
evidence, and its own citation. The final synthesis is not allowed to invent
an id that wasn't returned by a tool. That combination — live agent trace +
hallucination-guarded citations — is the single hardest thing for a judge to
dismiss as "just a ChatGPT wrapper."

---

## 📦 Project Structure

```
ei-nexus-rca/
├── run.py                        # entry point — python3 run.py
├── requirements.txt
├── .env.example                  # GEMINI_API_KEY goes here (optional)
├── mcp_stdio_server.py           # OPTIONAL: real MCP protocol server (Claude Desktop etc.)
├── backend/
│   ├── app.py                    # Flask routes / REST API
│   ├── twin.py                   # Digital Twin simulation engine
│   ├── anomaly.py                # Hybrid rule-based + statistical anomaly detector
│   ├── rag.py                    # Dependency-free TF-IDF + cosine similarity engine
│   ├── tools.py                  # The 4 MCP tools
│   ├── mcp_server.py             # Agent orchestration loop + reasoning trace
│   ├── autonomous.py             # Closed-loop agent: monitor→detect→diagnose→fix→validate→optimize
│   ├── gemini_client.py          # Optional Gemini synthesis + offline fallback
│   ├── metrics.py                # Precision/Recall@k eval harness vs. baseline
│   └── chatbot.py                # ARIA — chat Q&A over live fleet + agent state
├── data/
│   ├── tickets.json               # 60 synthetic field-failure tickets
│   ├── bom_specs.json             # 4 BOM component specs
│   ├── design_docs.json           # 6 design guideline docs
│   ├── past_fixes.json            # 12 validated past fixes
│   └── failure_modes.json         # ground-truth taxonomy used by the twin + tools
├── scripts/
│   └── generate_tickets.py        # regenerate the synthetic dataset
└── frontend/
    └── index.html                 # single-file dashboard (vanilla JS + Chart.js CDN)
```

---

## 🎬 5-Minute Demo Script (fleet + autonomous-mode-first — this is the winning version)

| Time | Action | What Judges See |
|------|--------|------------------|
| 0:00–0:20 | Open with the reposition | *"This isn't a monitoring dashboard for one machine. It's an agent managing a fleet. Watch — I'm not going to touch anything after this."* |
| 0:20–0:35 | Point at the **Fleet Overview** grid (4 asset cards) | 4 independent plants, all NOMINAL, all being watched by the same agent |
| 0:35–0:50 | Click **Engage Autonomous Mode** (auto-simulate ON) | State-flow bar appears: MONITOR → DETECT → DIAGNOSE → FIX → VALIDATE → OPTIMIZE |
| 0:50–1:40 | Step back. Narrate the live log as it fills in — trigger a second fault on a *different* asset while the first is still resolving | *"It just detected a temperature anomaly on Plant A... now it's running the 4-tool MCP agent... now Plant C just tripped too, and it's handling that independently, at the same time — this isn't one demo machine, it's fleet-scale."* |
| 1:40–2:00 | Point at the **Fleet Overview** cards | Two cards show a pulsing "agent working" dot simultaneously — genuinely concurrent, not a fake animation |
| 2:00–2:25 | Let a **second** incident of the same failure type happen anywhere in the fleet | OPTIMIZE stage fires: *"It just tightened the detection threshold for the whole fleet because this is the second time — one incident makes every machine smarter, that's the 'continuously optimizes' line from our positioning, actually happening."* |
| 2:25–2:50 | Scroll to **Live Business Impact** | *"Two incidents resolved this session — that's already $800K+ in modeled downtime + engineer time avoided, computed from what just happened on screen, not a slide."* |
| 2:50–3:20 | Scroll to **Evaluation Metrics** | RAG precision/recall@3 vs. naive keyword-search baseline, computed live |
| 3:20–3:50 | Click **Run 4-Tool MCP Agent** manually with a custom query | Shows judges you can also drive it manually / audit any single stage |
| 3:50–4:30 | Architecture walk-through | The closed loop diagram: Monitor → Detect → Diagnose → Fix → Validate → Optimize, across a fleet, offline-first, Gemini-optional |
| 4:30–5:00 | Close on vision + use-case alignment | GOH-UC-034 primary (agent, not monitor) + UC-010/046/065 secondary — UC-065 Agentic Asset Management is now a demonstrated fleet capability, not just a badge; patent angle: live twin fleet + MCP multi-source RCA + self-tightening detection + quantified ROI, closed loop end to end |

**Presenter tip:** start Autonomous Mode with "auto-simulate field failures"
checked *before* you start talking — by the time you finish the opening
line, it will already have detected something, so you never have an awkward
silent wait on stage. Manually injecting a second fault on a different
fleet card while the first is resolving is the single most convincing 10
seconds of the whole demo — do it deliberately, don't leave it to chance.

---

## 📊 What the Evaluation Metrics panel actually measures

`GET /api/metrics` runs a held-out, paraphrased query set (12 queries, 4 per
failure mode, phrased differently from the seed ticket text) through:

1. **The RAG retriever** (`backend/rag.py` TF-IDF + cosine similarity)
2. **A naive keyword-overlap baseline** (`backend/metrics.py`) — the required
   baseline the battle plan calls out as non-negotiable for judge credibility

...and reports Precision@1, Recall@3, and RCA pipeline latency P50/P95/P99
computed from real runs in the current session — not hardcoded numbers.

---

## 🔑 Key Features

- **💬 ARIA (Autonomous RCA Intelligence Assistant)** — a chat widget (bottom-right, click the floating button) where you can ask plain-language questions like *"what happened?"*, *"why did MC-2201-001 fail?"*, *"how many incidents this session?"*, or *"has it optimized any thresholds?"*. Grounded entirely in the same live fleet state and autonomous-agent log as the rest of the dashboard — Gemini-optional with a rule-based fallback, same reliability pattern as the main RCA pipeline.

- **🏭 Fleet monitoring (4 assets, concurrent)** — GOH-UC-065 Agentic Asset Management stops being a badge and becomes real: 4 independent digital twins across 4 plants, the autonomous agent detects, diagnoses, fixes, and validates on multiple machines *at the same time*, and a fleet-wide lesson (threshold tightening) propagates to every asset, not just the one that failed
- **💰 Live ROI / business-impact calculator** — every resolved incident converts into real dollars (downtime avoided + engineer time saved) computed from what actually happened in *this session*, not a slide estimate. Assumptions are stated and adjustable in `backend/metrics.py`
- **🤖 Autonomous closed-loop agent** (`backend/autonomous.py`) — one click and the system detects, diagnoses, fixes, validates, and optimizes itself with a live narrated log; this is the single feature most likely to win the room, because nobody else in the room will have a system that visibly fixes itself
- **Self-tightening detection** — after a failure mode recurs, the agent automatically tightens its own anomaly threshold for that signal, fleet-wide; a genuinely adaptive loop, not a slide claim
- **Real-time Digital Twin** — simulated MC-2201 industrial motor controller with 6 live signals, ×4 independent assets
- **Hybrid Anomaly Detection** — rule-based thresholds + rolling z-score statistics with a variance floor (prevents cold-start false positives — tested under concurrent fleet load), fully explainable, zero ML dependency
- **4-Tool MCP Agent** — ticket search, BOM lookup, design-doc RAG, past-fix retrieval, orchestrated with a visible reasoning trace (drivable manually too, for judges who want to audit one stage)
- **Hallucination Guard** — synthesis is grounded only in retrieved tool output; every claim cites a real ID
- **Gemini-Optional** — richer LLM narrative if `GEMINI_API_KEY` is set; deterministic rule-based fallback otherwise — the demo never breaks
- **Defensible Metrics** — precision/recall@k vs. a real keyword-search baseline, computed live
- **Offline-First** — `pip install flask requests` and it runs; no vector DB server, no GPU, no cloud account required
- **Real MCP Protocol Path** — `mcp_stdio_server.py` exposes the same 4 tools over the official MCP SDK for Claude Desktop, if you want to show true protocol compliance

### Fleet API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/fleet` | GET | Status + headline anomaly for all 4 assets, for the Fleet Overview grid |
| `/api/telemetry?asset_id=...` | GET | Per-asset telemetry (defaults to the first fleet asset if omitted) |
| `/api/inject_fault` | POST `{"asset_id": "...", "failure_mode": "..."}` | Inject a fault on a specific asset |
| `/api/apply_fix` | POST `{"asset_id": "..."}` | Apply the fix on a specific asset |
| `/api/reset` | POST | Reset the entire fleet + autonomous agent + thresholds |
| `/api/roi` | GET | Live business-impact numbers computed from this session's resolved incidents |

### Autonomous Mode API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/autonomous/start` | POST `{"auto_inject": true}` | Engage the closed loop. `auto_inject` keeps the demo alive by injecting a random fault if the twin has been nominal for ~18s |
| `/api/autonomous/stop` | POST | Disengage, return to manual control |
| `/api/autonomous/status` | GET | Current state (`MONITORING`/`DETECTED`/`DIAGNOSING`/`FIXING`/`VALIDATING`/`OPTIMIZING`), full narrated log, resolved-incident counts |
| `/api/autonomous/clear_log` | POST | Clear the log without stopping |

---

## 🏢 Business Alignment

**GOH-UC-034 (Primary) — AI Agent for Root Cause Analysis and Process
Optimization:** the autonomous closed loop *is* this use case, literally —
detect, diagnose, fix, validate, optimize, with no human step required.

**GOH-UC-010 — Predictive Maintenance:** the hybrid rule + statistical
detector plus self-tightening thresholds move detection earlier over time.

**GOH-UC-046 — Fault Detection:** rule-based + rolling z-score hybrid engine,
explainable per-signal, live on the dashboard.

**GOH-UC-065 — Agentic Asset Management:** the twin doesn't just report on
the asset, it acts on it — applying and validating fixes autonomously.

**Big Bets — Energy & Automation, Digital Manufacturing:** industrial
systems monitoring at scale, preventing downtime (traditional RCA: 2-3 weeks
→ EI-Nexus: under 90 seconds), design feedback loop preventing repeat
failures fleet-wide.

**Patent angle:** live digital twin + MCP-agent multi-source reasoning for
field-failure-to-design-root-cause tracing, closed by an autonomous
fix-validate-optimize loop with enforced citation grounding, is a novel
enough combination to be worth an IP filing conversation.

---

## 🛠️ Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Digital Twin | Pure Python simulation | Zero dependency, deterministic, fast to reset live on stage |
| Anomaly Detection | Rule-based + rolling z-score | Explainable to judges in one sentence; swappable for sklearn IsolationForest later |
| RAG Retrieval | Hand-rolled TF-IDF + cosine similarity (numpy-free) | Fully offline, transparent, defensible — no vector DB server needed for a 24h hack |
| MCP Orchestration | Custom Python agent loop (`backend/mcp_server.py`) + optional real MCP SDK server (`mcp_stdio_server.py`) | Live reasoning trace is the wow moment; real MCP path for protocol-compliance credibility |
| LLM Synthesis | Google Gemini (optional) via REST, `requests` | Free-tier friendly, graceful offline fallback |
| API Layer | Flask | Ships with two dependencies, zero build step |
| UI Dashboard | Vanilla JS + Chart.js (CDN) | No npm/build toolchain required to run the demo anywhere |
| Data | JSON knowledge base (tickets, BOM, design docs, fixes) | 60 tickets / 4 BOM specs / 6 design docs / 12 fixes, regenerable via `scripts/generate_tickets.py` |

---

## 🗺️ Roadmap (for the "vision" slide)

- Real vector DB (FAISS/Chroma) + BGE-M3 embeddings for fleet-scale retrieval
- Multi-machine fleet view with cross-asset failure-pattern clustering
- SAP/CMMS integration for ticket ingestion
- Engineering chat copilot layered over the same 4 MCP tools
- Autonomous MCP agent that opens design-change-request tickets automatically
- Cloud deployment + alerting

---

## 📚 Full Documentation Index

| Document | What's in it |
|---|---|
| `docs/DESIGN_DOC.md` | Full technical design — architecture, data model, behavioral views, all 6 UML diagrams |
| `docs/SDLC_OVERVIEW.md` | Methodology, sprint structure, phase-by-phase artifact map |
| `docs/adr/ARCHITECTURE_DECISIONS.md` | Why each key technical decision was made, including the bugs found and fixed |
| `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` | Use case → feature → code → test, for every GOH-UC claim |
| `docs/TEST_PLAN.md` | Full test case matrix and stress-test log |
| `docs/openapi.yaml` | Formal API contract, all 20 endpoints |
| `CHANGELOG.md` | Version-by-version history of what changed and why |
| `DEPLOYMENT_GUIDE.md` | Step-by-step GCP / Azure / AWS deployment instructions |
| `tests/test_api.py` | Automated integration test suite (`python -m unittest discover tests`) |
| `PITCH_BRIEF.md` | One-page pitch summary |
| `DEMO_GUIDE.md` | Pre-demo checklist + live demo script |

## 👥 Team

**Project:** EI-Nexus — Root-Cause Intelligence Twin
**Event:** LTTS OpenHack 2026 (July 9–10)
**Theme:** Engineering Intelligence

---

*"We built an Engineering Intelligence system that doesn't just detect and
fix system failures — it explains WHY they happen, cites its evidence, and
feeds that insight back to the design team."*
#   E I - N E X U S  
 