"""Offline sector classification and report-grain checks."""
import unittest
from unittest.mock import MagicMock, patch
import pandas as pd
from api import main, sea_database as sea


class SeaSectorsTest(unittest.TestCase):
    def test_reference_lookup_preserves_records_and_routes_unknown_countries_to_other(self):
        records = [{"Console_Number": "S1", "Destination_Country": " singapore ", "FCL_TEU_Count": 2.5},
                   {"Console_Number": "S2", "Destination_Country": "Unknown", "FCL_TEU_Count": 1}]
        reference = pd.DataFrame([{"CountryName": "Singapore", "Sector": "South East Asia"}])
        with patch.object(sea, "run_query", return_value=reference) as query:
            classified = sea.classify_sea_sectors(records)
        query.assert_called_once()
        self.assertIn("GROUP BY CountryName", query.call_args.args[0])
        self.assertNotIn("ShipConsolTransport", query.call_args.args[0])
        self.assertEqual(classified[0]["Destination_Sector"], "South East Asia")
        self.assertEqual(classified[1]["Destination_Sector"], "Other")
        self.assertNotIn("Destination_Sector", records[0])
        self.assertEqual(classified[0]["FCL_TEU_Count"], 2.5)

    def test_empty_data_skips_reference_query(self):
        with patch.object(sea, "run_query") as query:
            self.assertEqual(sea.classify_sea_sectors([]), [])
        query.assert_not_called()

    def test_standard_and_custom_use_same_fetched_rows_and_preserve_raw_excel_data(self):
        records = [{"Console_Number": "S1", "Destination_Country": "Singapore", "FCL_TEU_Count": 2.5,
                    "LCL_Volume": 10.25, "Revenue_USD": 100},
                   {"Console_Number": "S1", "Destination_Country": "Singapore", "FCL_TEU_Count": 2.5,
                    "LCL_Volume": 10.25, "Revenue_USD": 200}]
        for custom in (False, True):
            with self.subTest(custom=custom), \
                 patch.object(main, "execute_custom_query", return_value=records) as custom_query, \
                 patch.object(main, "get_sea_source_data", return_value=records) as standard_query, \
                 patch.object(sea, "run_query", return_value=pd.DataFrame([
                     {"CountryName": "Singapore", "Sector": "South East Asia"}])) as reference:
                request = MagicMock(headers={"X-Consol-Ledger": "true"})
                if custom:
                    result = main.custom_query(main.CustomQueryRequest(query="SELECT * WHERE TransportMode = 'SEA'",
                        transport_mode="SEA", include_sea_sectors=True), request)
                    custom_query.assert_called_once()
                    standard_query.assert_not_called()
                else:
                    result = main.fetch_data("2026-09-21", "2026-09-27", transport_mode="SEA",
                        request=request, include_sea_sectors=True)
                    standard_query.assert_called_once()
                    custom_query.assert_not_called()
                reference.assert_called_once()
                self.assertEqual(len(result["data"]), 1)
                self.assertEqual(result["data"][0]["Destination_Sector"], "South East Asia")
                self.assertEqual(result["data"][0]["FCL_TEU_Count"], 2.5)
                self.assertEqual(result["data"][0]["LCL_Volume"], 10.25)
                self.assertEqual(result["ledger_records"], records)
                self.assertNotIn("Destination_Sector", result["ledger_records"][0])

    def test_excluded_section_does_not_classify_countries(self):
        with patch.object(main, "execute_custom_query", return_value=[]), \
             patch.object(main, "classify_sea_sectors") as classify:
            main.custom_query(main.CustomQueryRequest(query="SELECT * WHERE TransportMode = 'SEA'", transport_mode="SEA"))
        classify.assert_not_called()

    def test_section_selection_passes_through_manual_air_sea_combined_and_schedule(self):
        with patch.dict("os.environ", {"DB_SERVER": "fixture", "DB_USER": "fixture", "DB_PASSWORD": "fixture", "VERCEL": ""}), \
             patch.object(main, "generate_dashboard_pdf") as pdf, \
             patch.object(main, "send_pdf_via_graph"):
            for mode in ("AIR", "SEA", "BOTH"):
                pdf.reset_mock()
                main.send_report(main.ReportRequest(start_date="2026-09-21", end_date="2026-09-27",
                    recipient_email="fixture@example.test", transport_mode=mode, include_sea_sector_distribution=False))
                self.assertTrue(pdf.call_args_list)
                self.assertTrue(all(call.kwargs["include_sea_sector_distribution"] is False for call in pdf.call_args_list))
            config = {"is_active": 1, "recipient_email": "fixture@example.test", "frequency": "weekly",
                "filters": {"transport_mode": "SEA", "country": "India", "company_code": "IND", "include_sea_sector_distribution": False}}
            with patch.object(main, "get_schedule", return_value=config), \
                 patch.object(main, "get_supabase_stations", return_value=[]), \
                 patch.object(main, "get_supabase_branches", return_value=[]):
                main.execute_scheduled_report_job("fixture")
            self.assertFalse(pdf.call_args.kwargs["include_sea_sector_distribution"])


if __name__ == "__main__":
    unittest.main()
