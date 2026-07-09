# EI-Nexus — Autonomous Engineering Intelligence Twin (AEIT)
### Team MCP Mavericks · LTTS OpenHack 2026

---

## The one-liner

> An agentic AI-powered digital twin that autonomously monitors industrial
> assets, predicts failures, performs root-cause analysis, orchestrates
> corrective actions using AI agents, validates recovery, and continuously
> optimizes operational performance — across an entire fleet, not one machine.

---

## The problem

Modern industrial environments generate enormous volumes of telemetry,
engineering drawings, maintenance records, BOMs, historical service tickets,
and operational documents — but this information sits in disconnected
systems. Engineers can't diagnose failures quickly or accurately, which
means: unplanned downtime, high maintenance cost, delayed troubleshooting,
increased MTTR, reduced equipment reliability, lost operational efficiency.

## The solution

EI-Nexus combines **digital twin technology, generative AI, Retrieval-
Augmented Generation, MCP tool orchestration, and predictive analytics** to
continuously monitor a fleet of industrial assets, detect anomalies,
identify root cause, and act on it — before a human has to. It transforms
reactive maintenance into an autonomous, self-improving loop, acting as an
AI Engineering Copilot for the maintenance team.

```
MONITOR → DETECT → DIAGNOSE → FIX → VALIDATE → OPTIMIZE → (loop)
```

## What makes it different from every other predictive-maintenance demo

Most predictive-maintenance projects stop at "here's a live sensor value."
EI-Nexus goes further by actually closing the loop:

| Capability | What it means in the demo |
|---|---|
| **4-tool MCP agent** | Ticket search + BOM lookup + design-doc RAG + past-fix retrieval, live reasoning trace, every claim cited to a real ID (no hallucination) |
| **Autonomous fix** | The agent applies the fix itself — no human clicks "approve" |
| **Validated recovery** | The agent re-checks telemetry and confirms the fix actually worked |
| **Self-tightening detection** | After a repeat incident, the agent tightens its own threshold — fleet-wide — so every asset catches it earlier next time |
| **Fleet-scale** | 4 independent assets monitored and acted on concurrently, not a single demo machine |
| **Live ROI** | Every resolved incident converts into real dollars saved, computed from the session, not a slide claim |
| **Gemini-optional** | Richer LLM synthesis if configured; deterministic offline fallback so the demo never breaks |

## Use case alignment

- **Primary:** GOH-UC-034 — AI Agent for Root Cause Analysis and Process Optimization
- **Secondary:** GOH-UC-010 Predictive Maintenance · GOH-UC-046 Fault Detection · GOH-UC-065 Agentic Asset Management
- **Big Bets:** Energy & Automation · Digital Manufacturing

## Architecture at a glance

- **Digital Twin** — Python simulation, 4 independent assets, 6 live signals each
- **Detection** — hybrid rule-based thresholds + rolling z-score statistics (explainable, zero heavy ML dependency)
- **RAG retrieval** — hand-rolled TF-IDF + cosine similarity (offline, transparent, defensible under judge questioning)
- **MCP orchestration** — 4 tools with a real MCP-protocol path (`mcp_stdio_server.py`, connectable to Claude Desktop)
- **LLM synthesis** — Google Gemini (optional) with a grounded rule-based fallback
- **Frontend** — single-page dashboard, no build toolchain, runs anywhere

## Evaluation (computed live, not hardcoded)

- RAG retriever precision@1 / recall@3 vs. a naive keyword-search baseline
- RCA pipeline latency P50/P95/P99
- Live ROI: downtime hours avoided, engineer hours saved, total dollars saved — from this session's actual resolved incidents

## Roadmap

Multi-machine fleet monitoring at true scale · factory-wide digital twin ·
time-series database · ML-based anomaly detection · computer-vision
inspection · voice-enabled AI maintenance assistant · autonomous maintenance
scheduling · mobile app for field engineers.

## Patent angle

Live digital-twin fleet + MCP-agent multi-source reasoning for
field-failure-to-design-root-cause tracing, closed by an autonomous
fix-validate-optimize loop with enforced citation grounding and fleet-wide
threshold learning — a novel enough combination to be worth an IP filing
conversation.

---

*"We didn't just build a system that detects failures. We built one that
fixes them, proves the fix worked, and gets smarter every time it happens
again — across a whole fleet, with nobody touching the keyboard."*
