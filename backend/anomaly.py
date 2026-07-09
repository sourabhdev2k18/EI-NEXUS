"""
Hybrid anomaly detection: rule-based thresholds + rolling z-score statistical
detector. This plays the role the original brief called "Isolation Forest" —
implemented here as a transparent statistical alternative so the whole stack
runs with zero heavyweight ML dependencies. (Swapping in sklearn's
IsolationForest later is a drop-in change if sklearn is installed.)
"""
import statistics

THRESHOLDS = {
    "temperature": {"warning": 75.0, "critical": 95.0},
    "vibration": {"warning": 3.0, "critical": 5.0},
    "load": {"warning": 90.0, "critical": 98.0},
    "voltage": {"warning_low": 220.0, "critical_low": 200.0},
    "current": {"warning": 38.0, "critical": 44.0},
}

SIGNAL_TO_FAILURE_MODE = {
    "temperature": "OVERTEMP",
    "vibration": "VIBRATION",
    "voltage": "VOLTAGE",
    "current": "CURRENT",
}


def zscore_confidence(history, signal, current_value):
    """Rolling z-score against the signal's recent baseline window.
    Requires a reasonably-sized window before it will speak with any
    confidence — a handful of noisy samples on a freshly-started asset
    should never be enough to declare an incident. A stdev floor (as a
    fraction of the window mean) prevents the classic z-score blow-up where
    a normal-sized fluctuation looks huge only because the recent window
    happened to have near-zero variance."""
    values = [h[signal] for h in history[:-5]] if len(history) > 15 else [h[signal] for h in history]
    if len(values) < 15:
        return 0.0
    mean = statistics.mean(values)
    raw_stdev = statistics.pstdev(values)
    stdev = max(raw_stdev, abs(mean) * 0.015, 0.05)
    z = abs(current_value - mean) / stdev
    # squash into 0-1 confidence
    return min(1.0, z / 6.0)


def detect(snapshot):
    """
    Returns a list of anomaly findings, each with signal, severity, rule_triggered,
    statistical_confidence, combined_confidence, and inferred failure_mode.

    Trigger policy: a hard rule-threshold breach always counts. Statistics
    alone can only trigger a finding at a high bar (z > ~4.5) — high enough
    that ordinary baseline noise on an untouched asset won't false-positive
    into a phantom incident (which would otherwise have no real
    `active_fault` to fix and would "resolve" itself in a single tick,
    corrupting both the demo narrative and the ROI numbers).
    """
    state = snapshot["state"]
    history = snapshot["history"]
    findings = []
    STAT_ONLY_TRIGGER = 0.75

    for signal, thresh in THRESHOLDS.items():
        value = state.get(signal)
        if value is None:
            continue

        rule_triggered = None
        if "critical" in thresh and value >= thresh["critical"]:
            rule_triggered = "CRITICAL"
        elif "warning" in thresh and value >= thresh["warning"]:
            rule_triggered = "WARNING"
        elif "critical_low" in thresh and value <= thresh["critical_low"]:
            rule_triggered = "CRITICAL"
        elif "warning_low" in thresh and value <= thresh["warning_low"]:
            rule_triggered = "WARNING"

        stat_conf = zscore_confidence(history, signal, value)

        if rule_triggered or stat_conf > STAT_ONLY_TRIGGER:
            rule_conf = 0.9 if rule_triggered == "CRITICAL" else 0.6 if rule_triggered == "WARNING" else 0.0
            combined = round(min(1.0, 0.65 * rule_conf + 0.35 * stat_conf), 3)
            findings.append({
                "signal": signal,
                "value": value,
                "rule_triggered": rule_triggered,
                "statistical_confidence": round(stat_conf, 3),
                "combined_confidence": combined,
                "failure_mode": SIGNAL_TO_FAILURE_MODE.get(signal, "UNKNOWN"),
                "severity": rule_triggered or ("WARNING" if stat_conf > STAT_ONLY_TRIGGER else "INFO"),
            })

    findings.sort(key=lambda f: f["combined_confidence"], reverse=True)
    return findings
