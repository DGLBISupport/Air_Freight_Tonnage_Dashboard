"""Offline checks for duplicate-query suppression and gateway fallback."""
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import MagicMock, patch

import pandas as pd
from api import database
from api.data_cache import QueryResultCache


class ReportPerformanceTest(unittest.TestCase):
    def setUp(self):
        database.query_results.clear()
        database._gateway_retry_after.clear()

    def test_concurrent_sea_requests_execute_one_query(self):
        started, release = Event(), Event()
        calls = []
        def load():
            calls.append(True)
            started.set()
            self.assertTrue(release.wait(3))
            return pd.DataFrame([{"TEUCount": 2.5}])
        cache = QueryResultCache()
        with ThreadPoolExecutor(max_workers=4) as pool:
            first = pool.submit(cache.get_or_load, "SEA/India", load)
            self.assertTrue(started.wait(3))
            others = [pool.submit(cache.get_or_load, "SEA/India", load) for _ in range(3)]
            release.set()
            results = [future.result() for future in [first, *others]]
        self.assertEqual(len(calls), 1)
        results[0].iloc[0, 0] = 999
        self.assertEqual(cache.get_or_load("SEA/India", load).iloc[0, 0], 2.5)

    def test_filters_and_freight_modes_have_separate_cache_entries(self):
        with patch.object(database, "_run_query_uncached", return_value=pd.DataFrame([{"value": 1}])) as query:
            for _ in range(2):
                database.run_query("SELECT * WHERE TransportMode = 'SEA'", {"country": "India"})
                database.run_query("SELECT * WHERE TransportMode = 'SEA'", {"country": "Sri Lanka"})
                database.run_query("SELECT * WHERE TransportMode = 'AIR'", {"country": "India"})
        self.assertEqual(query.call_count, 3)

    def test_expiration_size_limits_and_failed_queries(self):
        clock = [100]
        load = MagicMock(return_value=pd.DataFrame([{"value": 1}]))
        with patch("api.data_cache.monotonic", side_effect=lambda: clock[0]):
            cache = QueryResultCache(ttl=60, max_entries=1)
            cache.get_or_load("one", load)
            clock[0] += 61
            cache.get_or_load("one", load)
            cache.get_or_load("two", load)
            cache.get_or_load("one", load)
        self.assertEqual(load.call_count, 4)
        tiny = QueryResultCache(max_bytes=1)
        tiny.get_or_load("large", load)
        tiny.get_or_load("large", load)
        self.assertFalse(tiny._entries)
        with self.assertRaisesRegex(ValueError, "failed"):
            cache.get_or_load("bad", MagicMock(side_effect=ValueError("failed")))
        cache.get_or_load("bad", load)

    def test_failed_gateway_is_not_retried_for_every_report_query(self):
        response = MagicMock(status_code=404)
        engine = MagicMock()
        with patch.dict("os.environ", {"DB_SERVER": "fixture", "DB_USER": "fixture", "DB_PASSWORD": "fixture"}), \
             patch.object(database.requests, "post", return_value=response) as post, \
             patch.object(database, "get_engine", return_value=engine), \
             patch.object(database.pd, "read_sql", return_value=pd.DataFrame()):
            database.run_query("SELECT 1")
            database.run_query("SELECT 2")
        post.assert_called_once()
        self.assertEqual(post.call_args.kwargs["timeout"], (3, 10))


if __name__ == "__main__":
    unittest.main()
