# Software Development Life Cycle (SDLC) — EI-Nexus

This document ties together the process artifacts scattered across the repo
into one coherent SDLC narrative: what methodology was followed, what
artifact exists for each phase, and where to find it.

## Methodology: Compressed Agile / Sprint-Based

Given the hackathon's fixed timeline, the team ran 5 short, strictly-scoped
sprints (Sprint 0-4), each ending in a working, demoable increment —
tracked live on the project's own Kanban board (`sprint_board/index.html`,
also usable as a live artifact during judging).

```
Sprint 0          Sprint 1          Sprint 2          Sprint 3          Sprint 4
Ideation &   ->   Core          ->  MCP Agent    ->   Autonomous   ->   Harden &
Scoping           Simulation        + RAG             Loop              Demo-Ready
```

| Phase | Artifact | Location |
|---|---|---|
| **Requirements** | Use-case alignment (GOH-UC-034/010/046/065), positioning statement | `README.md` (Positioning section), `PITCH_BRIEF.md` |
| **Requirements** | Formal traceability from use case to feature to test | `docs/REQUIREMENTS_TRACEABILITY_MATRIX.md` |
| **Design** | System architecture, data model, behavioral views (UML) | `docs/DESIGN_DOC.md`, `docs/diagrams/` |
| **Design** | Key technical decisions and their reasoning | `docs/adr/ARCHITECTURE_DECISIONS.md` |
| **Design** | Formal API contract | `docs/openapi.yaml` |
| **Implementation** | Source code, organized by domain module | `backend/`, `frontend/`, `scripts/` |
| **Implementation** | Sprint-by-sprint task tracking | `sprint_board/index.html` |
| **Testing** | Test strategy and case matrix | `docs/TEST_PLAN.md` |
| **Testing** | Automated integration test suite | `tests/test_api.py` |
| **Testing** | Continuous Integration (runs tests + builds container on every push) | `.github/workflows/ci.yml` |
| **Deployment** | Containerization | `Dockerfile`, `docker-compose.yml`, `.dockerignore` |
| **Deployment** | Cloud deployment guides (GCP/Azure/AWS) | `DEPLOYMENT_GUIDE.md` |
| **Maintenance** | Version history, what changed and why | `CHANGELOG.md` |
| **Maintenance** | Live Q&A over the running system | ARIA (`backend/chatbot.py`) |

## What "done" meant for each sprint

A sprint wasn't considered closed until:
1. The feature worked end-to-end through the actual UI (not just unit-tested in isolation).
2. The full regression suite (`tests/test_api.py` plus manual browser checks) passed.
3. The relevant documentation (design doc section, ADR, or changelog entry) was updated in the same sprint — documentation was never a separate "phase 6" tacked on at the end.

## Defect Management

Two real defects were found during deliberate stress testing (not by
accident) and are documented end-to-end — discovery, root cause, fix,
re-verification — rather than silently patched:

- **ADR-004**: statistical detector false-positive under concurrent load.
- **CHANGELOG 1.2.0**: Chart.js CDN failure halting the entire dashboard script; ARIA script/DOM ordering bug.

Treating "we found and fixed a real bug" as a documented artifact, not
something to hide, is itself a deliberate SDLC/quality-culture choice.

## Environments

| Environment | Purpose | How to run |
|---|---|---|
| Local development | Day-to-day work, live demo | `python run.py` |
| CI | Automated verification on every push | GitHub Actions, see `.github/workflows/ci.yml` |
| Containerized (local parity check) | Verify the Docker image matches local behavior before cloud deployment | `docker compose up` |
| Cloud (planned) | Judge-accessible hosted demo | See `DEPLOYMENT_GUIDE.md` — GCP Cloud Run, Azure Container Apps, or AWS App Runner, whichever free credits become available |

## Traceability at a glance

```
Use Case (GOH-UC-034) -> Feature (autonomous agent) -> Code (backend/autonomous.py)
    -> Test (tests/test_api.py::TestAutonomousLoop) -> CI (.github/workflows/ci.yml)
    -> Demo script (DEMO_GUIDE.md) -> Pitch slide (EI-Nexus-Hackathon-Deck.pptx, slide 7)
```

Every claim made in the pitch deck or the demo can be walked backward
through this chain to the actual code that implements it and the test that
proves it — which is the point of writing this document at all.
