"""
EI-Nexus database layer — SQLite, zero external dependencies (sqlite3 is
Python stdlib), file-based, offline-first — consistent with the rest of the
project's architecture philosophy.

What moved from flat JSON into real SQL tables, and why:

  tickets, bom_specs, design_docs, past_fixes
      — the knowledge base the 4 MCP tools query. Now real tables with a
        primary key and a `failure_mode_link` foreign-key-style column,
        queried with actual SQL (see backend/tools.py), not just loaded
        into a Python list and filtered in a loop.

  resolved_incidents
      — NEW capability, not just a migration. Previously this only lived
        in AutonomousAgent's in-memory list and was lost on every restart.
        It's now a durable audit trail: every incident the autonomous agent
        resolves is persisted here, survives a server restart, and can
        answer "what has this system ever fixed" — not just "what happened
        in the last few minutes."

  chat_messages
      — ARIA's conversation history, persisted the same way, for the same
        reason (survive a restart, support a real conversation history
        view instead of a session-only scrollback).

Schema is created idempotently on every startup (`init_db()`); the first
run seeds the knowledge-base tables from the original JSON files so the
JSON remains the human-editable source of truth for the synthetic dataset,
while the database is the source of truth for anything the running system
*produces* (incidents, chat).
"""
import sqlite3
import json
import os
import time
import threading

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "ei_nexus.db")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

_lock = threading.Lock()  # sqlite3 connections are not thread-safe by default across threads


def _connect():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")  # safe concurrent reads while a write is in flight
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS tickets (
    ticket_id           TEXT PRIMARY KEY,
    asset_id            TEXT NOT NULL,
    site                TEXT,
    failure_mode        TEXT NOT NULL,
    severity            TEXT,
    reported_date       TEXT,
    symptom_description TEXT,
    downtime_hours      REAL,
    component_flagged   TEXT,
    resolved            INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tickets_failure_mode ON tickets(failure_mode);

CREATE TABLE IF NOT EXISTS bom_specs (
    component_id        TEXT PRIMARY KEY,
    component_name       TEXT,
    failure_mode_link    TEXT NOT NULL,
    design_spec_summary  TEXT,
    current_revision     TEXT,
    supplier             TEXT,
    rated_tolerance_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_bom_failure_mode ON bom_specs(failure_mode_link);

CREATE TABLE IF NOT EXISTS design_docs (
    doc_id            TEXT PRIMARY KEY,
    title             TEXT,
    failure_mode_link TEXT NOT NULL,
    content           TEXT,
    revision          TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_failure_mode ON design_docs(failure_mode_link);

CREATE TABLE IF NOT EXISTS past_fixes (
    fix_id              TEXT PRIMARY KEY,
    failure_mode_link   TEXT NOT NULL,
    applied_to_ticket    TEXT,
    fix_description      TEXT,
    validated            INTEGER,
    effectiveness_score  REAL,
    date_applied         TEXT
);
CREATE INDEX IF NOT EXISTS idx_fixes_failure_mode ON past_fixes(failure_mode_link);

CREATE TABLE IF NOT EXISTS resolved_incidents (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id         TEXT NOT NULL,
    failure_mode     TEXT NOT NULL,
    elapsed_seconds  REAL,
    ts               REAL NOT NULL,
    session_id       TEXT
);
CREATE INDEX IF NOT EXISTS idx_incidents_asset ON resolved_incidents(asset_id);
CREATE INDEX IF NOT EXISTS idx_incidents_ts ON resolved_incidents(ts);

CREATE TABLE IF NOT EXISTS chat_messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    role      TEXT NOT NULL,
    text      TEXT NOT NULL,
    used_llm  INTEGER,
    ts        REAL NOT NULL,
    session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_ts ON chat_messages(ts);
"""


def _load_json(name):
    with open(os.path.join(DATA_DIR, name)) as f:
        return json.load(f)


def _seed_if_empty(conn):
    cur = conn.execute("SELECT COUNT(*) AS n FROM tickets")
    if cur.fetchone()["n"] > 0:
        return  # already seeded — idempotent

    tickets = _load_json("tickets.json")
    conn.executemany(
        """INSERT OR IGNORE INTO tickets
           (ticket_id, asset_id, site, failure_mode, severity, reported_date,
            symptom_description, downtime_hours, component_flagged, resolved)
           VALUES (:ticket_id, :asset_id, :site, :failure_mode, :severity, :reported_date,
                   :symptom_description, :downtime_hours, :component_flagged, :resolved)""",
        [{**t, "resolved": int(bool(t["resolved"]))} for t in tickets],
    )

    bom = _load_json("bom_specs.json")
    conn.executemany(
        """INSERT OR IGNORE INTO bom_specs
           (component_id, component_name, failure_mode_link, design_spec_summary,
            current_revision, supplier, rated_tolerance_json)
           VALUES (:component_id, :component_name, :failure_mode_link, :design_spec_summary,
                   :current_revision, :supplier, :rated_tolerance_json)""",
        [{**b, "rated_tolerance_json": json.dumps(b["rated_tolerance"])} for b in bom],
    )

    docs = _load_json("design_docs.json")
    conn.executemany(
        """INSERT OR IGNORE INTO design_docs (doc_id, title, failure_mode_link, content, revision)
           VALUES (:doc_id, :title, :failure_mode_link, :content, :revision)""",
        docs,
    )

    fixes = _load_json("past_fixes.json")
    conn.executemany(
        """INSERT OR IGNORE INTO past_fixes
           (fix_id, failure_mode_link, applied_to_ticket, fix_description,
            validated, effectiveness_score, date_applied)
           VALUES (:fix_id, :failure_mode_link, :applied_to_ticket, :fix_description,
                   :validated, :effectiveness_score, :date_applied)""",
        [{**f, "validated": int(bool(f["validated"]))} for f in fixes],
    )
    conn.commit()


def init_db():
    """Idempotent — safe to call on every process startup."""
    with _lock:
        conn = _connect()
        conn.executescript(SCHEMA)
        _seed_if_empty(conn)
        conn.close()


# ---------------------------------------------------------------------------
# Query helpers — used by backend/tools.py, backend/autonomous.py, backend/chatbot.py
# ---------------------------------------------------------------------------
def fetch_all_tickets():
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT * FROM tickets").fetchall()
        conn.close()
        return [dict(r) for r in rows]


def fetch_bom_by_mode(failure_mode):
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM bom_specs WHERE failure_mode_link = ?", (failure_mode,)
        ).fetchall()
        conn.close()
        out = []
        for r in rows:
            d = dict(r)
            d["rated_tolerance"] = json.loads(d.pop("rated_tolerance_json"))
            out.append(d)
        return out


def fetch_all_bom():
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT * FROM bom_specs").fetchall()
        conn.close()
        out = []
        for r in rows:
            d = dict(r)
            d["rated_tolerance"] = json.loads(d.pop("rated_tolerance_json"))
            out.append(d)
        return out


def fetch_all_design_docs():
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT * FROM design_docs").fetchall()
        conn.close()
        return [dict(r) for r in rows]


def fetch_all_past_fixes():
    with _lock:
        conn = _connect()
        rows = conn.execute("SELECT * FROM past_fixes").fetchall()
        conn.close()
        return [dict(r) for r in rows]


def fetch_fixes_by_mode(failure_mode, top_k=3):
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM past_fixes WHERE failure_mode_link = ? ORDER BY effectiveness_score DESC LIMIT ?",
            (failure_mode, top_k),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]


def insert_resolved_incident(asset_id, failure_mode, elapsed_seconds, session_id="default"):
    with _lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO resolved_incidents (asset_id, failure_mode, elapsed_seconds, ts, session_id) VALUES (?, ?, ?, ?, ?)",
            (asset_id, failure_mode, elapsed_seconds, time.time(), session_id),
        )
        conn.commit()
        conn.close()


def fetch_all_resolved_incidents(limit=500):
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM resolved_incidents ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]


def count_resolved_incidents_all_time():
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT COUNT(*) AS n FROM resolved_incidents").fetchone()
        conn.close()
        return row["n"]


def insert_chat_message(role, text, used_llm=None, session_id="default"):
    with _lock:
        conn = _connect()
        conn.execute(
            "INSERT INTO chat_messages (role, text, used_llm, ts, session_id) VALUES (?, ?, ?, ?, ?)",
            (role, text, None if used_llm is None else int(used_llm), time.time(), session_id),
        )
        conn.commit()
        conn.close()


def fetch_chat_history(limit=200):
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM chat_messages ORDER BY ts ASC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]


def db_stats():
    """A quick health/stat snapshot — used by /api/db/stats."""
    with _lock:
        conn = _connect()
        stats = {}
        for table in ["tickets", "bom_specs", "design_docs", "past_fixes",
                       "resolved_incidents", "chat_messages"]:
            row = conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
            stats[table] = row["n"]
        conn.close()
        stats["db_path"] = os.path.abspath(DB_PATH)
        stats["db_size_bytes"] = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        return stats
