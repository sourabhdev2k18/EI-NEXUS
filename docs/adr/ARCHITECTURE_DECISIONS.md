# Architecture Decision Records (ADR)

Short, dated records of the significant technical decisions made on this
project and the reasoning behind them — so a reviewer (or a judge asking
"why did you choose X") gets the actual reasoning, not a guess.

Format: **Context → Decision → Consequences**, one per decision, newest last.

---

## ADR-001 — TF-IDF instead of embeddings for RAG retrieval

**Context:** The 4-tool MCP agent needs to retrieve similar tickets, design
docs, and past fixes from free-text queries. Standard 2025-era practice is
dense embeddings + a vector database (FAISS/Chroma/Pinecone).

**Decision:** Implement TF-IDF + cosine similarity from scratch
(`backend/rag.py`), with zero ML dependency — no sklearn, no
sentence-transformers, no vector DB server.

**Consequences:**
- ✅ Fully offline, zero external service, zero GPU.
- ✅ Every similarity score is explainable in one sentence to a judge or reviewer.
- ✅ Sufficient recall at this corpus size (60 tickets, 6 design docs) — measured
  at 100% precision@1 / 100% recall@3 vs. an 83%/100% naive keyword baseline.
- ⚠️ Will not scale gracefully to a corpus of thousands of documents with
  paraphrased/synonym-heavy queries — bag-of-words has a real ceiling.
- **Revisit when:** corpus exceeds roughly 500-1000 documents, or retrieval
  quality on paraphrased queries drops below an acceptable threshold. The
  `search(query, top_k)` interface is designed so an embeddings-backed
  retriever is a drop-in replacement behind the same call signature.

---

## ADR-002 — Rule + statistical hybrid detector instead of a trained ML model

**Context:** Anomaly detection could use a trained model (IsolationForest,
autoencoder, etc.) for potentially higher recall on subtle drift.

**Decision:** Use hard rule thresholds + a rolling z-score statistical layer
(`backend/anomaly.py`), combined into one confidence score.

**Consequences:**
- ✅ Zero training data / training step required — works from process start.
- ✅ Every detection is explainable: "value X crossed threshold Y" or "value X
  is Z standard deviations from the recent mean."
- ✅ Forced us to reason carefully about statistical edge cases (see ADR-004).
- ⚠️ Less sensitive to complex multivariate failure signatures a trained
  model might catch (e.g., a *combination* of signals that's individually
  normal but jointly anomalous).
- **Revisit when:** the failure taxonomy grows beyond simple single-signal
  threshold crossings, or real sensor data with more complex noise
  characteristics is available to train on.

---

## ADR-003 — In-process orchestrator for MCP, with a real MCP SDK path kept separate

**Context:** "MCP" can mean the architectural pattern (a tool-calling agent
loop) or the literal Model Context Protocol SDK/wire format.

**Decision:** The web dashboard uses a lightweight in-process orchestrator
(`backend/mcp_server.py`) for zero-setup operation. A separate file,
`mcp_stdio_server.py`, exposes the *same* 4 tools over the real MCP SDK
(stdio transport) for use with Claude Desktop or any MCP client.

**Consequences:**
- ✅ The primary demo path has zero extra dependency and starts instantly.
- ✅ Protocol compliance is still demonstrable on request, without
  restructuring the tools themselves — `backend/tools.py`'s functions are
  already MCP-shaped (name, description, schema, callable).
- ⚠️ Two code paths exist for "running the tools as MCP" — a maintenance
  cost, mitigated by both paths calling the exact same underlying tool
  functions in `tools.py`.

---

## ADR-004 — Actionability guard: never autonomously act on statistics alone

**Context:** During concurrency stress testing, the statistical detector
occasionally false-triggered on ordinary baseline noise for an untouched
asset (root cause: a trailing window with near-zero variance inflating the
z-score denominator). Because no real fault was active, `apply_fix()`
silently no-op'd and the agent "resolved" a phantom incident in ~1 second,
corrupting the ROI ledger with a fake event.

**Decision:** Two-layer fix:
1. A variance floor in `zscore_confidence()` (`stdev = max(raw_stdev, mean*0.015, 0.05)`).
2. A structural guard in `autonomous.py` — the closed loop only ever spawns a
   full incident episode on a **rule-triggered** finding. Statistics-only
   findings are surfaced for visibility in `/api/telemetry` but are
   structurally incapable of triggering an autonomous fix.

**Consequences:**
- ✅ Verified via a 75-second concurrent fleet stress test: zero false
  positives afterward.
- ✅ Defense in depth — even if the statistical layer misfires again in the
  future for an unrelated reason, it cannot corrupt the ROI ledger or the
  demo narrative, because it structurally has no write path to "fix"
  anything on its own.
- This is documented in detail in `DESIGN_DOC.md` §6.2 as a case study,
  specifically because catching your own bug and showing the fix is a
  stronger credibility signal than never mentioning it.

---

## ADR-005 — SQLite instead of a managed database service

**Context:** The knowledge base (tickets, BOM, design docs, fixes) and the
new persistent audit trail (resolved incidents, chat history) need a real
schema and query layer, not just JSON files loaded into memory.

**Decision:** Use SQLite (Python's `sqlite3` stdlib module) as an embedded,
file-based relational database — no new pip dependency, no external DB
server, WAL mode enabled for safe concurrent reads during a write.

**Consequences:**
- ✅ Real SQL schema with primary keys, indexes, and `failure_mode_link`
  foreign-key-style relationships — genuine relational modeling, not a
  cosmetic label on top of JSON.
- ✅ Zero new dependency, zero configuration, zero external service — keeps
  the offline-first, zero-account-needed demo story intact.
- ✅ Resolved incidents and chat history now durably survive a process
  restart — previously these lived only in memory and were lost on
  restart. This is a genuine capability upgrade, not just a migration.
- ⚠️ SQLite's single-file model does not survive horizontal scaling across
  multiple server instances / ephemeral container filesystems without a
  mounted persistent volume — a known, documented limitation.
- **Revisit when:** deploying to a multi-instance or fully serverless/
  ephemeral cloud target — migrate to a managed relational database
  (Cloud SQL / Azure SQL / Amazon RDS), a change isolated almost entirely
  to `backend/db.py`'s connection layer. See `DEPLOYMENT_GUIDE.md`.

---

## ADR-006 — ARIA as a separate read-only module, not baked into the agent

**Context:** Users want a conversational Q&A interface over the same fleet
state and incident history the dashboard already shows.

**Decision:** Implement ARIA (`backend/chatbot.py`) as a module that only
*reads* existing state (twin snapshots, autonomous agent log/history, the
knowledge base) — it has no write path into the twin, the autonomous
agent, or the underlying data.

**Consequences:**
- ✅ Structurally impossible for a chat question to accidentally trigger a
  fault injection, a fix, or a threshold change — the blast radius of a bug
  in the chat layer is contained to "gives a wrong answer," never "corrupts
  system state."
- ✅ Added without modifying a single existing function signature or route —
  verified via a full regression pass (all pre-existing endpoints and UI
  flows re-tested before and after).
- Same reliability pattern as the main RCA pipeline: Gemini-optional,
  deterministic rule-based fallback, never a dead end.
