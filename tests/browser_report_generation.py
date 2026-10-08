"""Render real AIR/SEA PDFs with fixture APIs; never send an email."""
import json
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse
from unittest.mock import patch

from playwright.sync_api import sync_playwright
from api import pdf_service
from browser_freight_modes import BASE, intercept, requests_seen


def main():
    Path("outputs").mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        api_hosts = []
        def fixtures(route):
            parsed = urlparse(route.request.url)
            if parsed.path.startswith("/api/"):
                api_hosts.append(parsed.hostname)
            if parsed.path.endswith("/expired"):
                route.fulfill(status=404, content_type="application/json",
                              body=json.dumps({"detail": "Query not found or expired"}))
            else:
                intercept(route)

        # Verify a production build viewed locally uses local API URLs.
        page = browser.new_page()
        page.route("**/*", fixtures)
        started = time.monotonic()
        page.goto(BASE + "/print-view/?" + urlencode({"transport_mode": "SEA", "include_sector_distribution": "false"}))
        page.locator("#pdf-ready").wait_for()
        elapsed = time.monotonic() - started
        assert api_hosts and all(host in ("localhost", "127.0.0.1") for host in api_hosts), api_hosts
        assert not any(path == "/api/sector-carrier-distribution" for path, _, _ in requests_seen)
        print(f"PASS: local SEA preview ready in {elapsed:.2f}s with fixture data; excluded sectors were not requested.")

        page.goto(BASE + "/print-view/?mode=custom-sql&query_id=expired&transport_mode=SEA")
        page.locator("#print-error").wait_for()
        assert page.locator("#pdf-ready").count() == 0
        assert "expired" in page.locator("#print-error").inner_text()
        page.close()

        # Exercise the application's real PDF function using installed Chrome
        # and intercept every API/external request from its fresh browser pages.
        class FixtureBrowser:
            page = None
            def new_page(self, **kwargs):
                self.page = browser.new_page(**kwargs)
                self.page.route("**/*", fixtures)
                return self.page
            def close(self):
                if self.page:
                    self.page.close()

        class FixtureChromium:
            def launch(self, **kwargs):
                return FixtureBrowser()

        class FixturePlaywright:
            chromium = FixtureChromium()
            def __enter__(self):
                return self
            def __exit__(self, *args):
                return False

        for mode in ("AIR", "SEA"):
            start = len(requests_seen)
            started = time.monotonic()
            output = f"outputs/{mode.lower()}-checked-report.pdf"
            with patch.object(pdf_service, "sync_playwright", return_value=FixturePlaywright()), \
                 patch.object(pdf_service, "get_tonnage_base_url", return_value=BASE):
                pdf_service.generate_dashboard_pdf(output, start_date="2026-09-21", end_date="2026-09-27",
                    transport_mode=mode, mode="custom-sql", query_id="expired",
                    custom_sql=f"SELECT * FROM vt WHERE TransportMode = '{mode}'", include_sector_distribution=False)
            assert Path(output).stat().st_size > 20000
            sent = requests_seen[start:]
            assert not any(path.startswith("/api/get-cached-query") for path, _, _ in sent)
            assert any(path == "/api/custom-query" and body["transport_mode"] == mode for path, _, body in sent)
            print(f"PASS: actual {mode} PDF generated in {time.monotonic() - started:.2f}s with fixture data; injected SQL bypassed the expired query ID.")
        browser.close()
        print("PASS: expired previews show an error and never become PDF-ready. No emails sent.")


if __name__ == "__main__":
    main()
