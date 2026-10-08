"""Check amount-preserving Sea rewrites, including duplicate dimension joins."""
import sqlite3
import unittest
from unittest.mock import patch

import pandas as pd
from sqlalchemy.exc import ProgrammingError
from api import database, sea_database as sea
from api.sea_query_optimizer import (can_optimize, compile_revenue_source,
                                     optimize_query, VIEW_DEFINITION_SQL)


DEFINITION = """
CREATE VIEW dbo.ChatData_ViewRevandVolume_ShipmentDate AS
SELECT d.ShipmentNumber, d.Company, d.Branch, d.BranchName, d.BranchCity,
       d.Revenue_USD, d.Cost_USD, d.Profit_USD
FROM (SELECT RVF.RVF_ShipmentNumber AS ShipmentNumber,
    RVF.RVF_Company AS Company, RVF.RVF_Branch AS Branch,
    db.BranchName, db.City AS BranchCity,
    SUM(RVF.RVF_USD_Revenue) AS Revenue_USD,
    SUM(RVF.RVF_USD_Cost) AS Cost_USD,
    SUM(RVF.RVF_USD_Profit) AS Profit_USD,
    RVF.RVF_ShipmentNumber AS ViewClient,
    RVF.Country AS ViewClient_CountryCode,
    RVF.Country AS LocalClientCountryCode,
    RVF.Country AS BillingClient_CountryCode
    FROM dbo.RevandVolFact AS RVF
    LEFT OUTER JOIN dbo.DimBranch AS db ON db.BranchCode=RVF.RVF_Branch
    LEFT OUTER JOIN (SELECT Job, Country, Mode, SUM(Volume) AS Volume
        FROM dbo.Volumes GROUP BY Job, Country, Mode) AS jsv
        ON jsv.Job=RVF.RVF_ShipmentNumber AND jsv.Country=RVF.Country
    GROUP BY RVF.RVF_Destination_Code, RVF.RVF_ShipmentNumber, RVF.RVF_Company,
        RVF.RVF_Branch, db.BranchName, db.City, RVF.Country, RVF.Bucket, jsv.Mode
) AS d LEFT OUTER JOIN dbo.DimCountry AS dc ON dc.Code=d.ViewClient_CountryCode
CROSS JOIN dbo.StagingTablesLastUpdateTimeMax AS m
"""

QUERY = """
SELECT vt.ConsoleNumber, MAX(vt.FCLTEU) AS TEUCount,
    MAX(vt.LCLVolume) AS Volume_M3,
    COALESCE(MAX(vs.Company), 'Unlinked') AS Company_Code,
    MAX(vs.BranchName) AS Branch_Name,
    COUNT(DISTINCT vs.ShipmentNumber) AS Total_Shipments,
    ROUND(SUM(vs.Revenue_USD), 2) AS Revenue_USD,
    ROUND(SUM(vs.Cost_USD), 2) AS Cost_USD,
    ROUND(SUM(vs.Profit_USD), 2) AS Profit_USD
FROM dbo.ChatData_ViewShipConsolTransport vt
LEFT JOIN dbo.ChatData_ViewShipConsolLink vsc ON vsc.Link_ConsolNumber=vt.ConsoleNumber
LEFT JOIN dbo.ChatData_ViewRevandVolume_ShipmentDate vs ON vs.ShipmentNumber=vsc.Link_ShipmentNum
WHERE vt.TransportMode = 'SEA'
GROUP BY vt.ConsoleNumber ORDER BY vt.ConsoleNumber
"""


class SeaQueryOptimizerTest(unittest.TestCase):
    def setUp(self):
        database.query_results.clear()

    def test_flattening_preserves_all_totals_counts_nulls_and_join_multipliers(self):
        conn = sqlite3.connect(":memory:")
        self.addCleanup(conn.close)
        conn.execute("ATTACH DATABASE ':memory:' AS dbo")
        conn.executescript("""
        CREATE TABLE dbo.RevandVolFact (RVF_ShipmentNumber TEXT, RVF_Company TEXT,
            RVF_Branch TEXT, RVF_USD_Revenue NUMERIC, RVF_USD_Cost NUMERIC,
            RVF_USD_Profit NUMERIC, RVF_Destination_Code TEXT, Country TEXT, Bucket TEXT);
        CREATE TABLE dbo.DimBranch (BranchCode TEXT, BranchName TEXT, City TEXT);
        CREATE TABLE dbo.DimCountry (Code TEXT);
        CREATE TABLE dbo.Volumes (Job TEXT, Country TEXT, Mode TEXT, Volume NUMERIC);
        CREATE TABLE dbo.StagingTablesLastUpdateTimeMax (Time TEXT);
        CREATE TABLE dbo.ChatData_ViewShipConsolTransport (ConsoleNumber TEXT,
            TransportMode TEXT, FCLTEU NUMERIC, LCLVolume NUMERIC);
        CREATE TABLE dbo.ChatData_ViewShipConsolLink (Link_ConsolNumber TEXT, Link_ShipmentNum TEXT);
        INSERT INTO dbo.DimBranch VALUES ('BLR','Bengaluru A','Bengaluru'), ('BLR','Bengaluru B','Bengaluru');
        INSERT INTO dbo.DimCountry VALUES ('IN'),('IN');
        INSERT INTO dbo.StagingTablesLastUpdateTimeMax VALUES ('one'),('two');
        INSERT INTO dbo.RevandVolFact VALUES
            ('S1','IND','BLR',100,-60,40,'SIN','IN','A'),
            ('S1','IND','BLR',25,-10,15,'SIN','IN','A'),
            ('S1','IND','BLR',10,-4,6,'SIN','IN','B'),
            ('S2','IND','MAA',80,-30,50,'SIN','IN','A'),
            ('S3','CMB','CMB',NULL,NULL,NULL,'SIN','LK','A');
        INSERT INTO dbo.Volumes VALUES ('S1','IN','SEA',2),('S1','IN','SEA',4),('S1','IN','LCL',3);
        INSERT INTO dbo.ChatData_ViewShipConsolTransport VALUES
            ('C1','SEA',2.5,10.25),('C2','SEA',1,5.5),('C3','SEA',3,0),('C4','AIR',0,0);
        INSERT INTO dbo.ChatData_ViewShipConsolLink VALUES ('C1','S1'),('C1','S1'),('C1','S2'),('C2','S3');
        """)
        conn.execute(DEFINITION)
        # Multiple customer/dimension matches never multiply consol quantities.
        rows = conn.execute(QUERY).fetchall()
        self.assertEqual(rows[0][1:3], (2.5, 10.25))
        self.assertEqual(sum(row[1] for row in rows), 6.5)
        for extra_filter in ("", " AND vs.Company='IND'", " AND vs.Branch='BLR'"):
            query = QUERY.replace("GROUP BY vt.ConsoleNumber", extra_filter + "\nGROUP BY vt.ConsoleNumber")
            original = conn.execute(query).fetchall()
            optimized = conn.execute(optimize_query(query, DEFINITION)).fetchall()
            self.assertEqual(original, optimized)
        unlinked = conn.execute(QUERY).fetchall()[-1]
        self.assertEqual(unlinked[3], "Unlinked")
        self.assertEqual(unlinked[5], 0)
        self.assertIsNone(unlinked[6])
        source = compile_revenue_source(DEFINITION)
        self.assertIn("GROUP BY Job, Country, Mode", source)
        self.assertIn("CROSS JOIN dbo.StagingTablesLastUpdateTimeMax", source)
        self.assertNotIn("GROUP BY RVF.", source)

    def test_non_additive_custom_queries_and_air_queries_keep_original_source(self):
        variants = [QUERY.replace("'SEA'", "'AIR'"),
                    QUERY.replace("COUNT(DISTINCT vs.ShipmentNumber)", "COUNT(vs.ShipmentNumber)"),
                    QUERY.replace("COUNT(DISTINCT vs.ShipmentNumber)", "COUNT_BIG(vs.ShipmentNumber)"),
                    QUERY.replace("COUNT(DISTINCT vs.ShipmentNumber)", "STDEV(vt.ConsoleNumber)"),
                    QUERY.replace("SUM(vs.Revenue_USD)", "SUM(DISTINCT vs.Revenue_USD)"),
                    QUERY.replace("MAX(vt.FCLTEU)", "SUM(vt.FCLTEU)"),
                    QUERY.replace("SUM(vs.Revenue_USD)", "AVG(vs.Revenue_USD)"),
                    QUERY.replace("SUM(vs.Revenue_USD)", "SUM(1)"),
                    QUERY.replace("SUM(vs.Revenue_USD)", "SUM(CASE WHEN vs.Company='IND' THEN 1 ELSE 0 END)"),
                    QUERY.replace("GROUP BY vt.ConsoleNumber", "AND vs.Revenue_USD > 100\nGROUP BY vt.ConsoleNumber"),
                    QUERY.replace("GROUP BY vt.ConsoleNumber", "AND Revenue_USD > 100\nGROUP BY vt.ConsoleNumber"),
                    QUERY.replace("SUM(vs.Revenue_USD)", "MAX(Revenue_USD)"),
                    QUERY.replace("MAX(vs.BranchName)", "MAX(vs.ConsigneeName)")]
        for query in variants:
            self.assertFalse(can_optimize(query), query)
            self.assertEqual(optimize_query(query, DEFINITION), query)
        self.assertTrue(can_optimize(QUERY.replace("COUNT(DISTINCT", "COUNT( DISTINCT")))

    def test_changed_view_definitions_do_not_silently_change_amounts(self):
        for definition in (DEFINITION.replace("SUM(RVF.RVF_USD_Revenue)", "ROUND(SUM(RVF.RVF_USD_Revenue),2)"),
                           DEFINITION.replace("GROUP BY RVF.", "WHERE RVF.RVF_Company='IND' GROUP BY RVF."),
                           DEFINITION.replace("d.Revenue_USD,", "ABS(d.Revenue_USD) AS Revenue_USD,")):
            with self.assertRaises(ValueError):
                compile_revenue_source(definition)

    def test_read_path_uses_optimization_and_reuses_original_query_cache_key(self):
        data = pd.DataFrame([{"Revenue_USD": 100}])
        def read(sql, params=None):
            if sql == VIEW_DEFINITION_SQL:
                return pd.DataFrame([{"definition": DEFINITION}])
            self.assertIn("dbo.RevandVolFact AS RVF", sql)
            self.assertNotIn("GROUP BY RVF.", sql)
            return data
        with patch.object(database, "_run_query_uncached", side_effect=read) as query:
            database.run_query(QUERY)
            database.run_query(QUERY)
        self.assertEqual(query.call_count, 2)  # One metadata read and one report read.

    def test_view_only_accounts_fall_back_to_original_query(self):
        error = ProgrammingError("optimized source", {}, Exception("permission denied"))
        with patch.object(database, "_run_query_uncached", side_effect=[
            pd.DataFrame([{"definition": DEFINITION}]), error, pd.DataFrame([{"Revenue_USD": 100}])
        ]) as query:
            database.run_query(QUERY)
        self.assertEqual(query.call_count, 3)
        self.assertEqual(query.call_args.args[0], QUERY)

    def test_commented_report_templates_are_optimized_and_cached(self):
        report = "-- Station-wise Report Query Template\n/* weekly */\n" + QUERY
        with patch.object(database, "_run_query_uncached", side_effect=[
            pd.DataFrame([{"definition": DEFINITION}]), pd.DataFrame([{"Revenue_USD": 100}])
        ]) as query:
            database.run_query(report)
            database.run_query(report)
        self.assertEqual(query.call_count, 2)
        self.assertIn("dbo.RevandVolFact AS RVF", query.call_args.args[0])

    def test_missing_metadata_keeps_original_query(self):
        with patch.object(database, "_run_query_uncached", side_effect=[pd.DataFrame(), pd.DataFrame()]) as query:
            database.run_query(QUERY)
        self.assertEqual(query.call_args.args[0], QUERY)

    def test_unscoped_dropdowns_do_not_join_shipment_revenue(self):
        with patch.object(sea, "run_query", return_value=pd.DataFrame()) as query:
            sea.get_sea_options("airlines", "2026-09-21", "2026-09-27", country="India")
            self.assertNotIn("ChatData_ViewRevandVolume", query.call_args.args[0])
            sea.get_sea_options("airlines", "2026-09-21", "2026-09-27", country="India", company_code="IND")
            self.assertIn("vs.Company IN (:company_0)", query.call_args.args[0])
            self.assertTrue(can_optimize(query.call_args.args[0]))


if __name__ == "__main__":
    unittest.main()
