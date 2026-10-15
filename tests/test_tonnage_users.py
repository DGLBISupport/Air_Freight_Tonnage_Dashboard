"""User and schedule lookups must stay independent of the NPS user table."""
import os
import unittest
from unittest.mock import MagicMock, patch

from api import main, scheduler_db
import weekly_report_mailer as mailer


class TonnageUsersTest(unittest.TestCase):
    def test_mailer_selects_only_tonnage_users_for_each_freight_mode(self):
        response = MagicMock(status_code=200)
        response.json.return_value = [
            {"email": "station@example.test", "station": "CMB, IND"},
            {"email": "global@example.test", "station": "Global"},
            {"email": "other@example.test", "station": "NYC"},
            {"email": "station@example.test", "station": "IND"},
            {"email": "branch-only@example.test", "station": "BLR, DEL"},
        ]
        for mode, column in [("AIR", "is_air"), ("SEA", "is_sea")]:
            with self.subTest(mode=mode), \
                 patch.object(scheduler_db, "SUPABASE_URL", "https://fixture.supabase.co"), \
                 patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
                 patch.object(scheduler_db.requests, "get", return_value=response) as get:
                self.assertEqual(scheduler_db.get_supabase_recipients("IND", transport_mode=mode),
                                 ["global@example.test", "station@example.test"])
            self.assertEqual(get.call_args.args[0],
                             f"https://fixture.supabase.co/rest/v1/tonnage_users?{column}=eq.true&select=email,station")

    def test_empty_assignments_do_not_restore_legacy_lists(self):
        empty = MagicMock(status_code=200)
        empty.json.return_value = []
        with patch.object(scheduler_db, "SUPABASE_URL", "https://fixture.supabase.co"), \
             patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(scheduler_db.requests, "get", return_value=empty) as get:
            self.assertEqual(scheduler_db.get_supabase_recipients("BLR", is_branch=True),
                             [])
        self.assertEqual([call.args[0].split("/rest/v1/")[1].split("?")[0] for call in get.call_args_list],
                         ["tonnage_users"])

    def test_station_and_branch_reports_match_explicit_assignments(self):
        response = MagicMock(status_code=200)
        response.json.return_value = [
            {"email": "branch-only@example.test", "station": " blr "},
            {"email": "station-only@example.test", "station": "IND"},
            {"email": "both@example.test", "station": "IND, BLR"},
        ]
        with patch.object(scheduler_db, "SUPABASE_URL", "https://fixture.supabase.co"), \
             patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(scheduler_db.requests, "get", return_value=response):
            self.assertEqual(scheduler_db.get_supabase_recipients("IND"), ["both@example.test", "station-only@example.test"])
            self.assertEqual(scheduler_db.get_supabase_recipients("BLR", is_branch=True), ["both@example.test", "branch-only@example.test"])

    def test_configured_mailer_does_not_restore_environment_recipients(self):
        with patch.object(scheduler_db, "SUPABASE_URL", "https://fixture.supabase.co"), \
             patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(scheduler_db, "get_supabase_recipients", return_value=[]), \
             patch.dict(os.environ, {"RECIPIENTS_IND": "branch-only@example.test", "RECIPIENT_EMAILS": "old@example.test"}):
            self.assertEqual(mailer.get_station_report_recipients({"code": "IND"}), [])

    def test_configured_mailer_propagates_lookup_errors_instead_of_using_old_addresses(self):
        with patch.object(scheduler_db, "SUPABASE_URL", "https://fixture.supabase.co"), \
             patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(scheduler_db, "get_supabase_recipients", side_effect=RuntimeError("Fixture lookup unavailable")), \
             patch.dict(os.environ, {"RECIPIENTS_IND": "branch-only@example.test"}):
            with self.assertRaisesRegex(RuntimeError, "Fixture lookup unavailable"):
                mailer.get_station_report_recipients({"code": "IND"})

    def test_service_role_is_used_only_for_backend_requests(self):
        with patch.object(scheduler_db, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(scheduler_db, "SUPABASE_SERVICE_ROLE_KEY", "fixture-service"):
            headers = scheduler_db.get_headers()
        self.assertEqual(headers["apikey"], "fixture-service")
        self.assertEqual(headers["Authorization"], "Bearer fixture-service")
        with patch.dict(os.environ, {"SUPABASE_KEY": "fixture-anon",
                                     "SUPABASE_SERVICE_ROLE_KEY": "fixture-service"}):
            self.assertEqual(main.get_config()["supabaseAnonKey"], "fixture-anon")
            self.assertNotIn("fixture-service", str(main.get_config()))

    def test_schedule_creator_is_resolved_from_tonnage_users(self):
        response = MagicMock(status_code=200)
        response.json.return_value = [{"id": "tonnage-creator-id"}]
        request = main.ScheduleCreateRequest(
            recipient_email="recipient@example.test", frequency="weekly", day_of_week=0,
            time_of_day="09:00", filters={"transport_mode": "AIR"},
        )
        with patch.object(main, "SUPABASE_URL", "https://fixture.supabase.co"), \
             patch.object(main, "SUPABASE_KEY", "fixture-anon"), \
             patch.object(main.requests, "get", return_value=response) as get, \
             patch.object(main, "save_schedule") as save, \
             patch.object(main, "get_schedule", return_value=None):
            result = main.api_create_schedule(request, current_user={"email": "admin@example.test"})
        self.assertEqual(result["status"], "success")
        self.assertEqual(get.call_args.args[0],
                         "https://fixture.supabase.co/rest/v1/tonnage_users?email=eq.admin@example.test&select=id")
        self.assertEqual(save.call_args.kwargs["created_by"], "tonnage-creator-id")


if __name__ == "__main__":
    unittest.main()
