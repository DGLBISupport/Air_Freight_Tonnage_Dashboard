"""Verify per-report recipients and send payloads against fixture APIs only."""
import base64
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, respond, requests_seen


def main():
    fail_send = False

    def fixture(route):
        url = urlparse(route.request.url)
        if url.hostname == "fixture.supabase.co" and url.path.endswith("/users"):
            respond(route, [{"email": "jane.silva@example.test", "display_name": "Jane Silva"}]
                    if route.request.method == "GET" else [])
        elif url.path == "/api/org-users":
            respond(route, {"status": "success", "users": [{"email": "nimal.perera@example.test", "displayName": "Nimal Perera"}], "byDepartment": {}})
        elif url.path == "/api/recipients":
            respond(route, {"status": "success", "data": ["shashini.hq@dartglobal.com"]})
        elif url.path == "/api/send-report" and fail_send:
            route.fulfill(status=500, content_type="application/json", body=json.dumps({"detail": "Fixture mail service unavailable"}), headers={"Access-Control-Allow-Origin": "*"})
        else:
            intercept(route)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1050})
        context.route("**/*", fixture)
        token = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + 86400, "sub": "fixture"}).encode()).decode().rstrip("=")
        session = {"access_token": "eyJhbGciOiJIUzI1NiJ9." + token + ".fixture", "refresh_token": "fixture-refresh", "token_type": "bearer",
                   "expires_in": 86400, "expires_at": int(time.time()) + 86400, "user": {"id": "fixture", "email": "fixture@example.test", "aud": "authenticated"}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")
        page.locator("#freight-panel-AIR").get_by_role("tab", name="Air Freight").wait_for()
        cases = [("AIR", "Weekly", "Jane Silva", "jane.silva@example.test"),
                 ("AIR", "Monthly", None, "person.monthly@example.test"),
                 ("SEA", "Weekly", "Nimal Perera", "nimal.perera@example.test"),
                 ("SEA", "Monthly", None, "sea.monthly@example.test")]
        for mode, period, name, email in cases:
            page.get_by_role("tab", name="Sea Freight" if mode == "SEA" else "Air Freight").click()
            root = page.locator(f"#freight-panel-{mode}")
            root.get_by_role("button", name=f"{period} Reports", exact=True).click()
            picker = root.locator("[data-report-recipient]")
            picker.get_by_text("shashini.hq@dartglobal.com", exact=True).wait_for()
            send = picker.get_by_role("button", name="Preview & Send Report", exact=True)
            assert send.is_disabled(), "Sending must require successful execution"
            field = picker.get_by_role("combobox", name="Recipient name or email")
            field.fill("not-an-email")
            picker.get_by_role("button", name="Select recipient").click()
            assert "valid email address" in picker.get_by_role("alert").inner_text()
            field.fill(name or email)
            if name:
                picker.get_by_role("option", name=re.compile(name)).wait_for()
                field.press("ArrowDown")
                page.keyboard.press("Enter")
            else:
                field.press("Enter")
            picker.get_by_text(email, exact=True).wait_for()
            assert "shashini.hq@dartglobal.com" not in picker.inner_text(), "Chosen person must replace the default address"
            sql = root.locator("textarea")
            query = sql.input_value() + f"\n-- recipient QA {mode} {period}"
            sql.fill(query)
            root.get_by_role("button", name=re.compile("Execute Custom SQL")).click()
            root.get_by_text(re.compile("Query executed successfully")).wait_for()
            assert send.is_enabled()
            # An edited query must be executed again before sending.
            sql.fill(query + "\n-- pending edit")
            assert send.is_disabled()
            sql.fill(query)
            assert send.is_enabled()
            Path("outputs").mkdir(exist_ok=True)
            if mode == "SEA" and period == "Weekly":
                picker.scroll_into_view_if_needed()
                page.screenshot(path="outputs/sql-report-recipient-picker.png")
            send.click()
            root.get_by_role("button", name="Preview PDF", exact=True).click()
            page.frame_locator(f"#pdf-iframe-{mode}").locator("#pdf-ready").wait_for()
            confirm = root.get_by_role("button", name="Confirm & Send to (1)", exact=True)
            assert email in root.inner_text()
            if mode == "SEA" and period == "Monthly":
                fail_send = True
                confirm.click()
                root.get_by_text("Fixture mail service unavailable", exact=True).first.wait_for()
                # Failed delivery keeps the preview open for retry.
                page.wait_for_timeout(2700)
                assert confirm.is_visible() and confirm.is_enabled()
                fail_send = False
            confirm.click()
            root.get_by_text(f"Report sent to {email}.", exact=True).wait_for()
            payload = [body for path, _, body in requests_seen if path == "/api/send-report"][-1]
            assert payload["recipient_email"] == email, payload
            assert payload["transport_mode"] == mode and payload["report_type"] == period.lower()
            assert payload["mode"] == "custom-sql" and payload["custom_sql"] == query
            root.get_by_role("button", name="Close PDF preview").click()
            print(f"PASS: {mode} {period}: name/email selection, exact recipient and SQL send payload.", flush=True)
        for mode, period, _, email in cases:
            page.get_by_role("tab", name="Sea Freight" if mode == "SEA" else "Air Freight").click()
            root = page.locator(f"#freight-panel-{mode}")
            root.get_by_role("button", name=f"{period} Reports", exact=True).click()
            picker = root.locator("[data-report-recipient]")
            assert email in picker.inner_text(), "Recipient leaked between Air/Sea or Weekly/Monthly reports"
        assert not errors, errors
        print("PASS: independent recipients persist across all four reports; no actual emails sent.", flush=True)
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
