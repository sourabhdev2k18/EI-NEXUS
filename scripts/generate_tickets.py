"""
Synthetic data generator for EI-Nexus RCA.
Generates realistic field failure tickets, BOM specs, design docs, and past fixes
for an industrial motor-controller digital twin (per LTTS OpenHack Big Bet 3/5/6 brief).

Run: python3 generate_tickets.py
Writes JSON files into ../data/
"""
import json
import random
import os

random.seed(42)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Failure mode taxonomy — each maps to a design root cause + fix + component
# ---------------------------------------------------------------------------
FAILURE_MODES = {
    "OVERTEMP": {
        "signal": "temperature",
        "symptoms": [
            "motor controller housing temperature exceeded 95C during sustained load",
            "thermal shutdown triggered after 40 minutes of continuous operation",
            "temperature sensor reported runaway heating with no plateau",
            "unit tripped on over-temperature fault code E-104 during peak shift",
            "heat sink surface temperature climbed steadily despite fan operation",
        ],
        "component": "MC-2201-HS (Heat Sink Assembly)",
        "root_cause": (
            "Heat sink fin density specified in design revision C is 18% below the "
            "thermal dissipation requirement for continuous duty cycles above 80% load. "
            "Thermal simulation used intermittent-duty assumptions, not continuous-duty."
        ),
        "fix": (
            "Replace heat sink with revision D (32-fin high-density design) and apply "
            "thermal interface material TIM-7 rated to 5.2 W/mK. Firmware fan-curve "
            "updated to trigger at 65C instead of 80C."
        ),
    },
    "VIBRATION": {
        "signal": "vibration",
        "symptoms": [
            "excessive vibration detected on bearing housing, RMS above 4.5 mm/s",
            "audible resonance and chatter reported by operator during startup ramp",
            "vibration sensor flagged harmonic spike at 2x rotational frequency",
            "coupling misalignment suspected after vibration trend increased over 3 weeks",
            "bearing failure occurred after prolonged high-vibration operation",
        ],
        "component": "MC-2201-BRG (Drive Shaft Bearing Set)",
        "root_cause": (
            "Bearing preload torque specification in the assembly drawing (12-15 Nm) is "
            "insufficient for the actual dynamic load profile measured in the field, "
            "which peaks 22% above the original design load case."
        ),
        "fix": (
            "Increase bearing preload torque to 18-20 Nm per updated spec ECN-4471, "
            "switch to C3-clearance bearings, and add vibration-isolation mount "
            "(rubber durometer 70A) between chassis and motor base."
        ),
    },
    "VOLTAGE": {
        "signal": "voltage",
        "symptoms": [
            "input voltage sag below 200V detected during motor start-up inrush",
            "voltage ripple exceeded 5% on DC bus causing intermittent resets",
            "under-voltage lockout triggered repeatedly during grid fluctuation events",
            "controller browned out and restarted unexpectedly during peak plant load",
            "voltage transient spike above 480V observed on capacitor bank",
        ],
        "component": "MC-2201-PSU (Power Supply / Capacitor Bank)",
        "root_cause": (
            "DC bus capacitor bank was sized for nominal 400V steady-state operation "
            "without margin for grid-side sag/swell events common in this plant's "
            "electrical environment (measured +/-12% variance vs +/-5% design assumption)."
        ),
        "fix": (
            "Upgrade capacitor bank to 450V-rated units with 20% additional bulk "
            "capacitance, add active PFC front-end, and widen under-voltage lockout "
            "band from 190-210V to 175-210V per ECN-4489."
        ),
    },
    "CURRENT": {
        "signal": "current",
        "symptoms": [
            "phase current imbalance of 14% detected across the three motor phases",
            "overcurrent trip triggered during load transition from 40% to 90%",
            "current sensor logged repeated spikes correlated with gearbox engagement",
            "winding current exceeded thermal-rated continuous current by 9%",
            "current draw increased gradually over 2 months, indicating winding degradation",
        ],
        "component": "MC-2201-WDG (Stator Winding Assembly)",
        "root_cause": (
            "Winding insulation class (Class F, 155C) is under-rated for the ambient "
            "plus thermal-rise profile observed in field deployments in high-ambient "
            "sites (ambient 45C+), accelerating insulation breakdown and current leakage."
        ),
        "fix": (
            "Upgrade to Class H (180C) insulation system, add current-imbalance "
            "protection threshold at 8% (down from 15%), and derate continuous "
            "current rating by 10% for ambient >40C sites per design bulletin DB-118."
        ),
    },
}

SITES = ["Plant A - Pune", "Plant B - Chennai", "Plant C - Coimbatore", "Plant D - Ahmedabad",
         "Plant E - Bangalore", "Plant F - Nashik"]
ASSETS = [f"MC-2201-{i:03d}" for i in range(1, 26)]
SEVERITIES = ["Low", "Medium", "High", "Critical"]

TICKETS = []
ticket_id = 1000

for i in range(60):
    mode_key = random.choice(list(FAILURE_MODES.keys()))
    mode = FAILURE_MODES[mode_key]
    symptom = random.choice(mode["symptoms"])
    severity = random.choices(SEVERITIES, weights=[15, 30, 35, 20])[0]
    downtime_hrs = round(random.uniform(1.5, 96), 1) if severity in ("High", "Critical") else round(random.uniform(0.5, 12), 1)
    ticket = {
        "ticket_id": f"TCK-{ticket_id}",
        "asset_id": random.choice(ASSETS),
        "site": random.choice(SITES),
        "failure_mode": mode_key,
        "severity": severity,
        "reported_date": f"2026-0{random.randint(1,6)}-{random.randint(1,28):02d}",
        "symptom_description": symptom,
        "downtime_hours": downtime_hrs,
        "component_flagged": mode["component"],
        "resolved": random.random() > 0.15,
    }
    TICKETS.append(ticket)
    ticket_id += 1

with open(os.path.join(OUT_DIR, "tickets.json"), "w") as f:
    json.dump(TICKETS, f, indent=2)

# ---------------------------------------------------------------------------
# BOM specs
# ---------------------------------------------------------------------------
BOM_SPECS = []
for mode_key, mode in FAILURE_MODES.items():
    BOM_SPECS.append({
        "component_id": mode["component"].split(" ")[0],
        "component_name": mode["component"],
        "failure_mode_link": mode_key,
        "design_spec_summary": mode["root_cause"],
        "current_revision": random.choice(["Rev C", "Rev D", "Rev B"]),
        "supplier": random.choice(["Nidec", "ABB Components", "Schneider Precision", "Rockwell Supply Co"]),
        "rated_tolerance": {
            "temperature": "operating -20C to 85C ambient" if mode_key == "OVERTEMP" else "n/a",
            "vibration": "IEC 60068-2-6 rated to 3.0 mm/s RMS" if mode_key == "VIBRATION" else "n/a",
            "voltage": "400V DC bus nominal, +/-5% design margin" if mode_key == "VOLTAGE" else "n/a",
            "current": "rated continuous 45A, Class F insulation" if mode_key == "CURRENT" else "n/a",
        },
    })

with open(os.path.join(OUT_DIR, "bom_specs.json"), "w") as f:
    json.dump(BOM_SPECS, f, indent=2)

# ---------------------------------------------------------------------------
# Design docs
# ---------------------------------------------------------------------------
DESIGN_DOCS = []
doc_id = 1
for mode_key, mode in FAILURE_MODES.items():
    DESIGN_DOCS.append({
        "doc_id": f"DD-{doc_id:03d}",
        "title": f"Design Guideline — {mode['component']}",
        "failure_mode_link": mode_key,
        "content": (
            f"Section 4.{doc_id}: {mode['component']} Design Rationale. "
            f"{mode['root_cause']} Recommended corrective design change: {mode['fix']} "
            f"This guideline supersedes the original design assumption documented in the "
            f"Rev B release and should be applied to all new builds and field retrofits."
        ),
        "revision": "2026-Q2",
    })
    doc_id += 1

# Add two general cross-cutting design docs
DESIGN_DOCS.append({
    "doc_id": f"DD-{doc_id:03d}",
    "title": "General Environmental Derating Guidelines",
    "failure_mode_link": "GENERAL",
    "content": (
        "All MC-2201 series controllers deployed in ambient conditions exceeding 40C, "
        "or in plants with grid voltage variance beyond +/-5%, or in high-vibration "
        "installations (near presses, stamping lines) require environmental derating "
        "per DB-118. Field engineers should check site ambient logs before RCA to "
        "rule out environmental root cause versus design defect."
    ),
    "revision": "2026-Q1",
})
doc_id += 1
DESIGN_DOCS.append({
    "doc_id": f"DD-{doc_id:03d}",
    "title": "Duty Cycle Classification Standard",
    "failure_mode_link": "GENERAL",
    "content": (
        "Design thermal and mechanical simulations for MC-2201 historically assumed "
        "S3 intermittent duty (40% ED). Field telemetry from 2025-2026 shows a growing "
        "share of continuous S1 duty deployments, which changes thermal and bearing "
        "load assumptions significantly and is the single largest source of repeat "
        "field failures traced back to design."
    ),
    "revision": "2026-Q1",
})

with open(os.path.join(OUT_DIR, "design_docs.json"), "w") as f:
    json.dump(DESIGN_DOCS, f, indent=2)

# ---------------------------------------------------------------------------
# Past fixes database
# ---------------------------------------------------------------------------
PAST_FIXES = []
fix_id = 1
for mode_key, mode in FAILURE_MODES.items():
    for variant in range(3):
        PAST_FIXES.append({
            "fix_id": f"FIX-{fix_id:03d}",
            "failure_mode_link": mode_key,
            "applied_to_ticket": f"TCK-{1000 + random.randint(0, 59)}",
            "fix_description": mode["fix"],
            "validated": True,
            "effectiveness_score": round(random.uniform(0.82, 0.98), 2),
            "date_applied": f"2026-0{random.randint(1,6)}-{random.randint(1,28):02d}",
        })
        fix_id += 1

with open(os.path.join(OUT_DIR, "past_fixes.json"), "w") as f:
    json.dump(PAST_FIXES, f, indent=2)

# Save the failure-mode taxonomy itself — the backend uses this as ground truth
with open(os.path.join(OUT_DIR, "failure_modes.json"), "w") as f:
    json.dump(FAILURE_MODES, f, indent=2)

print(f"Generated {len(TICKETS)} tickets, {len(BOM_SPECS)} BOM specs, "
      f"{len(DESIGN_DOCS)} design docs, {len(PAST_FIXES)} past fixes.")
