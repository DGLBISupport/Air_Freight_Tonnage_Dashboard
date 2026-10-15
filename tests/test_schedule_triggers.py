"""Trigger authentication, outcomes, and frontend/backend route agreement."""
import os
from pathlib import Path
import re
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from api import main


class ScheduleTriggerTest(unittest.TestCase):
    def test_missing_or_incorrect_scheduler_secret_does_not_bypass_admin_auth(self):
        for secret, token in [("", "anything"), ("configured", "wrong"), ("configured", None)]:
            with self.subTest(secret=secret, token=token), \
                 patch.dict(os.environ, {"SCHEDULER_SECRET_TOKEN": secret}):
                self.assertFalse(main._verify_scheduler_token(token))
        with patch.dict(os.environ, {"SCHEDULER_SECRET_TOKEN": "configured"}):
            self.assertTrue(main._verify_scheduler_token("configured"))

    def test_unauthorized_trigger_does_not_load_or_run_schedule(self):
        with patch.dict(os.environ, {"SCHEDULER_SECRET_TOKEN": "configured"}), \
             patch.object(main, "get_schedule") as get, \
             patch.object(main, "execute_scheduled_report_job") as execute:
            with self.assertRaises(HTTPException) as caught:
                main.api_run_schedule_manually("fixture", x_scheduler_token="wrong", authorization=None)
        self.assertEqual(caught.exception.status_code, 403)
        get.assert_not_called()
        execute.assert_not_called()

    def test_manual_trigger_checks_admin_and_reports_success_after_execution(self):
        with patch.object(main, "get_current_admin") as admin, \
             patch.object(main, "get_schedule", return_value={"is_active": True}), \
             patch.object(main, "execute_scheduled_report_job", return_value=True) as execute:
            result = main.api_run_schedule_manually("fixture", x_scheduler_token=None, authorization="Bearer fixture")
        admin.assert_called_once_with("Bearer fixture")
        execute.assert_called_once_with("fixture")
        self.assertEqual(result["status"], "success")

    def test_paused_schedules_are_skipped_for_both_manual_and_cloud_triggers(self):
        for token in [None, "configured"]:
            with self.subTest(token=token), \
                 patch.dict(os.environ, {"SCHEDULER_SECRET_TOKEN": "configured"}), \
                 patch.object(main, "get_current_admin"), \
                 patch.object(main, "get_schedule", return_value={"is_active": False}), \
                 patch.object(main, "execute_scheduled_report_job") as execute:
                result = main.api_run_schedule_manually("fixture", x_scheduler_token=token, authorization="Bearer fixture")
            self.assertEqual(result["status"], "skipped")
            execute.assert_not_called()

    def test_failed_execution_returns_an_error_instead_of_sent(self):
        with patch.object(main, "get_current_admin"), \
             patch.object(main, "get_schedule", return_value={"is_active": True}), \
             patch.object(main, "execute_scheduled_report_job", side_effect=RuntimeError("Fixture generation failed")):
            with self.assertRaises(HTTPException) as caught:
                main.api_run_schedule_manually("fixture", x_scheduler_token=None, authorization="Bearer fixture")
        self.assertEqual(caught.exception.status_code, 500)
        self.assertEqual(caught.exception.detail, "Fixture generation failed")

    def test_schedule_changed_before_execution_is_not_reported_as_sent(self):
        with patch.object(main, "get_current_admin"), \
             patch.object(main, "get_schedule", return_value={"is_active": True}), \
             patch.object(main, "execute_scheduled_report_job", return_value=False):
            result = main.api_run_schedule_manually("fixture", x_scheduler_token=None, authorization="Bearer fixture")
        self.assertEqual(result["status"], "skipped")

    def test_report_failure_propagates_and_never_sends_email(self):
        config = {"is_active": True, "recipient_email": "fixture@example.test", "frequency": "weekly",
                  "filters": {"transport_mode": "SEA", "company_code": "IND", "country": "India"}}
        with patch.object(main, "get_schedule", return_value=config), \
             patch.object(main, "get_supabase_stations", return_value=[]), \
             patch.object(main, "get_supabase_branches", return_value=[]), \
             patch.object(main, "generate_dashboard_pdf", side_effect=RuntimeError("Fixture PDF failure")), \
             patch.object(main, "send_pdf_via_graph") as send, \
             patch("api.email_service.log_email_transaction"), \
             patch.object(main, "cleanup_report_files") as cleanup:
            with self.assertRaisesRegex(RuntimeError, "Fixture PDF failure"):
                main.execute_scheduled_report_job("fixture")
        send.assert_not_called()
        cleanup.assert_called_once()

    def test_all_frontend_api_paths_have_backend_routes(self):
        root = Path(__file__).resolve().parents[1]
        paths = set()
        for name in ["frontend/app/page.tsx", "frontend/app/print-view/page.tsx"]:
            for match in re.finditer(r"\$\{API\}(/api/[^`\s\"']+)", (root / name).read_text(encoding="utf-8")):
                path = re.sub(r"\$\{[^}]+\}", "fixture", match.group(1).split("?")[0])
                paths.add(path)
        self.assertGreater(len(paths), 20)
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(any(getattr(route, "path_regex", re.compile(r"^$")).fullmatch(path)
                                    for route in main.app.routes), f"Frontend calls missing route: {path}")

    def test_air_custom_sql_trigger_updates_dates_before_generating_report(self):
        config = {"is_active": True, "recipient_email": "fixture@example.test", "frequency": "weekly",
                  "filters": {"transport_mode": "AIR", "mode": "custom-sql",
                              "custom_sql": "SELECT * FROM vt WHERE ETD >= '2000-01-01' AND ETD <= '2000-01-02'"}}
        with patch.object(main, "get_schedule", return_value=config), \
             patch.object(main, "get_supabase_stations", return_value=[]), \
             patch.object(main, "get_supabase_branches", return_value=[]), \
             patch.object(main, "get_report_dates_by_frequency", return_value=("2026-10-01", "2026-10-14")), \
             patch.object(main, "generate_dashboard_pdf") as pdf, \
             patch.object(main, "send_pdf_via_graph") as send, \
             patch.object(main, "cleanup_report_files"):
            self.assertTrue(main.execute_scheduled_report_job("fixture"))
        sql = pdf.call_args.kwargs["custom_sql"]
        self.assertIn("2026-10-01", sql)
        self.assertIn("2026-10-14", sql)
        self.assertNotIn("2000-01", sql)
        send.assert_called_once()

    def test_individual_branch_schedule_keeps_recipient_dates_and_report_sections(self):
        for branch_field in ["branch", "branch_code"]:
            with self.subTest(branch_field=branch_field):
                config = {"is_active": True, "recipient_email": "delhi@example.test", "frequency": "weekly",
                          "filters": {"transport_mode": "AIR", "recipient_mode": "person",
                                      "company_code": "IND", branch_field: "DEL", "report_level": "branch",
                                      "use_fixed_dates": True, "start_date": "2026-10-01", "end_date": "2026-10-14",
                                      "include_weekly_visual": True, "include_weekly_ledger": False,
                                      "include_monthly_visual": False, "include_monthly_ledger": False}}
                with patch.object(main, "get_schedule", return_value=config), \
                     patch.object(main, "get_supabase_stations", return_value=[]), \
                     patch.object(main, "get_supabase_branches", return_value=[{"code": "DEL", "company_code": "IND", "country": "India"}]), \
                     patch.object(main, "generate_dashboard_pdf") as pdf, \
                     patch.object(main, "send_pdf_via_graph") as send, \
                     patch.object(main, "cleanup_report_files"):
                    self.assertTrue(main.execute_scheduled_report_job("individual-fixture"))
                self.assertEqual(pdf.call_args.kwargs["branch"], "DEL")
                self.assertEqual(pdf.call_args.kwargs["start_date"], "2026-10-01")
                self.assertEqual(pdf.call_args.kwargs["end_date"], "2026-10-14")
                self.assertFalse(pdf.call_args.kwargs["include_weekly_ledger"])
                self.assertFalse(pdf.call_args.kwargs["include_monthly_visual"])
                self.assertFalse(pdf.call_args.kwargs["include_monthly_ledger"])
                self.assertEqual(send.call_args.kwargs["recipient_email"], "delhi@example.test")


if __name__ == "__main__":
    unittest.main()
