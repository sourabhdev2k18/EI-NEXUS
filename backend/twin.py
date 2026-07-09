"""
Digital Twin — simulates an industrial motor-controller asset streaming live
telemetry: temperature, vibration, load, voltage, current, fan_speed.

Supports fault injection (matching the 4 failure modes in data/failure_modes.json)
and auto-fix application, so the dashboard can demonstrate detect -> explain -> fix
in real time.
"""
import time
import random
import threading
from collections import deque

random.seed()

BASELINE = {
    "temperature": 55.0,   # C
    "vibration": 1.2,      # mm/s RMS
    "load": 62.0,          # %
    "voltage": 400.0,      # V DC bus
    "current": 28.0,       # A
    "fan_speed": 45.0,     # %
}

FAULT_PROFILES = {
    "OVERTEMP": {"signal": "temperature", "target": 108.0, "rate": 2.4},
    "VIBRATION": {"signal": "vibration", "target": 6.8, "rate": 0.22},
    "VOLTAGE": {"signal": "voltage", "target": 195.0, "rate": -3.5},
    "CURRENT": {"signal": "current", "target": 46.0, "rate": 0.9},
}

HISTORY_LEN = 120  # keep last N ticks for charting


class DigitalTwin:
    def __init__(self, asset_id="MC-2201-001", site="Plant A - Pune", asset_type="Motor Controller"):
        self.asset_id = asset_id
        self.site = site
        self.asset_type = asset_type
        self.lock = threading.Lock()
        self.state = dict(BASELINE)
        self.active_fault = None       # failure_mode key or None
        self.fault_elapsed = 0
        self.auto_fix_applied = False
        self.fix_progress = 0.0
        self.history = deque(maxlen=HISTORY_LEN)
        self.tick_count = 0
        self.status = "NOMINAL"        # NOMINAL | WARNING | CRITICAL | RECOVERING
        self._seed_history()

    def _seed_history(self):
        for _ in range(30):
            self._advance(record=True)

    def inject_fault(self, mode_key: str):
        with self.lock:
            if mode_key not in FAULT_PROFILES:
                return False
            self.active_fault = mode_key
            self.fault_elapsed = 0
            self.auto_fix_applied = False
            self.fix_progress = 0.0
            self.status = "WARNING"
            return True

    def apply_fix(self):
        with self.lock:
            if self.active_fault is None:
                return False
            self.auto_fix_applied = True
            self.fix_progress = 0.0
            self.status = "RECOVERING"
            return True

    def reset(self):
        with self.lock:
            self.state = dict(BASELINE)
            self.active_fault = None
            self.fault_elapsed = 0
            self.auto_fix_applied = False
            self.fix_progress = 0.0
            self.status = "NOMINAL"
            self.history.clear()
            self._seed_history()

    def _advance(self, record=True):
        # organic baseline noise
        for k, base in BASELINE.items():
            noise = random.uniform(-0.02, 0.02) * base
            self.state[k] += noise
            # pull gently back toward baseline
            self.state[k] += (base - self.state[k]) * 0.05

        if self.active_fault and not self.auto_fix_applied:
            profile = FAULT_PROFILES[self.active_fault]
            sig = profile["signal"]
            target = profile["target"]
            rate = profile["rate"]
            self.state[sig] += rate * random.uniform(0.6, 1.0)
            # clamp toward target so it doesn't run away indefinitely
            if rate > 0:
                self.state[sig] = min(self.state[sig], target)
            else:
                self.state[sig] = max(self.state[sig], target)
            self.fault_elapsed += 1
            if abs(self.state[sig] - target) < 0.5:
                self.status = "CRITICAL"
            else:
                self.status = "WARNING"

        elif self.active_fault and self.auto_fix_applied:
            profile = FAULT_PROFILES[self.active_fault]
            sig = profile["signal"]
            base = BASELINE[sig]
            self.state[sig] += (base - self.state[sig]) * 0.18
            self.fix_progress = min(1.0, self.fix_progress + 0.06)
            if self.fix_progress >= 1.0 and abs(self.state[sig] - base) < base * 0.03:
                self.status = "NOMINAL"
                self.active_fault = None
                self.fault_elapsed = 0
                self.auto_fix_applied = False
            else:
                self.status = "RECOVERING"

        # fan speed reacts to temperature
        self.state["fan_speed"] = min(100.0, max(20.0, (self.state["temperature"] - 30) * 1.4))

        self.tick_count += 1
        if record:
            snapshot = {"t": self.tick_count, **{k: round(v, 2) for k, v in self.state.items()}}
            self.history.append(snapshot)

    def tick(self):
        with self.lock:
            self._advance(record=True)

    def snapshot(self):
        with self.lock:
            return {
                "asset_id": self.asset_id,
                "site": self.site,
                "asset_type": self.asset_type,
                "state": {k: round(v, 2) for k, v in self.state.items()},
                "active_fault": self.active_fault,
                "status": self.status,
                "fix_progress": round(self.fix_progress, 2),
                "history": list(self.history),
                "tick": self.tick_count,
            }


FLEET_ROSTER = [
    {"asset_id": "MC-2201-001", "site": "Plant A - Pune",        "asset_type": "Motor Controller"},
    {"asset_id": "MC-2201-007", "site": "Plant B - Chennai",     "asset_type": "Motor Controller"},
    {"asset_id": "MC-2201-013", "site": "Plant C - Coimbatore",  "asset_type": "Motor Controller"},
    {"asset_id": "MC-2201-019", "site": "Plant E - Bangalore",   "asset_type": "Motor Controller"},
]


class Fleet:
    """Manages N independent DigitalTwin instances for the multi-asset demo
    (GOH-UC-065 Agentic Asset Management) — the autonomous agent monitors
    and acts across the whole fleet concurrently, not just one machine."""

    def __init__(self, roster):
        self.assets = {
            r["asset_id"]: DigitalTwin(asset_id=r["asset_id"], site=r["site"], asset_type=r["asset_type"])
            for r in roster
        }
        self.roster = roster

    def get(self, asset_id):
        return self.assets.get(asset_id)

    def default_asset_id(self):
        return self.roster[0]["asset_id"]

    def tick_all(self):
        for t in self.assets.values():
            t.tick()

    def fleet_snapshot(self):
        return [t.snapshot() for t in self.assets.values()]


fleet = Fleet(FLEET_ROSTER)
twin = fleet.get(fleet.default_asset_id())  # backward-compatible single-asset alias


def background_loop(interval=1.0):
    while True:
        fleet.tick_all()
        time.sleep(interval)


def start_background_thread():
    t = threading.Thread(target=background_loop, daemon=True)
    t.start()
    return t
