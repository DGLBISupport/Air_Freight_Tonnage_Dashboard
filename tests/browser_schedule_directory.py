"""Schedule grouping and individual configuration, with every write intercepted."""
import base64
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, respond


def main():
    users = [
        {"id": "shared", "email": "shared@example.test", "display_name": "Shared Recipient", "station": "IND, BLR", "is_air": True, "is_sea": True},
        {"id": "delhi", "email": "delhi@example.test", "display_name": "Delhi Recipient", "station": "DEL", "is_air": True, "is_sea": False},
        {"id": "cmb", "email": "cmb@example.test", "display_name": "Colombo Recipient", "station": "CMB", "is_air": True, "is_sea": False},
        {"id": "sea", "email": "sea@example.test", "display_name": "Sea Recipient", "station": "BLR", "is_air": False, "is_sea": True},
    ]
    stations = [{"code": code, "name": name, "country": country, "is_active": True} for code, name, country in
                [("IND", "India", "India"), ("CMB", "Colombo", "Sri Lanka")]]
    branches = [{"code": code, "name": name, "company_code": "IND", "country": "India", "is_active": True} for code, name in
                [("BLR", "Bengaluru"), ("DEL", "Delhi")]]
    base = {"frequency": "weekly", "day_of_week": 0, "day_of_month": None, "time_of_day": "08:00", "is_active": True}
    schedules = [dict(base, id=key, recipient_email=email, filters=dict(transport_mode="AIR", **filters)) for key, email, filters in [
        ("station-ind", "shared@example.test", {"company_code": "IND", "country": "India"}),
        ("station-cmb", "cmb@example.test", {"company_code": "CMB", "country": "Sri Lanka"}),
        ("branch-blr", "shared@example.test", {"company_code": "IND", "branch": "BLR", "report_level": "branch"}),
        ("legacy-del", "delhi@example.test", {"company_code": "IND", "branch_code": "DEL"}),
        ("global", "shared@example.test", {"company_code": "all"}),
    ]]
    created = []

    def fixture(route):
        request = route.request
        url = urlparse(request.url)
        if request.method == 'OPTIONS':
            intercept(route)
            return
        if url.hostname == "fixture.supabase.co":
            table = url.path.removeprefix("/rest/v1/")
            if table in ["tonnage_users", "stations", "branches"]:
                respond(route, {"tonnage_users": users, "stations": stations, "branches": branches}[table])
                return
            assert table != "users" and "nps" not in table.lower(), table
        if url.path == "/api/schedules":
            if request.method == "POST":
                assert request.headers.get("authorization", "").startswith("Bearer ")
                created.append(request.post_data_json)
                schedule_id = f"created-{len(created)}"
                schedules.append(dict(request.post_data_json, id=schedule_id))
                respond(route, {"status": "success", "id": schedule_id})
            else:
                respond(route, {"status": "success", "data": schedules})
            return
        intercept(route)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1050})
        context.route("**/*", fixture)
        token = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + 86400, "sub": "fixture"}).encode()).decode().rstrip("=")
        session = {"access_token": "eyJhbGciOiJIUzI1NiJ9." + token + ".fixture", "refresh_token": "fixture-refresh",
                   "token_type": "bearer", "expires_in": 86400, "expires_at": int(time.time()) + 86400,
                   "user": {"id": "fixture", "email": "fixture@example.test", "aud": "authenticated"}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        page = context.new_page()
        page.set_default_timeout(10000)
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="networkidle")
        page.get_by_role("button", name="Email Scheduling", exact=True).click()
        listing = page.locator('[data-schedule-list]')
        tabs = listing.get_by_role("tablist", name="Schedule report scopes")
        listing.locator('[data-schedule-id="station-ind"]').wait_for()
        assert listing.locator('[data-schedule-id]').count() == 2
        assert listing.locator('[data-schedule-id="branch-blr"]').count() == 0
        listing.get_by_role("combobox", name="Schedule station", exact=True).select_option("IND")
        assert listing.locator('[data-schedule-id]').count() == 1
        tabs.get_by_role("tab", name=re.compile("^Branches")).click()
        listing.locator('[data-schedule-id="branch-blr"]').wait_for()
        assert listing.locator('[data-schedule-id]').count() == 2
        assert "DEL" in listing.locator('[data-schedule-id="legacy-del"]').inner_text()
        listing.get_by_role("combobox", name="Schedule station", exact=True).select_option("IND")
        listing.get_by_role("combobox", name="Schedule branch", exact=True).select_option("BLR")
        assert listing.locator('[data-schedule-id]').count() == 1
        Path('outputs').mkdir(exist_ok=True)
        listing.screenshot(path='outputs/schedules-branches.png')
        tabs.get_by_role("tab", name=re.compile("^Global")).click()
        assert listing.locator('[data-schedule-id="global"]').count() == 1
        tabs.get_by_role("tab", name="All schedules 5", exact=True).click()
        listing.get_by_role("combobox", name="Schedule recipient", exact=True).select_option("shared@example.test")
        assert listing.locator('[data-schedule-id]').count() == 3
        listing.get_by_role("combobox", name="Schedule recipient", exact=True).select_option("")
        listing.get_by_role("textbox", name="Search schedules", exact=True).fill("Delhi Recipient")
        assert listing.locator('[data-schedule-id="legacy-del"]').count() == 1
        assert listing.locator('[data-schedule-id]').count() == 1
        listing.get_by_role("textbox", name="Search schedules", exact=True).fill("")

        page.get_by_role("button", name="Users", exact=True).click()
        directory = page.locator('[data-recipients-directory]')
        directory.get_by_role("tab", name="Branches", exact=True).click()
        directory.get_by_role("combobox", name="Branch station", exact=True).select_option("IND")
        directory.locator('[data-directory-branch-code="DEL"] [data-recipient-id="delhi"]').get_by_role("button", name="Schedule report", exact=True).click()
        config = page.locator('[data-schedule-config]')
        assert config.get_by_role("button", name="One person", exact=True).get_attribute("aria-pressed") == "true"
        assert config.get_by_role("combobox", name="Recipient", exact=True).input_value() == "delhi@example.test"
        assert config.get_by_role("button", name="Target branches", exact=True).inner_text().strip() == "1 Branch: DEL"
        assert config.get_by_role("button", name=re.compile("Match Target Selection")).count() == 0
        config.get_by_role("button", name="Month Cycle (8th, 15th, 22nd)", exact=True).click()
        config.get_by_role("combobox", name="Schedule month cycle day", exact=True).select_option("15")
        config.get_by_label("Schedule send time", exact=True).fill("09:35")
        config.get_by_label("Schedule start date", exact=True).fill("2026-10-14")
        config.get_by_label("Schedule end date", exact=True).fill("2026-10-01")
        config.get_by_role("button", name="Save Schedule", exact=True).click()
        config.get_by_text("Choose both dates, with the start date on or before the end date.", exact=True).wait_for()
        assert not created
        config.get_by_label("Schedule start date", exact=True).fill("2026-10-01")
        config.get_by_label("Schedule end date", exact=True).fill("2026-10-14")
        config.get_by_role("checkbox", name="Monthly charts", exact=True).uncheck()
        config.get_by_role("checkbox", name="Monthly ledger", exact=True).uncheck()
        with page.expect_response(lambda response: response.request.method == "POST" and "/api/schedules" in response.url):
            config.get_by_role("button", name="Save Schedule", exact=True).click()
        config.get_by_text("Saved 1 branch schedule.").wait_for()
        config.evaluate("element => element.scrollIntoView({block: 'start'})")
        page.screenshot(path='outputs/schedule-one-person.png', full_page=True)
        assert len(created) == 1, created
        branch = created[0]
        assert branch['recipient_email'] == 'delhi@example.test'
        assert branch['day_of_month'] == 15 and branch['day_of_week'] is None and branch['time_of_day'] == '09:35'
        assert branch['filters']['branch'] == 'DEL' and branch['filters']['company_code'] == 'IND'
        assert branch['filters']['recipient_mode'] == 'person' and branch['filters']['use_fixed_dates'] is True
        assert branch['filters']['start_date'] == '2026-10-01' and branch['filters']['end_date'] == '2026-10-14'
        assert branch['filters']['include_monthly_visual'] is False and branch['filters']['include_monthly_ledger'] is False
        config.get_by_role("button", name="View schedules", exact=True).click()
        listing.locator('[data-schedule-id="created-1"]').wait_for()
        assert listing.locator('[data-schedule-id]').count() == 2

        page.get_by_role("button", name="Users", exact=True).click()
        directory.get_by_role("tab", name="Stations", exact=True).click()
        directory.get_by_role("row").filter(has_text="cmb@example.test").get_by_role("button", name="Schedule report", exact=True).click()
        assert config.get_by_role("combobox", name="Recipient", exact=True).input_value() == 'cmb@example.test'
        assert 'CMB' in config.get_by_role("button", name="Target stations", exact=True).inner_text()
        config.get_by_role("button", name="daily", exact=True).click()
        with page.expect_response(lambda response: response.request.method == "POST" and "/api/schedules" in response.url):
            config.get_by_role("button", name="Save Schedule", exact=True).click()
        config.get_by_text("Saved 1 station schedule.").wait_for()
        assert len(created) == 2 and created[1]['recipient_email'] == 'cmb@example.test'
        assert created[1]['frequency'] == 'daily' and created[1]['filters']['company_code'] == 'CMB'
        assert created[1]['filters']['use_fixed_dates'] is False
        assert 'branch' not in created[1]['filters']

        config.get_by_role("button", name="Location groups", exact=True).click()
        config.get_by_role("button", name=re.compile("Match Target Selection")).click()
        with page.expect_response(lambda response: response.request.method == "POST" and "/api/schedules" in response.url):
            config.get_by_role("button", name="Save Schedule", exact=True).click()
        config.get_by_text("Saved 1 station schedule.").wait_for()
        assert len(created) == 3 and created[2]['recipient_email'] == 'cmb@example.test', created
        assert created[2]['filters']['recipient_mode'] == 'groups'
        assert not errors, errors
        context.close()
        browser.close()
        print('PASS: separate station/current and legacy branch/global schedules, recipient filters, per-person branch/station configuration, fixed dates and group scheduling.')


if __name__ == '__main__':
    main()
