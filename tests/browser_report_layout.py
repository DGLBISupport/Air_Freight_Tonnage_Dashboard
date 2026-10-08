"""Check grouped Sea pages and Air flow against fixture APIs; no real emails or writes."""
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
                               "include_monthly_visual": "false", "include_monthly_ledger": "false",
                               "include_sea_sector_distribution": "false"})
            page.goto(BASE + "/print-view/?" + urlencode(params))
            page.locator("#pdf-ready").wait_for()
            if mode == "SEA" and not only_volume:
                assert page.locator('[data-sea-page]').evaluate_all('els => els.map(el => el.dataset.seaPage)') == [
                    'overview', 'shipping-breakdown', 'route-distribution', 'trade-routes', 'geographical-fcl', 'geographical-lcl', 'sectors', 'shipping-summary']
                assert page.locator('[data-sea-table], [data-sea-sector-report], [data-sea-route-metric]').last.get_attribute('data-sea-table') == 'Shipping Line Consol Summary'
                assert page.locator('[data-sea-share-line="Shipping Line 01"]').inner_text().endswith('(5.0%)')
                assert '25 TEU' in page.locator('[data-sea-share-line="Others"]').inner_text()
                assert '(50.0%)' in page.locator('[data-sea-share-line="Others"]').inner_text()
                pie = page.locator('[data-sea-chart="Shipping Line TEU Share"]')
                legend = pie.locator('[data-sea-line-list] > div')
                assert legend.count() == 6, "Pie must show five shipping lines plus Others"
                assert legend.last.inner_text().splitlines() == ["Others", "37.5 TEU", "(75.0%)"]
                assert pie.locator('.recharts-pie-sector').count() == 6
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
                assert 'Shipping Line TEU Share' in texts[0] and 'Daily FCL TEUs' not in texts[0]
                assert 'Departure Trend' not in combined and 'Daily FCL TEUs' not in combined
                assert 'Shipping Line FCL TEUs' in texts[1] and 'Shipping Line LCL Volume' in texts[1]
                assert 'Trade Routes by TEU (Top 5)' in texts[2] and 'Trade Routes by Volume (Top 5)' in texts[2]
                assert 'Trade Route Consol Summary' in texts[3]
                assert 'Sea Exports - Geographical Tonnage Contribution (FCL)' in texts[4]
                assert 'Sea Exports - Geographical Tonnage Contribution (LCL)' in texts[5]
                assert 'TOP 20 SHIPPING LINES' in texts[6] and 'FCL TEUs - Sector wise' in texts[6]
                assert 'LCL Volume - Sector wise' in texts[7]
                assert 'Shipping Line Consol Summary' in texts[8]
                for i in range(1, count + 1):
                    assert f"Shipping Line {i:02}" in combined, f"Missing line {i}"
                fcl_total_page = next(text for text in texts if "TOTAL 50.00" in text)
                assert "Shipping Line 20" in fcl_total_page.split("LCL Volume - Sector wise")[0], "FCL total is orphaned from the last shipping line"
            if mode == "SEA" and not only_volume:
                assert "Consol Ledger" not in combined and "Shipping Line 20" in combined
                assert not any(label in combined for label in ("No. of Shipments", "No. of Consols", "Profit", "GP Margin"))
            if only_volume:
                assert "Sea Freight Consol Analysis" in texts[0] and "LCL VOLUME" in texts[0].upper()
                assert len(pages) <= 2, f"{count}-line consol volume report unexpectedly spans {len(pages)} pages"
            print(f"PASS: {name}: {len(pages)} pages; correct section order, no blank pages or clipped shipping lines.")
            page.close()
        # Long line names and six legend rows must still keep both route charts
        # on page three. Tables may continue onto further pages naturally.
        sea_rows[:] = [dict(original, Console_Number=f"LONG-{i:02}",
                           Shippingline=f"MEDITERRANEAN SHIPPING COMPANY S.A. {i:02}",
                           Origin_City="Visakhapatnam", Destination_Country="United Kingdom",
                           Destination_City=f"Newcastle upon Tyne {i:02}") for i in range(1, 13)]
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.route("**/*", intercept)
        page.add_init_script("window.__FREIGHT_PRINT_CONFIG__ = {customSql: \"SELECT * WHERE TransportMode = 'SEA'\"};")
        page.emulate_media(media="print")
        page.goto(BASE + "/print-view/?mode=custom-sql&transport_mode=SEA")
        page.locator("#pdf-ready").wait_for()
        path = output / "sea-paged-long-labels.pdf"
        page.pdf(path=str(path), format="A4", landscape=True, print_background=True)
        texts = [p.extract_text() for p in PdfReader(path).pages]
        assert 'Shipping Line TEU Share' in texts[0]
        assert 'Departure Trend' not in '\n'.join(texts)
        assert 'Shipping Line FCL TEUs' in texts[1] and 'Shipping Line LCL Volume' in texts[1]
        assert 'Trade Routes by TEU (Top 5)' in texts[2] and 'Trade Routes by Volume (Top 5)' in texts[2]
        assert 'Trade Route Consol Summary' in texts[3]
        assert all(len(text.strip()) >= 140 for text in texts), "Blank/heading-only long-label page"
        for i in range(1, 13):
            assert f"MEDITERRANEAN SHIPPING COMPANY S.A. {i:02}" in " ".join(" ".join(texts).split())
        page.close()
        print(f"PASS: Sea long shipping-line and route labels: {len(texts)} pages; chart pairs remain together.")
        browser.close()


if __name__ == "__main__":
    main()
