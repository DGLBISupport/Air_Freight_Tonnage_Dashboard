# api/scheduler_db.py
import os
import requests
from typing import List, Dict, Optional

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY environment variables are not set.")

def get_headers() -> dict:
    """Returns the authentication headers for Supabase API requests."""
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

def init_scheduler_db():
    """No-op. Supabase Postgres table is initialized in the cloud."""
    pass

def save_schedule(
    schedule_id: str,
    recipient_email: str,
    frequency: str,
    day_of_week: Optional[int],
    day_of_month: Optional[int],
    time_of_day: str,
    filters_dict: dict,
    is_active: int = 1,
    created_by: Optional[str] = None
):
    """Saves or updates a schedule config in the Supabase database."""
    headers = get_headers()
    payload = {
        "id": schedule_id,
        "recipient_email": recipient_email,
        "frequency": frequency,
        "day_of_week": day_of_week,
        "day_of_month": day_of_month,
        "time_of_day": time_of_day,
        "filters": filters_dict,
        "is_active": True if is_active else False
    }
    
    if created_by:
        payload["created_by"] = created_by

    # Check if the schedule already exists
    url = f"{SUPABASE_URL}/rest/v1/report_schedules?id=eq.{schedule_id}"
    try:
        check_resp = requests.get(url, headers=headers, timeout=10)
        if check_resp.status_code == 200 and len(check_resp.json()) > 0:
            # Update existing schedule
            patch_resp = requests.patch(url, headers=headers, json=payload, timeout=10)
            patch_resp.raise_for_status()
        else:
            # Create new schedule
            post_url = f"{SUPABASE_URL}/rest/v1/report_schedules"
            post_resp = requests.post(post_url, headers=headers, json=payload, timeout=10)
            post_resp.raise_for_status()
    except Exception as e:
        print(f"Supabase DB Error in save_schedule: {e}")
        raise e

def get_all_schedules() -> List[Dict]:
    """Retrieves all schedules in the Supabase database."""
    headers = get_headers()
    url = f"{SUPABASE_URL}/rest/v1/report_schedules?select=*"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        schedules = resp.json()
        
        # Ensure is_active is compatible (converting boolean to 1/0 for backward compatibility if needed)
        for s in schedules:
            s["is_active"] = 1 if s.get("is_active") else 0
            
        return schedules
    except Exception as e:
        print(f"Supabase DB Error in get_all_schedules: {e}")
        return []

def get_schedule(schedule_id: str) -> Optional[Dict]:
    """Retrieves a single schedule configuration by ID."""
    headers = get_headers()
    url = f"{SUPABASE_URL}/rest/v1/report_schedules?id=eq.{schedule_id}&select=*"
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data and len(data) > 0:
            s = data[0]
            s["is_active"] = 1 if s.get("is_active") else 0
            return s
        return None
    except Exception as e:
        print(f"Supabase DB Error in get_schedule {schedule_id}: {e}")
        return None

def delete_schedule(schedule_id: str):
    """Permanently deletes a schedule configuration."""
    headers = get_headers()
    url = f"{SUPABASE_URL}/rest/v1/report_schedules?id=eq.{schedule_id}"
    try:
        resp = requests.delete(url, headers=headers, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        print(f"Supabase DB Error in delete_schedule {schedule_id}: {e}")
        raise e

def update_schedule_status(schedule_id: str, is_active: int):
    """Toggles the active state of a schedule configuration."""
    headers = get_headers()
    url = f"{SUPABASE_URL}/rest/v1/report_schedules?id=eq.{schedule_id}"
    payload = {
        "is_active": True if is_active else False
    }
    try:
        resp = requests.patch(url, headers=headers, json=payload, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        print(f"Supabase DB Error in update_schedule_status {schedule_id}: {e}")
        raise e
