"""
EI-Nexus RCA — entry point.

Usage:
    python3 run.py

Then open http://localhost:8000
"""
import os
import sys

# Load .env if present (no external dependency — tiny inline loader)
def _load_dotenv(path=".env"):
    if not os.path.exists(path):
        return
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value

_load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app  # noqa: E402
from backend import twin as twin_mod  # noqa: E402

if __name__ == "__main__":
    twin_mod.start_background_thread()
    port = int(os.environ.get("PORT", 8000))
    print(f"\n  EI-Nexus RCA running at http://localhost:{port}\n")
    print(f"  Gemini synthesis: {'ENABLED' if os.environ.get('GEMINI_API_KEY') else 'offline rule-based fallback (no key set)'}\n")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
