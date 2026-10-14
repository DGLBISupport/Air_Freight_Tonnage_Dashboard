"""Regressions for the freight database and gateway-to-ODBC fallback."""
import os
import unittest
from unittest.mock import MagicMock, patch

import pandas as pd
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ProgrammingError

from api import database


class DatabaseConfigurationTest(unittest.TestCase):
    def setUp(self):
        database.query_results.clear()
        database._gateway_retry_after.clear()

    def test_connection_selects_freight_warehouse_when_database_is_unset_or_blank(self):
        for env in ({}, {"DB_NAME": ""}, {"DB_NAME": "   "}):
            with self.subTest(env=env), patch.dict(os.environ, env, clear=True), \
                 patch.object(database, "_engine", None), \
                 patch.object(database, "get_odbc_driver", return_value="ODBC Driver 18 for SQL Server"), \
                 patch.object(database, "create_engine") as create:
                database.get_engine()
                connection = make_url(create.call_args.args[0]).query["odbc_connect"]
                self.assertIn(";DATABASE=DartBIDW;", connection)

    def test_explicit_database_is_respected(self):
        with patch.dict(os.environ, {"DB_NAME": " ReportingWarehouse "}), \
             patch.object(database, "_engine", None), \
             patch.object(database, "get_odbc_driver", return_value="ODBC Driver 18 for SQL Server"), \
             patch.object(database, "create_engine") as create:
            database.get_engine()
        connection = make_url(create.call_args.args[0]).query["odbc_connect"]
        self.assertIn(";DATABASE=ReportingWarehouse;", connection)

    def test_gateway_failure_runs_air_query_in_configured_warehouse(self):
        response = MagicMock(status_code=500)
        expected = pd.DataFrame([{"Airline": "Fixture Air", "Total_Tonnage": 10}])
        environment = {"DB_NAME": "DartBIDW", "DB_SERVER": "fixture", "DB_USER": "fixture", "DB_PASSWORD": "fixture"}
        with patch.dict(os.environ, environment), \
             patch.object(database, "ONPREM_API_URL", "https://gateway.example.test/data"), \
             patch.object(database.requests, "post", return_value=response) as gateway, \
             patch.object(database, "get_engine", return_value=MagicMock()), \
             patch.object(database.pd, "read_sql", return_value=expected) as direct:
            records = database.get_filtered_data("2026-10-05", "2026-10-11")
        self.assertEqual(records, expected.to_dict(orient="records"))
        gateway.assert_called_once()
        self.assertIn("FROM dbo.ChatData_ViewShipConsolTransport vt", str(direct.call_args.args[0]))
        self.assertEqual(direct.call_args.kwargs["params"], {"start_date": "2026-10-05", "end_date": "2026-10-11"})

    def test_missing_freight_views_explain_database_setting_and_do_not_cache_failure(self):
        for view in database.FREIGHT_VIEWS:
            with self.subTest(view=view):
                error = ProgrammingError("SELECT sensitive_report", {}, Exception("42S02", f"Invalid object name 'dbo.{view}'. (208)"))
                with patch.dict(os.environ, {"DB_NAME": "DartCusSurvey"}), \
                     patch.object(database, "_run_query_uncached", side_effect=error):
                    with self.assertRaises(RuntimeError) as caught:
                        database.run_query("SELECT sensitive_report")
                message = str(caught.exception)
                self.assertIn("DartCusSurvey", message)
                self.assertIn("Set DB_NAME to DartBIDW", message)
                self.assertIn("restart the API", message)
                self.assertNotIn("sensitive_report", message)
                self.assertIs(caught.exception.__cause__, error)
                self.assertFalse(database.query_results._entries)

    def test_other_sql_errors_are_preserved_even_when_query_mentions_freight_view(self):
        sql = "SELECT BadColumn FROM dbo.ChatData_ViewShipConsolTransport"
        for code, message in [("42S22", "Invalid column name 'BadColumn'."),
                              ("42S02", "Invalid object name 'dbo.CustomTable'."),
                              ("42000", "SELECT permission denied on ChatData_ViewShipConsolTransport.")]:
            with self.subTest(code=code, message=message):
                error = ProgrammingError(sql, {}, Exception(code, message))
                with patch.object(database, "_run_query_uncached", side_effect=error):
                    with self.assertRaises(ProgrammingError) as caught:
                        database.run_query(sql)
                self.assertIs(caught.exception, error)

    def test_results_from_different_databases_have_separate_cache_entries(self):
        with patch.object(database, "_run_query_uncached", side_effect=[pd.DataFrame([{"value": "warehouse"}]),
                                                                       pd.DataFrame([{"value": "other"}])]) as query:
            for name, value in [("DartBIDW", "warehouse"), ("ReportingWarehouse", "other"), ("DartBIDW", "warehouse")]:
                with patch.dict(os.environ, {"DB_NAME": name}):
                    self.assertEqual(database.run_query("SELECT value").iloc[0]["value"], value)
        self.assertEqual(query.call_count, 2)


if __name__ == "__main__":
    unittest.main()
