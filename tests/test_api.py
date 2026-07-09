"""
EI-Nexus integration test suite.

Uses only Python's stdlib `unittest` + Flask's built-in test client — zero
new dependency, consistent with the project's offline-first philosophy.
This is the automated backbone behind docs/TEST_PLAN.md; test IDs in
docstrings map directly to that document's Test Case Matrix.

Run locally:
    python -m unittest discover tests -v

Run in CI:
    see .github/workflows/ci.yml
"""
import os
import sys
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app
from backend import twin as twin_module
from backend import anomaly

# The digital twin only advances when its background tick thread is running
# (normally started by run.py). Tests need it too, or telemetry never moves
# and fault injection/fix/autonomous-cycle tests would hang or fail.
twin_module.start_background_thread()


class BaseTestCase(unittest.TestCase):
    """Shared setup: a fresh test client, fleet reset before each test so
    tests don't leak state into one another."""

    def setUp(self):
        self.client = app.test_client()
        self.client.post("/api/reset")
        # restore thresholds in case a previous test tightened them
        import importlib
        importlib.reload(anomaly)


class TestCoreRoutes(BaseTestCase):
    """TC-01: all routes return 200 on a clean start."""

    def test_all_get_routes_return_200(self):
        routes = [
            "/", "/api/fleet", "/api/telemetry", "/api/roi", "/api/metrics",
            "/api/tools", "/api/gemini_status", "/api/autonomous/status",
            "/api/rca_log", "/api/chat/history", "/api/db/stats",
            "/api/db/incidents/lifetime",
        ]
        for route in routes:
            with self.subTest(route=route):
                resp = self.client.get(route)
                self.assertEqual(resp.status_code, 200, f"{route} did not return 200")


class TestFaultInjectionAndFix(BaseTestCase):
    """TC-02, TC-03: manual fault injection and fix."""

    def test_inject_fault_sets_active_fault(self):
        resp = self.client.post("/api/inject_fault",
                                 json={"asset_id": "MC-2201-001", "failure_mode": "OVERTEMP"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()["ok"])

        telemetry = self.client.get("/api/telemetry?asset_id=MC-2201-001").get_json()
        self.assertEqual(telemetry["active_fault"], "OVERTEMP")

    def test_apply_fix_eventually_recovers(self):
        self.client.post("/api/inject_fault",
                          json={"asset_id": "MC-2201-001", "failure_mode": "OVERTEMP"})
        # let the temperature actually climb a bit first
        time.sleep(3)
        self.client.post("/api/apply_fix", json={"asset_id": "MC-2201-001"})

        recovered = False
        for _ in range(25):
            time.sleep(1.5)
            snap = self.client.get("/api/telemetry?asset_id=MC-2201-001").get_json()
            if snap["status"] == "NOMINAL" and snap["active_fault"] is None:
                recovered = True
                break
        self.assertTrue(recovered, "asset did not recover within the expected window")


class TestRCAAgent(BaseTestCase):
    """TC-04: manual RCA run returns grounded, cited results."""

    def test_analyze_rca_returns_citations(self):
        resp = self.client.post(
            "/api/analyze_rca",
            json={"query": "motor controller running hot and shut itself down", "use_llm": False},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["inferred_failure_mode"], "OVERTEMP")
        self.assertGreater(len(data["citations"]), 0, "RCA result must cite at least one source")
        self.assertFalse(data["llm_used"], "use_llm=False must not call Gemini")


class TestRetrievalEvaluation(BaseTestCase):
    """TC-05: RAG retriever beats the naive keyword baseline."""

    def test_rag_beats_baseline(self):
        resp = self.client.get("/api/metrics")
        data = resp.get_json()["retrieval_eval"]
        self.assertGreaterEqual(data["rag"]["precision_at_1"], data["baseline_keyword"]["precision_at_1"])


class TestAutonomousLoop(BaseTestCase):
    """TC-06, TC-07: full autonomous cycle, including concurrent multi-asset handling."""

    def test_full_autonomous_cycle_completes(self):
        self.client.post("/api/autonomous/start", json={"auto_inject": False})
        self.client.post("/api/inject_fault", json={"asset_id": "MC-2201-001", "failure_mode": "OVERTEMP"})

        resolved = False
        for _ in range(30):
            time.sleep(1.5)
            status = self.client.get("/api/autonomous/status").get_json()
            if status["state"] == "MONITORING" and status["resolved_incidents"]:
                resolved = True
                break
        self.assertTrue(resolved, "autonomous agent did not resolve the incident in time")
        self.client.post("/api/autonomous/stop")

    def test_concurrent_assets_do_not_block_each_other(self):
        self.client.post("/api/autonomous/start", json={"auto_inject": False})
        self.client.post("/api/inject_fault", json={"asset_id": "MC-2201-001", "failure_mode": "OVERTEMP"})
        self.client.post("/api/inject_fault", json={"asset_id": "MC-2201-013", "failure_mode": "CURRENT"})

        both_resolved = False
        for _ in range(35):
            time.sleep(1.5)
            status = self.client.get("/api/autonomous/status").get_json()
            assets_done = {i["asset_id"] for i in status["resolved_incidents"]}
            if {"MC-2201-001", "MC-2201-013"}.issubset(assets_done):
                both_resolved = True
                break
        self.assertTrue(both_resolved, "both concurrently-faulted assets should resolve independently")
        self.client.post("/api/autonomous/stop")


class TestROI(BaseTestCase):
    """TC-10: ROI is zero with no incidents."""

    def test_roi_zero_with_no_incidents(self):
        resp = self.client.get("/api/roi")
        data = resp.get_json()
        self.assertEqual(data["incidents_resolved"], 0)
        self.assertEqual(data["total_savings_usd"], 0)


class TestGeminiFallback(BaseTestCase):
    """TC-11, TC-12: Gemini absence/failure never breaks the pipeline, and is diagnosable."""

    def test_no_key_falls_back_cleanly(self):
        status = self.client.get("/api/gemini_status").get_json()
        if not status["gemini_configured"]:
            resp = self.client.post(
                "/api/analyze_rca",
                json={"query": "vibration on startup", "use_llm": True},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertFalse(resp.get_json()["llm_used"])


class TestResetPreservesAuditTrail(BaseTestCase):
    """TC-13: reset clears live state but the DB audit trail is untouched."""

    def test_reset_does_not_wipe_db_history(self):
        before = self.client.get("/api/db/incidents/lifetime").get_json()["total_count"]
        self.client.post("/api/reset")
        after = self.client.get("/api/db/incidents/lifetime").get_json()["total_count"]
        self.assertEqual(before, after, "reset must not delete the durable incident history")


class TestARIA(BaseTestCase):
    """TC-16, TC-17, TC-18: ARIA chatbot answers across intents without crashing."""

    def test_aria_answers_common_intents(self):
        questions = [
            "hello", "what happened?", "fleet status?",
            "how many incidents this session?", "why did it fail?",
            "has it optimized any thresholds?", "gibberish nonsense xyzzy",
        ]
        for q in questions:
            with self.subTest(question=q):
                resp = self.client.post("/api/chat", json={"message": q, "use_llm": False})
                self.assertEqual(resp.status_code, 200)
                reply = resp.get_json()["reply"]
                self.assertIsInstance(reply, str)
                self.assertGreater(len(reply), 0)

    def test_aria_handles_unknown_asset_gracefully(self):
        resp = self.client.post("/api/chat", json={"message": "tell me about MC-2201-999", "use_llm": False})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("don't have an asset", resp.get_json()["reply"])


class TestDatabaseLayer(BaseTestCase):
    """TC-19, TC-20: DB persistence and unchanged tools.py interface."""

    def test_tools_interface_unchanged(self):
        from backend import tools
        self.assertTrue(hasattr(tools, "TICKETS"))
        self.assertTrue(hasattr(tools, "BOM_SPECS"))
        self.assertTrue(hasattr(tools, "DESIGN_DOCS"))
        self.assertTrue(hasattr(tools, "PAST_FIXES"))
        self.assertEqual(len(tools.TICKETS), 60)

    def test_incident_persists_to_db(self):
        self.client.post("/api/autonomous/start", json={"auto_inject": False})
        self.client.post("/api/inject_fault", json={"asset_id": "MC-2201-007", "failure_mode": "VIBRATION"})
        for _ in range(30):
            time.sleep(1.5)
            status = self.client.get("/api/autonomous/status").get_json()
            if status["resolved_incidents"]:
                break
        self.client.post("/api/autonomous/stop")

        db_stats = self.client.get("/api/db/stats").get_json()
        self.assertGreaterEqual(db_stats["resolved_incidents"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
