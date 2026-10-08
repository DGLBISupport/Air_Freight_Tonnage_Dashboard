"""Check rendered Sea daily axes in browser timezones; all APIs are fixtures."""
import json
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, sea_rows


def main():
    sea_rows[0]["ETD"] = "2026-10-01T00:15:00"
    sea_rows[1]["ETD"] = "2026-10-06T20:00:00Z"  # October 7 in India.
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        for zone in ("UTC", "Asia/Colombo", "America/Los_Angeles"):
            context = browser.new_context(timezone_id=zone)
            context.route("**/*", intercept)
            context.add_init_script("window.__FREIGHT_PRINT_CONFIG__ = " + json.dumps({
                "customSql": "SELECT * WHERE TransportMode='SEA' AND ETD >= '2026-10-01' AND ETD <= '2026-10-07'"}))
            page = context.new_page()
            params = {"mode": "custom-sql", "transport_mode": "SEA", "company_code": "IND",
                      "start_date": "2026-10-01", "end_date": "2026-10-07", "include_sector_distribution": "false"}
            page.goto(BASE + "/print-view/?" + urlencode(params))
            page.locator("#pdf-ready").wait_for()
            axes = " ".join(page.locator(".recharts-xAxis").all_text_contents())
            assert "Thu 1/10" in axes and "Wed 7/10" in axes, axes
            assert "30/9" not in axes and "2026-09-30" not in axes, axes
            assert "2026-10-01" in axes and "2026-10-07" in axes, "LCL chart uses different operational days"
            print(f"PASS: rendered FCL and LCL daily charts stay on station dates in {zone}.")
            context.close()
        browser.close()


if __name__ == "__main__":
    main()
