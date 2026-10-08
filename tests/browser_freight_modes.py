"""Headless smoke test against a static build; all external calls are fixtures.

Serve frontend/out on localhost:4173 before running. No emails, subscriptions,
database queries or authentication requests leave this browser session.
"""
import base64
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4173"
requests_seen = []
created_schedules = []
cached_queries = {}
sea_rows = [
    {"Console_Number": "SEA-1001", "Master_Bill_of_Lading": "BOL-001", "Shippingline": "Maersk", "ShippinglineGroup": "Maersk",
     "Airline": "Maersk", "FCL_TEU_Count": 2.5, "LCL_Volume": 10.25, "Total_Volume_M3": 10.25,
     "Total_Tonnage": 2.5, "Revenue_USD": 1000, "Total_Revenue": 1000, "Cost_USD": 600, "Profit_USD": 400,
     "Company_Code": "IND", "Origin_Country": "India", "Origin_City": "Mumbai", "Destination_Country": "Singapore", "Destination_City": "Singapore",
     "ETD": "2026-09-25T10:00:00", "Total_Shipments": 3},
    {"Console_Number": "SEA-1002", "Master_Bill_of_Lading": "BOL-002", "Shippingline": "MSC", "ShippinglineGroup": "MSC",
     "Airline": "MSC", "FCL_TEU_Count": 1, "LCL_Volume": 5.5, "Total_Volume_M3": 5.5,
     "Total_Tonnage": 1, "Revenue_USD": 2000, "Total_Revenue": 2000, "Cost_USD": 1500, "Profit_USD": 500,
     "Company_Code": "IND", "Origin_Country": "India", "Origin_City": "Chennai", "Destination_Country": "Singapore", "Destination_City": "Singapore",
     "ETD": "2026-09-26T10:00:00", "Total_Shipments": 2},
]
air_rows = [dict(sea_rows[0], Airline="Turkish Airlines", Total_Tonnage=2500, Tonnage_Chargeable=2500)]


def respond(route, data):
    route.fulfill(status=200, content_type="application/json", body=json.dumps(data),
                  headers={"Access-Control-Allow-Origin": "*"})


def intercept(route):
    request = route.request
    url = urlparse(request.url)
    params = parse_qs(url.query)
    if url.hostname == "fixture.supabase.co":
        data = {"email": "fixture@example.test"} if "allowed_admins" in url.path else []
        if "station_recipients" in url.path:
            data = [{"station_code": "IND", "email": "fixture@example.test"}]
        respond(route, data)
        return
    if url.hostname not in ("127.0.0.1", "localhost") and not url.path.startswith("/api/"):
        route.abort()
        return
    if not url.path.startswith("/api/"):
        route.continue_()
        return
    if request.method == "OPTIONS":
        route.fulfill(status=204, headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"})
        return
    requests_seen.append((url.path, params, request.post_data_json if request.method == "POST" else None))
    sea = params.get("transport_mode") == ["SEA"]
    rows = sea_rows if sea else air_rows
    endpoint = url.path.removeprefix("/api/")
    if endpoint == "config":
        respond(route, {"supabaseUrl": "https://fixture.supabase.co", "supabaseAnonKey": "fixture-anon-key"})
    elif endpoint == "custom-query":
        rows = sea_rows if request.post_data_json.get("transport_mode") == "SEA" else air_rows
        respond(route, {"status": "success", "data": rows, "rowCount": len(rows)})
    elif endpoint == "cache-query":
        cached_queries["fixture-query"] = request.post_data_json["query"]
        respond(route, {"status": "success", "query_id": "fixture-query"})
    elif endpoint.startswith("get-cached-query"):
        respond(route, {"status": "success", "query": cached_queries["fixture-query"]})
    elif endpoint == "data":
        respond(route, {"status": "success", "data": rows})
    elif endpoint == "kpi":
        respond(route, {"status": "success", "data": {"Total_Tonnage": 3.5 if sea else 2500, "Total_Volume_M3": 15.75,
            "Total_Revenue": 3000, "Total_Cost": 2100, "Total_Profit": 900, "Total_Shipments": 5, "Total_Masters": 2}})
    elif endpoint in ("weekly", "monthly"):
        respond(route, {"status": "success", "data": [{"Year": 2026, "Week": 39, "Month": 9, "Week_Start": "2026-09-21",
            "week_label": "W39 '26", "month_label": "Sep '26", "Total_Tonnage": 3.5 if sea else 2500,
            "Total_Volume_M3": 15.75, "Total_Revenue": 3000, "Total_Shipments": 5}]})
    elif endpoint == "countries":
        respond(route, {"status": "success", "data": ["India"]})
    elif endpoint in ("origin-cities", "destination-cities"):
        respond(route, {"status": "success", "data": ["Mumbai", "Chennai", "Singapore"]})
    elif endpoint == "destination-countries":
        respond(route, {"status": "success", "data": ["Singapore"]})
    elif endpoint == "airlines":
        respond(route, {"status": "success", "data": ["Maersk", "MSC"] if sea else ["Turkish Airlines"]})
    elif endpoint == "company-codes":
        respond(route, {"status": "success", "data": [{"code": "IND", "name": "India"}]})
    elif endpoint == "branches":
        respond(route, {"status": "success", "data": [{"code": "BLR", "name": "Bengaluru", "country": "India", "company_code": "IND"}]})
    elif endpoint == "schedules" and request.method == "POST":
        created_schedules.append(request.post_data_json)
        respond(route, {"status": "success", "id": f"fixture-{len(created_schedules)}"})
    elif endpoint == "schedules":
        respond(route, {"status": "success", "data": []})
    elif endpoint == "station-recipients":
        respond(route, {"status": "success", "data": {"IND": ["fixture@example.test"]}})
    elif endpoint == "send-report":
        respond(route, {"status": "success", "message": "Fixture captured; no email sent."})
    else:
        respond(route, {"status": "success", "data": []})


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get("FREIGHT_TEST_BROWSER", "chrome"), headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1050})
        context.route("**/*", intercept)
        token_part = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + 86400, "sub": "fixture"}).encode()).decode().rstrip("=")
        session = {"access_token": "eyJhbGciOiJIUzI1NiJ9." + token_part + ".fixture", "refresh_token": "fixture-refresh", "token_type": "bearer",
                   "expires_in": 86400, "expires_at": int(time.time()) + 86400, "user": {"id": "fixture", "email": "fixture@example.test", "aud": "authenticated"}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")
        air = page.locator("#freight-panel-AIR")
        try:
            air.get_by_role("tab", name="Air Freight").wait_for(timeout=10000)
        except Exception:
            print("Initial page:", page.inner_text("body"))
            print("Browser errors:", errors)
            print("Requests:", [path for path, _, _ in requests_seen])
            raise
        card_styles = "el => {const s = getComputedStyle(el); return {height:s.height, padding:s.padding, radius:s.borderRadius, background:s.backgroundColor}}"
        air_card = air.locator(".saas-card.h-28").first.evaluate(card_styles)
        air.locator('input[type="date"]').first.fill("2026-08-01")
        air.get_by_role("tab", name="Sea Freight").click()
        sea = page.locator("#freight-panel-SEA")
        sea.get_by_text("LCL Volume", exact=True).wait_for()
        assert "15.75" in sea.inner_text(), "LCL volume must retain decimals"
        assert "3.5" in sea.inner_text(), "FCL TEUs must retain decimals"
        assert sea.locator(".sea-kpi-card").count() == 4
        assert sea.locator(".sea-kpi-card").first.evaluate(card_styles) == air_card, "Sea KPI styling should match Air"
        assert sea.locator(".sea-operational-grid .recharts-pie").count() == 1
        assert "Cargo Revenue Trend - Weekly" in sea.inner_text()
        assert sea.locator('input[type="date"]').first.input_value() != "2026-08-01"
        sea.locator('input[type="date"]').first.fill("2026-09-21")
        Path("outputs").mkdir(exist_ok=True)
        page.screenshot(path="outputs/sea-dashboard-preview.png", full_page=True)
        sea.locator(".sea-kpi-grid").scroll_into_view_if_needed()
        page.screenshot(path="outputs/sea-dashboard-air-style.png")
        sea.get_by_role("button", name="Weekly Reports", exact=True).click()
        sql = sea.locator("textarea").input_value()
        assert "TransportMode = 'SEA'" in sql and "Shippingline" in sql and "FCLTEU" in sql
        assert "Air_ChargebleWeight" not in sql and "AirlineName1" not in sql
        assert "FCL_TEU_Count" in sql and "LCL_Volume" in sql
        assert not re.search(r"ShipmentNumber\) AS|Cost_USD|Profit_USD", sql)
        sea.locator("textarea").fill(sql + "\n-- Sea editor state")
        sea.get_by_role("button", name=re.compile("Execute Custom SQL")).click()
        sea.get_by_text(re.compile("Query executed successfully")).wait_for()
        sea.get_by_role("button", name="PDF Preview", exact=True).click()
        sea.locator("iframe").wait_for()
        assert "transport_mode=SEA" in sea.locator("iframe").get_attribute("src")
        page.frame_locator("#pdf-iframe-SEA").locator("#pdf-ready").wait_for()
        preview = page.frame_locator("#pdf-iframe-SEA").locator("[data-sea-report]")
        assert "Consol Ledger" in preview.inner_text()
        assert "no. of consols" in preview.inner_text().lower()
        assert preview.get_by_alt_text("DGL Logo").count() == 1
        assert "Top 10 Shipping Lines FCL TEU Share" in preview.inner_text()
        assert "2.5 TEU" in preview.locator('[data-sea-share-line="Maersk"]').inner_text()
        assert "(71.4%)" in preview.locator('[data-sea-share-line="Maersk"]').inner_text()
        assert "1 TEU" in preview.locator('[data-sea-share-line="MSC"]').inner_text()
        assert "(28.6%)" in preview.locator('[data-sea-share-line="MSC"]').inner_text()
        assert preview.locator(".recharts-bar").count() >= 2
        assert not re.search(r"Shipments|Masters|Cost|Profit|Margin", preview.inner_text(), re.I)
        shipping_table = preview.locator('[data-sea-table="Shipping Line Consol Summary"]')
        assert shipping_table.locator('[data-summary-row]').count() == 2
        assert shipping_table.locator('[data-route-row]').count() == 2
        assert shipping_table.locator('tbody [aria-label="71.43% of FCL TEUs"]').count() == 1
        for title in ("Shipping Line Consol Summary", "Trade Route Consol Summary", "Destination Consol Summary"):
            table = preview.locator(f'[data-sea-table="{title}"]')
            cells = table.locator('tfoot td').all_text_contents()
            assert cells[-4:] == ['3.5', '15.75', '2', '$3,000.00'], (title, cells)
        assert preview.locator('[data-sea-table="Trade Route Consol Summary"] thead').get_by_text('Origin City', exact=True).count() == 1
        frame = page.frame_locator("#pdf-iframe-SEA")
        frame.locator('#show-route-breakdown').uncheck()
        assert shipping_table.locator('[data-route-row]').count() == 0
        assert shipping_table.locator('tfoot td').all_text_contents()[-4:] == ['3.5', '15.75', '2', '$3,000.00']
        frame.locator('#show-route-breakdown').check()
        assert not any(path == "/api/sector-carrier-distribution" and ((body and body.get("transport_mode") == "SEA")
                       or params.get("transport_mode") == ["SEA"]) for path, params, body in requests_seen), "Sea should derive summaries from consol data"
        sea.get_by_role("button", name="Close PDF preview", exact=True).click()
        sea.get_by_role("tab", name="Air Freight").click()
        assert air.locator('input[type="date"]').first.input_value() == "2026-08-01"
        air.get_by_role("button", name="Weekly Reports", exact=True).click()
        air_sql = air.locator("textarea").input_value()
        assert "TransportMode = 'AIR'" in air_sql and "AirlineName1" in air_sql
        assert "Sea editor state" not in air_sql
        air.get_by_role("tab", name="Sea Freight").click()
        assert "Sea editor state" in sea.locator("textarea").input_value()

        # Schedule saves are intercepted; verify the complete form carries SEA.
        sea.get_by_role("button", name="Email Scheduling", exact=True).click()
        sea.get_by_role("button", name="Configure New Schedule", exact=True).click()
        sea.get_by_role("button", name=re.compile("Match Target Selection")).click()
        sea.get_by_role("button", name="Save Schedule", exact=True).click()
        sea.get_by_text(re.compile("Successfully configured")).wait_for()
        assert created_schedules and all(item["filters"]["transport_mode"] == "SEA" for item in created_schedules)

        # Verify native sea print output independently of the preview modal.
        print_page = context.new_page()
        print_page.on("pageerror", lambda error: errors.append(str(error)))
        print_page.goto(BASE + "/print-view/?" + urlencode({"transport_mode": "SEA", "start_date": "2026-09-21", "end_date": "2026-09-27"}), wait_until="networkidle")
        print_page.locator("#pdf-ready").wait_for()
        assert "15.75" in print_page.inner_text("body")
        assert "LCL Volume" in print_page.inner_text("body")
        assert not re.search(r"\bkg\b|Airline|AIR CARRIERS|Shipments|Masters|Financial summary", print_page.inner_text("body")), "Sea print view contains air labels"
        print_page.screenshot(path="outputs/sea-print-preview.png", full_page=True)
        print_page.pdf(path="outputs/sea-fixture-report.pdf", format="A4", landscape=True, print_background=True)
        print_page.goto(BASE + "/print-view/?" + urlencode({"transport_mode": "SEA", "start_date": "2026-09-21", "end_date": "2026-09-27", "max_data_rows": "1"}), wait_until="networkidle")
        print_page.locator("#pdf-ready").wait_for()
        ledger = print_page.locator('[data-sea-table="Consol Ledger"]')
        assert ledger.locator('tbody tr').count() == 1
        assert ledger.locator('tfoot td').all_text_contents() == ['SUBTOTAL (DISPLAYED CONSOLS)', '2.5', '10.25', '$1,000.00']
        assert print_page.locator('[data-sea-table="Shipping Line Consol Summary"] tfoot td').all_text_contents()[-4:] == ['3.5', '15.75', '2', '$3,000.00']
        assert any(path == "/api/custom-query" and body["transport_mode"] == "SEA" for path, _, body in requests_seen)
        assert not errors, errors
        browser.close()
        print("PASS: Air/Sea switching, independent dates and SQL, sea metrics, SQL execution, sea schedule creation, PDF preview, and printable sea report.")


if __name__ == "__main__":
    main()
