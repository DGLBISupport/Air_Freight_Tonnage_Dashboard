"""
api/cloud_scheduler_service.py

Google Cloud Scheduler integration for managing automated report delivery.
Replaces APScheduler, which does not survive Cloud Run scale-to-zero events.

How it works:
  1. When the user creates/updates/toggles a schedule in the UI, FastAPI calls
     sync_schedule_to_cloud(), which creates or updates a Cloud Scheduler job.
  2. At the configured time, Google Cloud Scheduler makes an HTTP POST to
     /api/schedules/{id}/run on the Cloud Run service.
  3. Cloud Run wakes up (if sleeping), generates the PDF, and sends the email.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ── Cron Expression Builder ───────────────────────────────────────────────────

def build_cron_expression(
    frequency: str,
    day_of_week: Optional[int] = None,
    day_of_month: Optional[int] = None,
    time_of_day: str = "09:00",
) -> str:
    """
    Converts a schedule config into a standard 5-field cron string (UTC).

    Day-of-week numbering differs between APScheduler and standard cron:
      APScheduler:    0 = Monday  …  6 = Sunday
      Standard cron:  0 = Sunday, 1 = Monday  …  6 = Saturday
    Conversion formula: cron_day = (apscheduler_day + 1) % 7
    """
    hour, minute = map(int, time_of_day.split(":"))

    if frequency == "daily":
        return f"{minute} {hour} * * *"
    elif frequency == "weekly":
        if day_of_week is None:
            raise ValueError("day_of_week is required for weekly schedules")
        cron_day = (day_of_week + 1) % 7
        return f"{minute} {hour} * * {cron_day}"
    elif frequency == "monthly":
        if day_of_month is None:
            raise ValueError("day_of_month is required for monthly schedules")
        return f"{minute} {hour} {day_of_month} * *"

    raise ValueError(f"Unknown frequency: '{frequency}'. Must be daily, weekly, or monthly.")


# ── GCP Configuration Helpers ─────────────────────────────────────────────────

def _get_project_id() -> str:
    """
    Resolves the GCP project ID.
    1. Reads GCP_PROJECT_ID env var if set (good for local testing).
    2. Auto-detects from the GCE metadata server — works automatically on
       Cloud Run without any extra configuration.
    """
    project_id = os.environ.get("GCP_PROJECT_ID", "").strip()
    if project_id:
        return project_id

    # Auto-detect from GCE metadata server (available on all GCP services)
    try:
        import requests as _req
        resp = _req.get(
            "http://metadata.google.internal/computeMetadata/v1/project/project-id",
            headers={"Metadata-Flavor": "Google"},
            timeout=3,
        )
        resp.raise_for_status()
        return resp.text.strip()
    except Exception as exc:
        raise RuntimeError(
            "Cannot determine GCP project ID. "
            "Set the GCP_PROJECT_ID environment variable or run on a GCP service."
        ) from exc


def _get_location() -> str:
    return os.environ.get("GCP_LOCATION", "europe-west1")


def _get_service_url() -> str:
    url = os.environ.get("CLOUD_RUN_SERVICE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError(
            "CLOUD_RUN_SERVICE_URL environment variable is not set. "
            "Set it to your Cloud Run service URL, e.g. "
            "https://air-freight-tonnage-dashboard-237872233437.europe-west1.run.app"
        )
    return url


def _get_secret_token() -> str:
    return os.environ.get("SCHEDULER_SECRET_TOKEN", "")


def _job_name(schedule_id: str) -> str:
    project = _get_project_id()
    location = _get_location()
    return f"projects/{project}/locations/{location}/jobs/tonnage-report-{schedule_id}"


def _parent_path() -> str:
    project = _get_project_id()
    location = _get_location()
    return f"projects/{project}/locations/{location}"


# ── Public API ────────────────────────────────────────────────────────────────

def sync_schedule_to_cloud(config: dict) -> None:
    """
    Creates or updates a Google Cloud Scheduler job to match a schedule config.
    If is_active is False, the job is paused so it will not fire.
    Safe to call on every create / update / toggle operation.

    Args:
        config: A schedule dict as returned by get_schedule() / get_all_schedules().
    """
    try:
        from google.cloud import scheduler_v1

        schedule_id = config["id"]

        cron = build_cron_expression(
            frequency=config["frequency"],
            day_of_week=config.get("day_of_week"),
            day_of_month=config.get("day_of_month"),
            time_of_day=config["time_of_day"],
        )
        logger.info(f"Cloud Scheduler: cron for schedule {schedule_id} = '{cron}'")

        service_url = _get_service_url()
        secret_token = _get_secret_token()
        job_name = _job_name(schedule_id)

        # Headers sent with every Cloud Scheduler HTTP call
        headers = {"Content-Type": "application/json"}
        if secret_token:
            headers["X-Scheduler-Token"] = secret_token

        job = scheduler_v1.Job(
            name=job_name,
            schedule=cron,
            time_zone="UTC",
            http_target=scheduler_v1.HttpTarget(
                uri=f"{service_url}/api/schedules/{schedule_id}/run",
                http_method=scheduler_v1.HttpMethod.POST,
                headers=headers,
                body=b"{}",
            ),
        )

        client = scheduler_v1.CloudSchedulerClient()

        # Try to update an existing job; fall back to creating a new one
        try:
            client.update_job(job=job)
            logger.info(f"Cloud Scheduler: Updated job for schedule {schedule_id}")
        except Exception:
            client.create_job(parent=_parent_path(), job=job)
            logger.info(f"Cloud Scheduler: Created job for schedule {schedule_id}")

        # Sync the active/paused state
        is_active = bool(config.get("is_active"))
        if not is_active:
            try:
                client.pause_job(name=job_name)
                logger.info(f"Cloud Scheduler: Paused job for schedule {schedule_id}")
            except Exception:
                pass  # Already paused — safe to ignore
        else:
            try:
                client.resume_job(name=job_name)
                logger.info(f"Cloud Scheduler: Resumed job for schedule {schedule_id}")
            except Exception:
                pass  # Already active — safe to ignore

    except ImportError:
        logger.warning(
            "google-cloud-scheduler is not installed. "
            "Schedule was saved to SQLite but NOT registered in Cloud Scheduler."
        )
    except Exception as exc:
        logger.error(
            f"Cloud Scheduler sync failed for schedule {config.get('id')}: {exc}",
            exc_info=True,
        )
        raise


def delete_cloud_scheduler_job(schedule_id: str) -> None:
    """
    Removes the Google Cloud Scheduler job for a given schedule.
    Safe to call even if the job does not exist (not-found errors are silently ignored).
    """
    try:
        from google.cloud import scheduler_v1
        client = scheduler_v1.CloudSchedulerClient()
        client.delete_job(name=_job_name(schedule_id))
        logger.info(f"Cloud Scheduler: Deleted job for schedule {schedule_id}")
    except Exception as exc:
        # Not-found is expected the first time (job may never have been created)
        logger.warning(
            f"Cloud Scheduler: Could not delete job for schedule {schedule_id}: {exc}"
        )
