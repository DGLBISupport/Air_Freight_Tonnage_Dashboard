# api/scheduler_db.py
import sqlite3
import json
from typing import List, Dict, Optional

import os
if os.environ.get("VERCEL") or os.environ.get("NOW_REGION"):
    DB_PATH = "/tmp/schedules.db"
else:
    DB_PATH = "schedules.db"

def init_scheduler_db():
    """Initializes the SQLite database table for report schedules."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS report_schedules (
                id TEXT PRIMARY KEY,
                recipient_email TEXT NOT NULL,
                frequency TEXT NOT NULL,      -- 'daily', 'weekly', 'monthly'
                day_of_week INTEGER,          -- 0-6 (0=Monday) for weekly
                day_of_month INTEGER,         -- 1-28 for monthly
                time_of_day TEXT NOT NULL,     -- "HH:MM" (e.g., "08:00")
                filters TEXT NOT NULL,         -- JSON string of report filters
                is_active INTEGER DEFAULT 1
            )
        """)

def get_connection():
    """Creates a connection with Row factory enabled for dictionary access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def save_schedule(
    schedule_id: str,
    recipient_email: str,
    frequency: str,
    day_of_week: Optional[int],
    day_of_month: Optional[int],
    time_of_day: str,
    filters_dict: dict,
    is_active: int = 1
):
    """Saves or updates a schedule config in the database."""
    filters_json = json.dumps(filters_dict)
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO report_schedules (id, recipient_email, frequency, day_of_week, day_of_month, time_of_day, filters, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                recipient_email=excluded.recipient_email,
                frequency=excluded.frequency,
                day_of_week=excluded.day_of_week,
                day_of_month=excluded.day_of_month,
                time_of_day=excluded.time_of_day,
                filters=excluded.filters,
                is_active=excluded.is_active
        """, (schedule_id, recipient_email, frequency, day_of_week, day_of_month, time_of_day, filters_json, is_active))

def get_all_schedules() -> List[Dict]:
    """Retrieves all schedules in the database and parses the filter configurations."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM report_schedules")
        rows = cursor.fetchall()
        result = []
        for row in rows:
            d = dict(row)
            d["filters"] = json.loads(d["filters"])
            result.append(d)
        return result

def get_schedule(schedule_id: str) -> Optional[Dict]:
    """Retrieves a single schedule configuration by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM report_schedules WHERE id = ?", (schedule_id,))
        row = cursor.fetchone()
        if row:
            d = dict(row)
            d["filters"] = json.loads(d["filters"])
            return d
        return None

def delete_schedule(schedule_id: str):
    """Permanently deletes a schedule configuration."""
    with get_connection() as conn:
        conn.execute("DELETE FROM report_schedules WHERE id = ?", (schedule_id,))

def update_schedule_status(schedule_id: str, is_active: int):
    """Toggles the active state of a schedule configuration."""
    with get_connection() as conn:
        conn.execute("UPDATE report_schedules SET is_active = ? WHERE id = ?", (is_active, schedule_id))
