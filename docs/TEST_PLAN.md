# EI-Nexus — Test Plan

Complements `DESIGN_DOC.md` §13 with the full test case matrix and an
execution log of what was actually run, not just what's theoretically
covered.

## Test Levels

| Level | Scope | Tooling |
|---|---|---|
| Unit | Individual functions (RAG scoring, ROI math, threshold tightening) | Direct Python invocation, `python3 -c` snippets |
| Integration | API endpoints, end-to-end request/response | Flask test client (`app.test_client()`) + live HTTP via `curl` |
| System / E2E | Full user flows through the actual browser UI | Playwright (headless Chromium) |
| Concurrency / Stress | Multiple simultaneous incidents across the fleet | Timed multi-asset fault injection scripts |
| Regression | Every pre-existing route/flow after each new feature | Full suite re-run before/after every structural change |

## Test Case Matrix

| ID | Description | Level | Result |
|---|---|---|---|
| TC-01 | All 20 API routes return 200 on a clean start | Integration | Pass |
| TC-02 | Fault injection sets `active_fault` and flips status to WARNING within a few ticks | Integration | Pass |
| TC-03 | Apply-fix drives telemetry back to nominal within ~20s | Integration | Pass |
| TC-04 | Manual RCA run returns non-empty citations, all IDs traceable to source data | Integration | Pass |
| TC-05 | RAG retriever precision@1/recall@3 exceeds naive keyword baseline on held-out queries | Unit | Pass (100%/100% vs. 83%/100%) |
| TC-06 | Autonomous mode completes a full MONITORING to OPTIMIZING cycle unattended | Integration | Pass |
| TC-07 | Two different assets handle incidents concurrently without blocking each other | Concurrency | Pass |
| TC-08 | Statistical-only anomaly on an untouched asset never spawns an incident | Concurrency | Pass (post-fix; see ADR-004) |
| TC-09 | Threshold tightens after 2nd occurrence of the same failure mode, fleet-wide | Integration | Pass |
| TC-10 | ROI figures are zero with no incidents, non-zero and consistent after a resolved incident | Integration | Pass |
| TC-11 | Gemini failure (bad key / quota / network) falls back to rule-based synthesis without error | Integration | Pass (reproduced with an actually-exhausted quota) |
| TC-12 | Gemini diagnostic (`/api/gemini_status`) surfaces the real HTTP status and error body | Integration | Pass |
| TC-13 | Reset clears live agent state and thresholds but preserves DB audit trail | Integration | Pass |
| TC-14 | Fleet grid, sensor tiles, and chart render correctly in a real browser | E2E | Pass |
| TC-15 | Chart.js CDN failure does not halt the rest of the dashboard script | E2E | Pass (post-fix) |
| TC-16 | ARIA panel opens, greets, answers suggestion chips and typed questions, closes | E2E | Pass (post-fix, see CHANGELOG 1.2.0) |
| TC-17 | ARIA answers correctly across all rule-based intents (what happened / why / count / asset-specific / fleet status / greeting / unknown) | Integration | Pass |
| TC-18 | ARIA "why" intent does not crash on log entries with `detail: null` | Integration | Pass (post-fix) |
| TC-19 | Resolved incidents and chat messages persist in SQLite and are readable by an independent process | Integration | Pass (verified via direct file inspection) |
| TC-20 | `backend/tools.py` public interface unchanged after DB migration — same variable names, same function signatures | Integration | Pass |
| TC-21 | Full regression suite (TC-01 through TC-14) still passes after adding ARIA | Regression | Pass |
| TC-22 | Full regression suite still passes after adding the SQLite layer | Regression | Pass |

## Stress Test Log (TC-07 / TC-08)

**Setup:** 4-asset fleet, autonomous mode engaged with `auto_inject: true`,
run for 75 continuous seconds, faults injected on multiple assets at
overlapping times.

**Before the ADR-004 fix:** statistical-only findings on untouched assets
occasionally spawned phantom incidents that "resolved" in ~1 second,
polluting the ROI ledger.

**After the fix:** re-ran the identical 75-second protocol. Zero false
positives. All resolved incidents traced to a genuine injected fault on the
correct asset, with realistic elapsed times (roughly 15-20s each, matching
the simulated fix-and-recover curve).

## Known Gaps / Not Yet Automated

- No formal CI pipeline runs these tests automatically on every commit yet —
  see `.github/workflows/ci.yml` for a starter pipeline that runs the
  integration suite; extending it to run the Playwright E2E suite headless
  in CI is the natural next step (needs a Chromium install step in the
  runner).
- Load testing beyond 4 concurrent assets has not been performed — the
  30-day roadmap's move to a real vector DB would be the point to revisit
  this at higher scale.
