"""Offline regressions for separate air/sea queries, metrics and subscriptions."""
import unittest
from unittest.mock import patch, MagicMock
from urllib.parse import urlparse, parse_qs

import pandas as pd
from fastapi import HTTPException

from api import main, database, sea_database as sea, pdf_service
import weekly_report_mailer as mailer


ROWS = [
    {"Console_Number": "SEA-1", "Shippingline": "Maersk", "TEUCount": 2.5,
     "Volume_M3": 10.25, "Revenue_USD": 100, "Cost_USD": 60, "Profit_USD": 40,
     "Origin_Country": "India", "ETD": "2026-09-27T18:00:00", "Total_Shipments": 2},
    {"Console_Number": "SEA-2", "Shippingline": "MSC", "TEUCount": 1,
     "Volume_M3": 5.5, "Revenue_USD": 200, "Cost_USD": 150, "Profit_USD": 50,
     "Origin_Country": "India", "ETD": "2026-09-28T08:00:00", "Total_Shipments": 1},
]


class FreightModesTest(unittest.TestCase):
    def setUp(self):
        database.query_results.clear()
        database._gateway_retry_after.clear()

    def test_sea_query_uses_own_columns_and_bound_filters(self):
        sql, params = sea.build_sea_query("2026-09-21", "2026-09-27", country="India",
                                          airline="MSC,Maersk", company_code="IND", branch="BLR")
        self.assertIn("TransportMode = 'SEA'", sql)
        self.assertNotIn("Air_ChargebleWeight", sql)
        self.assertIn("MAX(vt.FCLTEU)", sql)
        self.assertIn("MAX(vt.LCLVolume)", sql)
        self.assertIn("vs.Company IN (:company_0)", sql)
        self.assertIn("vs.Branch IN (:branch_0)", sql)
        self.assertIn("vt.ETD >= :start_date", sql)
        self.assertIn("vt.ETD <= :end_date", sql)
        self.assertEqual(params["company_0"], "IND")
        self.assertEqual(params["carrier_1"], "Maersk")

    def test_multi_select_binding_handles_more_than_ten_carriers(self):
        sql, params = sea.build_sea_query("2026-09-21", "2026-09-27", airline=",".join(f"Line{i}" for i in range(12)))
        response = MagicMock(status_code=200)
        response.json.return_value = []
        with patch.object(database.requests, "post", return_value=response) as post:
            database.run_query(sql, params)
        rendered = post.call_args.kwargs["json"]["sql_query"]
        self.assertIn("'Line10'", rendered)
        self.assertIn("'Line11'", rendered)
        self.assertNotIn(":carrier_", rendered)

    def test_metric_and_period_rollups_keep_teu_and_volume_separate(self):
        with patch.object(sea, "run_query", return_value=pd.DataFrame(ROWS)):
            kpi = sea.get_sea_kpi("2026-09-21", "2026-09-28")
            self.assertEqual(kpi["Total_TEU"], 3.5)
            self.assertEqual(kpi["Total_Volume_M3"], 15.75)
            self.assertEqual(kpi["Total_Revenue"], 300)
            self.assertEqual(kpi["Total_Consols"], 2)
            self.assertNotIn("Total_Shipments", kpi)
            self.assertEqual(kpi["Total_Masters"], 0)  # Missing bills are not masters.
            self.assertNotIn("GP_Margin", kpi)
            weekly = sea.get_sea_trends("weekly", "2026-09-21", "2026-09-28")
            self.assertEqual([r["Week_Start"] for r in weekly], ["2026-09-21", "2026-09-28"])
            self.assertEqual(weekly[0]["Total_Tonnage"], 2.5)
            monthly = sea.get_sea_trends("monthly", "2026-09-01", "2026-09-30")
            self.assertEqual(monthly[0]["Total_Volume_M3"], 15.75)

    def test_empty_sea_results(self):
        with patch.object(sea, "run_query", return_value=pd.DataFrame()):
            self.assertEqual(sea.get_sea_data("2026-09-21", "2026-09-27"), [])
            self.assertEqual(sea.get_sea_kpi("2026-09-21", "2026-09-27")["Total_TEU"], 0)
            self.assertEqual(sea.get_sea_trends("weekly", "2026-09-21", "2026-09-27"), [])
            self.assertEqual(sea.get_sea_options("airlines", "2026-09-21", "2026-09-27"), [])

    def test_sea_master_counts_deduplicate_bills_across_consols_and_periods(self):
        records = [dict(ROWS[0], Console_Number=f"C{i}", ETD=etd,
                        Master_Bill_of_Lading=bill) for i, (bill, etd) in enumerate([
            (" BOL-1 ", "2026-09-21"), ("bol-1", "2026-09-22"),
            ("BOL-2", "2026-09-23"), (None, "2026-09-24"),
            ("N/A", "2026-09-25"), ("—", "2026-09-26"),
            ("BOL-1", "2026-09-28")])]
        records.append(dict(records[0]))  # Same consol repeated by a join.
        with patch.object(sea, "run_query", return_value=pd.DataFrame(records)):
            kpi = sea.get_sea_kpi("2026-09-21", "2026-09-30")
            self.assertEqual(kpi["Total_Consols"], 7)
            self.assertEqual(kpi["Total_Masters"], 6)
            self.assertEqual(kpi["Total_TEU"], 17.5)
            weeks = sea.get_sea_trends("weekly", "2026-09-21", "2026-09-30")
            self.assertEqual([week["Total_Masters"] for week in weeks], [5, 1])
            months = sea.get_sea_trends("monthly", "2026-09-01", "2026-09-30")
            self.assertEqual(months[0]["Total_Masters"], 6)
        aliases = [{"Console_Number": "ALIAS", "Master_Bill_of_Lading": " ",
                    "Master_Airway_Bill": " BOL-3 "},
                   {"Console_Number": "LATE", "Master_Bill_of_Lading": None},
                   {"Console_Number": "LATE", "MasterBillNum": "BOL-3"}]
        normalized = sea.normalize_sea_records(aliases)
        self.assertEqual(sea.count_sea_masters(normalized), 2)
        self.assertEqual(normalized[0]["Master_Bill_of_Lading"], " ")
        bills = ["", " ", "N/A", "NA", "NULL", "NONE", "UNKNOWN", "UNLINKED",
                 "-", "--", "—", "bol-1", "BOL-1", " BOL-1 ", 0]
        exact_records = [{"Console_Number": f"EXACT-{i}", "Master_Bill_of_Lading": bill}
                         for i, bill in enumerate(bills + bills + [None])]
        self.assertEqual(sea.count_sea_masters(sea.normalize_sea_records(exact_records)), 15)
        self.assertEqual(sea.sea_master_key(" BOL/123-A "), " BOL/123-A ")

    def test_consol_aliases_and_repeated_customer_rows_do_not_multiply_volume(self):
        rows = [dict(ROWS[0], FCL_TEU_Count=2.5, LCL_Volume=10.25),
                dict(ROWS[0], FCL_TEU_Count=2.5, LCL_Volume=10.25, Revenue_USD=50)]
        result = sea.normalize_sea_records(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["FCL_TEU_Count"], 2.5)
        self.assertEqual(result[0]["LCL_Volume"], 10.25)
        self.assertEqual(result[0]["Revenue_USD"], 150)
        self.assertNotIn("Total_Shipments", result[0])
        self.assertNotIn("Profit_USD", result[0])
        sql, _ = sea.build_sea_query("2026-09-21", "2026-09-27")
        pasted = sql.replace("MAX(vt.FCLTEU)", "SUM(vt.FCLTEU)").replace("MAX(vt.LCLVolume)", "SUM(vt.LCLVolume)")
        self.assertEqual(sea.prepare_sea_query(pasted), sql)

    def test_sea_trends_use_station_date_for_offset_etds(self):
        records = [dict(ROWS[0], ETD="2026-09-30T19:00:00Z", Company_Code="IND")]
        with patch.object(sea, "get_sea_data", return_value=sea.normalize_sea_records(records)):
            months = sea.get_sea_trends("monthly", "2026-10-01", "2026-10-07")
        self.assertEqual(months[0]["Month"], 10)
        self.assertEqual(sea.sea_operational_date(dict(records[0], ETD="2026-10-01T00:15:00")).isoformat(), "2026-10-01")

    def test_air_still_uses_original_queries(self):
        for endpoint, getter in [(main.fetch_data, "get_filtered_data"),
                                  (main.fetch_kpi, "get_kpi_summary"),
                                  (main.fetch_weekly, "get_weekly_data"),
                                  (main.fetch_monthly, "get_monthly_data")]:
            with patch.object(main, getter, return_value=[{"air": True}]) as query:
                self.assertEqual(endpoint("2026-09-21", "2026-09-27")["data"], [{"air": True}])
                query.assert_called_once()

    def test_sea_endpoint_and_custom_query_normalization(self):
        with patch.object(main, "get_sea_data", return_value=ROWS) as query:
            self.assertEqual(main.fetch_data("2026-09-21", "2026-09-27", transport_mode="SEA")["data"], ROWS)
            query.assert_called_once()
        with patch.object(main, "execute_custom_query", return_value=ROWS):
            result = main.custom_query(main.CustomQueryRequest(query="SELECT * FROM vt WHERE TransportMode = 'SEA'", transport_mode="SEA"))
            self.assertEqual(result["data"][0]["Airline"], "Maersk")
            self.assertEqual(result["data"][0]["Total_Tonnage"], 2.5)
            self.assertEqual(result["data"][0]["Total_Volume_M3"], 10.25)
            with self.assertRaises(HTTPException):
                main.custom_query(main.CustomQueryRequest(query="SELECT * FROM vt WHERE TransportMode = 'AIR'", transport_mode="SEA"))

    def test_sea_sectors_respect_global_scope_and_branch(self):
        with patch.object(main, "get_sea_sector_distribution", return_value=[]) as query:
            main.fetch_sector_carrier_distribution(start_date="2026-09-21", end_date="2026-09-27", transport_mode="SEA")
            self.assertIsNone(query.call_args.args[2])
            main.fetch_sector_carrier_distribution(custom_sql="SELECT * FROM vt WHERE Branch = 'BLR' AND ETD >= '2026-09-21' AND ETD <= '2026-09-27'", transport_mode="SEA")
            self.assertEqual(query.call_args.args[-1], "BLR")

    def test_sector_report_accepts_long_sql_in_post_body(self):
        sql = "SELECT * FROM vt WHERE Branch = 'BLR' AND ETD >= '2026-09-21' AND ETD <= '2026-09-27'\n-- " + "x" * 20000
        req = main.SectorDistributionRequest(custom_sql=sql, transport_mode="SEA", company_code="IND")
        with patch.object(main, "get_sea_sector_distribution", return_value=[]) as query:
            main.fetch_sector_carrier_distribution_post(req)
        self.assertEqual(query.call_args.args[0:2], ("2026-09-21", "2026-09-27"))
        self.assertEqual(query.call_args.args[-1], "BLR")

    def test_failed_print_report_is_not_emailed_as_a_blank_pdf(self):
        playwright = MagicMock()
        page = playwright.chromium.launch.return_value.new_page.return_value
        page.goto.return_value.status = 200
        page.locator.return_value.count.return_value = 1
        page.locator.return_value.inner_text.return_value = "Report could not be generated"
        context = MagicMock()
        context.__enter__.return_value = playwright
        with patch.object(pdf_service, "sync_playwright", return_value=context), \
             patch.object(pdf_service, "get_tonnage_base_url", return_value="http://localhost:3000"):
            with self.assertRaises(RuntimeError):
                pdf_service.generate_dashboard_pdf("fixture.pdf", transport_mode="SEA")
        page.pdf.assert_not_called()

    def test_schedule_lists_do_not_mix_legacy_air_and_sea(self):
        configs = [{"id": "legacy", "filters": {}}, {"id": "air", "filters": {"transport_mode": "AIR"}},
                   {"id": "sea", "filters": {"transport_mode": "SEA"}}]
        with patch.object(main, "get_all_schedules", return_value=configs):
            self.assertEqual([s["id"] for s in main.api_list_schedules(current_user={})["data"]], ["legacy", "air"])
            self.assertEqual([s["id"] for s in main.api_list_schedules("SEA", current_user={})["data"]], ["sea"])

    def test_scheduled_sea_report_uses_sea_query_pdf_and_email(self):
        config = {"is_active": 1, "recipient_email": "fixture@example.test", "frequency": "weekly",
                  "filters": {"transport_mode": "SEA", "company_code": "IND", "country": "India", "branch": "BLR"}}
        with patch.object(main, "get_schedule", return_value=config), \
             patch.object(main, "get_supabase_stations", return_value=[]), \
             patch.object(main, "get_supabase_branches", return_value=[]), \
             patch.object(main, "generate_dashboard_pdf") as pdf, \
             patch.object(main, "send_pdf_via_graph") as email:
            main.execute_scheduled_report_job("fixture")
            kwargs = pdf.call_args.kwargs
            self.assertEqual(kwargs["transport_mode"], "SEA")
            self.assertIn("TransportMode = 'SEA'", kwargs["custom_sql"])
            self.assertIn("vs.Branch IN ('BLR')", kwargs["custom_sql"])
            self.assertIn("Sea Freight", email.call_args.kwargs["subject"])
            self.assertTrue(email.call_args.kwargs["attachment_name"].startswith("Sea_"))

    def test_sea_date_parsing_and_sql_escaping(self):
        sql = sea.render_sea_query(start_date="2026-09-21", end_date="2026-09-27", country="Cote d'Ivoire", company_code="IND")
        self.assertIn("Cote d''Ivoire", sql)
        self.assertIn("AND vt.ETD >= '2026-09-21'", sql)
        self.assertIn("AND vt.ETD <= '2026-09-27'", sql)
        self.assertEqual(main.extract_dates_from_sql(sql), ("2026-09-21", "2026-09-27"))

    def test_pdf_url_preserves_mode(self):
        playwright = MagicMock()
        page = playwright.chromium.launch.return_value.new_page.return_value
        page.goto.return_value.status = 200
        page.locator.return_value.count.return_value = 0
        page.locator.side_effect = lambda selector: MagicMock(count=MagicMock(return_value=1 if selector == ".print-page-container" else 0))
        context = MagicMock()
        context.__enter__.return_value = playwright
        with patch.object(pdf_service, "sync_playwright", return_value=context), \
             patch.object(pdf_service, "get_tonnage_base_url", return_value="http://localhost:3000"):
            pdf_service.generate_dashboard_pdf("fixture.pdf", start_date="2026-09-21", end_date="2026-09-27", transport_mode="SEA")
        params = parse_qs(urlparse(page.goto.call_args.args[0]).query)
        self.assertEqual(params["transport_mode"], ["SEA"])
        self.assertIn("__FREIGHT_PRINT_CONFIG__", page.add_init_script.call_args.args[0])
        page.wait_for_timeout.assert_not_called()

    def test_pdf_timeout_does_not_capture_or_email_loading_page(self):
        playwright = MagicMock()
        browser = playwright.chromium.launch.return_value
        page = browser.new_page.return_value
        page.goto.return_value.status = 200
        page.wait_for_selector.side_effect = TimeoutError("still loading")
        context = MagicMock()
        context.__enter__.return_value = playwright
        with patch.object(pdf_service, "sync_playwright", return_value=context), \
             patch.object(pdf_service, "get_tonnage_base_url", return_value="http://localhost:3000"):
            with self.assertRaisesRegex(RuntimeError, "No PDF was generated or sent"):
                pdf_service.generate_dashboard_pdf("fixture.pdf")
        page.pdf.assert_not_called()
        browser.close.assert_called_once()

    def test_send_report_does_not_send_after_generation_failure(self):
        req = main.ReportRequest(start_date="2026-09-21", end_date="2026-09-27", recipient_email="fixture@example.test")
        with patch.dict("os.environ", {"DB_SERVER": "fixture", "DB_USER": "fixture", "DB_PASSWORD": "fixture"}), \
             patch.object(main, "generate_dashboard_pdf", side_effect=RuntimeError("Report did not finish loading")), \
             patch.object(main, "send_pdf_via_graph") as email, \
             patch("api.email_service.log_email_transaction"):
            with self.assertRaises(HTTPException) as error:
                main.send_report(req)
        self.assertEqual(error.exception.status_code, 500)
        email.assert_not_called()

    def test_standalone_air_mailer_also_uses_checked_pdf_service(self):
        with patch.object(pdf_service, "generate_dashboard_pdf") as pdf:
            mailer.generate_pdf("IND", "India", "India", "2026-09-21", "2026-09-27", "fixture.pdf")
        self.assertEqual(pdf.call_args.kwargs["transport_mode"], "AIR")
        self.assertIn("TransportMode = 'AIR'", pdf.call_args.kwargs["custom_sql"])

    def test_standalone_mailer_uses_the_same_sea_query(self):
        with patch.object(mailer.pd, "read_sql", return_value=pd.DataFrame(ROWS)) as query:
            mailer.fetch_data(object(), {"name": "India", "country": "India", "code": "IND"},
                              "2026-09-21", "2026-09-27", transport_mode="SEA")
        self.assertIn("TransportMode = 'SEA'", str(query.call_args.args[0]))
        self.assertEqual(query.call_args.kwargs["params"]["company_0"], "IND")
        with patch.object(pdf_service, "generate_dashboard_pdf") as pdf:
            mailer.generate_pdf("IND", "India", "India", "2026-09-21", "2026-09-27",
                                "fixture.pdf", transport_mode="SEA", branch_code="BLR")
        self.assertEqual(pdf.call_args.kwargs["transport_mode"], "SEA")
        self.assertIn("vs.Branch IN ('BLR')", pdf.call_args.kwargs["custom_sql"])

    def test_send_report_both_modes_generates_and_attaches_two_pdfs(self):
        req = main.ReportRequest(
            start_date="2026-09-21",
            end_date="2026-09-27",
            recipient_email="fixture@example.test",
            transport_mode="BOTH"
        )
        with patch.dict("os.environ", {"DB_SERVER": "fixture", "DB_USER": "fixture", "DB_PASSWORD": "fixture"}), \
             patch.object(main, "generate_dashboard_pdf") as generate_pdf, \
             patch.object(main, "send_pdf_via_graph") as send_email:
            res = main.send_report(req)
        self.assertEqual(res["status"], "success")
        self.assertEqual(generate_pdf.call_count, 2)
        modes_called = [call.kwargs.get("transport_mode") for call in generate_pdf.call_args_list]
        self.assertIn("AIR", modes_called)
        self.assertIn("SEA", modes_called)
        self.assertEqual(send_email.call_count, 1)
        attachments = send_email.call_args.kwargs.get("attachments")
        self.assertEqual(len(attachments), 2)
        self.assertIn("Air & Sea", send_email.call_args.kwargs.get("subject"))


if __name__ == "__main__":
    unittest.main()
