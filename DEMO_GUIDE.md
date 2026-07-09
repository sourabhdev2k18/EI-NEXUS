# EI-Nexus — Testing & Demo Guide
### Team MCP Mavericks · LTTS OpenHack 2026

---

## PART 1 — How to Run It

```powershell
cd "path\to\ei-nexus-rca"
pip install -r requirements.txt
python run.py
```

Open **http://localhost:8000**. You should immediately see 4 fleet cards, all
green (NOMINAL), with live-updating sensor tiles.

**Optional — enable Gemini synthesis:**
```powershell
copy .env.example .env
notepad .env
```
Paste `GEMINI_API_KEY=your_key_here`, save, close, then re-run `python run.py`.
Without this the system uses offline rule-based synthesis — nothing breaks
either way.

---

## PART 2 — Pre-Demo Test Checklist

**Run this once, 10–15 minutes before you present. Never discover a bug live.**

| # | Test | How | Expected Result |
|---|------|-----|------------------|
| 1 | **Fleet loads** | Just open the page | 4 cards: MC-2201-001 / 007 / 013 / 019, all NOMINAL |
| 2 | **Manual fault injection** | Select a fleet card → pick "Overtemperature" → click **Inject Fault** | Status badge flips to WARNING within a few seconds; chart shows temperature climbing |
| 3 | **Manual fix** | Click **Apply Auto-Fix** | Badge goes RECOVERING → NOMINAL within ~20 seconds; chart shows the recovery curve |
| 4 | **Manual RCA** | Click **Run 4-Tool MCP Agent** with a query like *"motor controller running hot and shut down"* | Trace streams in: ticket search → BOM lookup → design-doc RAG → past-fix retrieval → synthesis with citations |
| 5 | **Reset** | Click **Reset Fleet** | Everything back to NOMINAL, autonomous mode off, log cleared |
| 6 | **Autonomous mode** (the big one) | Check "auto-simulate," click **Engage Autonomous Mode** | Within ~20s: log shows a fault appear on its own, then DETECTED → DIAGNOSING → FIXING → VALIDATING → back to MONITORING |
| 7 | **Concurrent fleet handling** | While autonomous mode is running and one asset is mid-incident, manually inject a fault on a *different* card | Both cards show the pulsing "agent working" dot at the same time — confirm this works before relying on it live |
| 8 | **Self-optimization** | Let the same failure mode recur on an asset (don't reset in between) | Second time, an OPTIMIZING log entry appears saying it tightened the detection threshold |
| 9 | **ROI panel** | After 1–2 resolved incidents, check the Business Impact panel | A non-zero dollar figure appears |
| 10 | **Metrics panel** | Just check it loads | RAG precision/recall numbers appear, above the baseline |
| 11 | **Gemini status** (if key set) | Check the header dot | Says "Gemini connected" — if not, confirm `.env` has the key and you restarted `run.py` |
| 12 | **Full reset before walking on stage** | Click **Reset Fleet** one last time | Clean state, ROI back to 0, ready for a fresh run |

If anything fails here, fix it now — not during the pitch.

---

## PART 3 — What To Show, Mapped to Each Use Case

You have 4 use-case badges in the header — use each one as a checkpoint in
your pitch, not just decoration.

### 🎯 GOH-UC-034 (Primary) — AI Agent for RCA and Process Optimization
**Show:** Engage Autonomous Mode; let it detect, diagnose, fix, and validate on its own.
**Say:** *"This isn't a dashboard, it's an agent — watch, I'm not touching anything after this."*
**Point at:** the state-flow bar advancing live through all 6 stages.

### 📊 GOH-UC-010 — Predictive Maintenance
**Show:** The OPTIMIZING log entry that appears after a repeat incident.
**Say:** *"After the second time this failure happens, it tightens its own detection threshold — it catches the same problem earlier next time. That's predictive, not just reactive."*

### ⚠️ GOH-UC-046 — Fault Detection
**Show:** Manually inject a fault; point at the sensor tile turning amber/red in real time and the anomaly confidence score.
**Say:** *"Hybrid rule-based plus statistical detection — fully explainable, no black box."*

### 🏭 GOH-UC-065 — Agentic Asset Management
**Show:** The Fleet Overview grid, then trigger faults on **two different cards** so both resolve concurrently.
**Say:** *"It's not managing one machine, it's managing a fleet — watch, two incidents are being handled independently, at the same time, right now."*
This is your strongest visual moment. Practice the timing so it lands cleanly.

### 💰 Bonus — Business Impact (the judge-scoring moment)
**Show:** The ROI panel after 2+ resolved incidents.
**Say:** *"That's not a slide estimate — that dollar figure is computed from the incidents that just happened on this screen."*

---

## PART 4 — Suggested 5-Minute Demo Flow

| Time | Action |
|------|--------|
| 0:00 | Open on the Fleet grid — *"4 plants, one agent."* |
| 0:15 | Engage Autonomous Mode with auto-simulate on. |
| 0:30–1:30 | Narrate the log as the first incident resolves itself. |
| 1:30 | Manually inject a second fault on a different card mid-resolution — the concurrency moment. |
| 2:15 | Point at OPTIMIZING firing on a repeat failure mode. |
| 2:45 | Point at the ROI panel — real dollars. |
| 3:15 | Point at Evaluation Metrics — real precision/recall numbers, not claims. |
| 3:45 | Quick architecture-diagram walkthrough (from README) — 30 seconds max. |
| 4:30 | Close on use-case alignment + patent angle from `PITCH_BRIEF.md`. |

**Presenter tip:** start Autonomous Mode with "auto-simulate field failures"
checked *before* you start talking — by the time you finish the opening
line, it will already have detected something, so there's never an awkward
silent wait on stage.

---

## PART 5 — If Something Glitches On Stage

| Problem | Fix |
|---------|-----|
| Nothing detecting | Click **Reset Fleet**, then manually inject a fault instead of waiting — never stand there in silence |
| Gemini not responding | It silently falls back to rule-based synthesis — you likely won't even notice; keep talking |
| Browser looks frozen | Refresh the page — state lives server-side and survives; polling picks right back up |
| Judge asks "is this real data?" | Yes — point out the ROI assumptions are stated openly in the panel, and the metrics are computed live each time the page loads, not hardcoded |

---

*Keep this open on a second screen or your phone during the demo.*
