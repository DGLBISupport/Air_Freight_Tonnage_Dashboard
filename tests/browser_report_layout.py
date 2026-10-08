"""Check continuous PDF flow against fixture APIs; no real emails or writes."""
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from browser_freight_modes import BASE, intercept, sea_rows


def main():
    output = Path("outputs")
    output.mkdir(exist_ok=True)
    original = dict(sea_rows[0])
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        for mode, only_volume, count in (("SEA", True, 15), ("SEA", True, 20),
                                        ("SEA", False, 20), ("AIR", False, 20)):
            sea_rows[:] = [dict(original, Console_Number=f"SEA-{i:02}",
                               Shippingline=f"Shipping Line {i:02}", Airline=f"Shipping Line {i:02}",
                               ETD=f"2026-09-{21 + i % 7:02}T10:00:00") for i in range(1, count + 1)]
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            page.route("**/*", intercept)
            page.add_init_script("window.__FREIGHT_PRINT_CONFIG__ = "
                                 f"{{customSql: \"SELECT * WHERE TransportMode = '{mode}'\"}};")
            page.emulate_media(media="print")
            params = {"mode": "custom-sql", "transport_mode": mode,
                      "include_sector_distribution": "false"}
            if only_volume:
                params.update({"include_weekly_visual": "false", "include_weekly_ledger": "false",
                               "include_monthly_visual": "false", "include_monthly_ledger": "false"})
            page.goto(BASE + "/print-view/?" + urlencode(params))
            page.locator("#pdf-ready").wait_for()
            if mode == "SEA" and not only_volume:
                assert page.locator('[data-sea-share-line="Shipping Line 01"]').inner_text().endswith('(5.0%)')
                assert '25 TEU' in page.locator('[data-sea-share-line="Others"]').inner_text()
                assert '(50.0%)' in page.locator('[data-sea-share-line="Others"]').inner_text()
            sections = page.locator(".print-page-container").evaluate_all("els => els.map(el => ({"
                "height: getComputedStyle(el).height, minHeight: getComputedStyle(el).minHeight,"
                "breakAfter: getComputedStyle(el).breakAfter, breakInside: getComputedStyle(el).breakInside}))")
            assert all(s["minHeight"] == "0px" and s["breakAfter"] == "auto"
                       and s["breakInside"] == "auto" for s in sections), sections
            name = "sea-continuous-volume" if only_volume else mode.lower() + "-continuous-report"
            if only_volume and count == 15:
                name += "-15"
            path = output / (name + ".pdf")
            page.pdf(path=str(path), format="A4", landscape=True, print_background=True)
            pages = PdfReader(path).pages
            texts = [p.extract_text() for p in pages]
            assert all(len(text.strip()) > 150 for text in texts), "Blank/heading-only PDF page"
            if mode == "SEA" and not only_volume:
                combined = "\n".join(texts)
                for i in range(1, count + 1):
                    assert f"Shipping Line {i:02}" in combined, f"Missing line {i}"
            if mode == "SEA" and not only_volume:
                assert "Consol Ledger" in combined and "SEA-20" in combined
                assert not any(label in combined for label in ("No. of Shipments", "No. of Masters", "Profit", "GP Margin"))
            if only_volume:
                assert "Sea Freight Consol Analysis" in texts[0] and "LCL Volume" in texts[0]
                assert len(pages) <= 2, f"{count}-line consol volume report unexpectedly spans {len(pages)} pages"
            print(f"PASS: {name}: {len(pages)} pages; no blank pages or clipped shipping lines.")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
