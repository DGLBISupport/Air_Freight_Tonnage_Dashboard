"""Exercise user removal against fixtures; forbid shared/NPS table requests."""
import base64
import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, respond


def main():
    users = [{"id": "00000000-0000-4000-8000-000000000001", "email": "shared@example.test",
              "display_name": "Sample Recipient", "station": "IND, BLR", "is_air": True,
              "is_sea": True, "created_at": "2026-10-15T00:00:00Z"}]
    users.extend([
        {"id": "branch-only", "email": "del@example.test", "display_name": "Delhi Recipient", "station": "DEL", "is_air": True, "is_sea": False},
        {"id": "colombo", "email": "cmb@example.test", "display_name": "Colombo Recipient", "station": "CMB", "is_air": True, "is_sea": False},
    ])
    stations = [
        {"code": "CMB", "name": "Colombo", "country": "Sri Lanka", "is_active": True},
        {"code": "IND", "name": "India", "country": "India", "is_active": True},
        {"code": "DXB", "name": "Dubai", "country": "United Arab Emirates", "is_active": True},
    ]
    # Reproduce the reported database problem: branch codes also in stations.
    stations.extend({"code": code, "name": name, "country": "India", "is_active": True} for code, name in [
        ("AMD", "Ahmedabad"), ("BLR", "Bengaluru"), ("BOM", "Mumbai"), ("COK", "Kochi"), ("DEL", "Delhi"),
    ])
    branches = [
        {"code": "AMD", "name": "Ahmedabad", "company_code": "IND", "country": "India", "is_active": True},
        {"code": "BLR", "name": "Bengaluru", "city": "Bengaluru", "company_code": "IND", "country": "India", "is_active": True},
        {"code": "DEL", "name": "Delhi", "city": "Delhi", "company_code": "IND", "country": "India", "is_active": True},
        {"code": "CMBT", "name": "Colombo Airport", "city": "Colombo", "company_code": "CMB", "country": "Sri Lanka", "is_active": True},
        {"code": "JFK", "name": "New York", "city": "New York", "company_code": "NYC", "country": "United States", "is_active": True},
    ]
    forbidden = []
    deletions = []
    writes = []
    sent_reports = []

    def fixture(route):
        request = route.request
        url = urlparse(request.url)
        table = url.path.removeprefix("/rest/v1/")
        if url.hostname == "fixture.supabase.co" and url.path.startswith("/rest/v1/"):
            if table == "users" or "nps" in table.lower():
                forbidden.append((request.method, table))
                route.abort()
                return
            if table == "tonnage_users":
                params = parse_qs(url.query)
                if request.method == "DELETE":
                    deletions.append(params)
                    users[:] = [user for user in users if "eq." + user["id"] not in params.get("id", [])]
                elif request.method == "POST":
                    writes.append(("POST", request.post_data_json))
                    users.append(dict(request.post_data_json, created_at="2026-10-15T00:00:00Z"))
                elif request.method == "PATCH":
                    writes.append(("PATCH", request.post_data_json))
                    for user in users:
                        if "eq." + user["id"] in params.get("id", []):
                            user.update(request.post_data_json)
                respond(route, users if request.method == "GET" else [])
                return
            if table in ("stations", "branches"):
                respond(route, stations if table == "stations" else branches)
                return
            if table == "station_recipients":
                # Stale legacy memberships must not overwrite exact user assignments.
                respond(route, [{"station_code": "IND", "email": email} for email in
                                ("del@example.test", "new@example.test")])
                return
        if url.path == "/api/send-report" and request.method == "POST":
            sent_reports.append(request.post_data_json)
            respond(route, {"status": "success", "message": "Fixture captured; no email sent."})
            return
        intercept(route)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 1050})
        context.route("**/*", fixture)
        token = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()) + 86400, "sub": "fixture"}).encode()).decode().rstrip("=")
        session = {"access_token": "eyJhbGciOiJIUzI1NiJ9." + token + ".fixture",
                   "refresh_token": "fixture-refresh", "token_type": "bearer", "expires_in": 86400,
                   "expires_at": int(time.time()) + 86400,
                   "user": {"id": "fixture", "email": "fixture@example.test", "aud": "authenticated"}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("dialog", lambda dialog: dialog.accept())
        page.goto(BASE, wait_until="networkidle")
        page.locator("#freight-panel-AIR").get_by_role("tab", name="Air Freight").wait_for()
        page.get_by_role("button", name="Users", exact=True).click()
        row = page.get_by_role("row").filter(has_text="shared@example.test")
        row.wait_for()
        assert not deletions, "Loading recipients must not delete records"
        directory = page.locator("[data-recipients-directory]")
        sections = directory.get_by_role("tablist", name="Recipient directory sections")
        assert sections.get_by_role("tab").count() == 2
        assert sections.get_by_role("tab", name="Stations", exact=True).get_attribute("aria-selected") == "true"
        station_tabs = directory.get_by_role("navigation", name="Recipient stations")
        station_tabs.get_by_role("button", name="Dubai (DXB)", exact=True).wait_for()
        assert station_tabs.get_by_role("button").count() == 4, "Show database stations plus All Stations, without fallback stations"
        for code in ["AMD", "BLR", "BOM", "COK", "DEL"]:
            assert not any(f"({code})" in label for label in station_tabs.get_by_role("button").all_text_contents()), code
        assert directory.get_by_role("combobox", name="Branch station").count() == 0
        assert row.get_by_text("BLR", exact=True).count() == 0, "Station assignments must not mix branch codes into Stations"
        Path("outputs").mkdir(exist_ok=True)
        directory.screenshot(path="outputs/recipients-directory-table.png")
        station_tabs.get_by_role("button", name="Colombo (CMB)", exact=True).click()
        directory.get_by_role("row").filter(has_text="cmb@example.test").wait_for()
        assert row.count() == 0
        assert directory.get_by_role("combobox", name="Filter by branch").count() == 0
        directory.get_by_role("button", name="Add Recipient", exact=True).click()
        dialog = page.get_by_role("dialog", name="Add New Recipient", exact=True)
        assert dialog.locator("select").input_value() == "CMB", "New recipients inherit the selected station"
        assert dialog.locator('optgroup[label="City Branches"] option').count() == 1
        assert "CMBT" in dialog.locator('optgroup[label="City Branches"]').inner_text()
        assert "BLR" not in dialog.locator('optgroup[label="City Branches"]').inner_text()
        dialog.get_by_role("button", name="Cancel", exact=True).click()
        station_tabs.get_by_role("button", name="Dubai (DXB)", exact=True).click()
        directory.get_by_text("No recipients matching your active filter criteria.", exact=True).wait_for()
        assert directory.get_by_role("button", name="Branch Directory").count() == 0
        station_tabs.get_by_role("button", name="All Stations", exact=True).click()
        row.wait_for()
        sea = row.locator('button[title$="Sea Freight reports"]')
        with page.expect_response(lambda response: response.request.method == "PATCH" and "/tonnage_users?" in response.url):
            sea.click()
        assert sea.get_attribute("aria-pressed") == "false"
        row.get_by_role("button", name="Edit Recipient", exact=True).click()
        dialog = page.get_by_role("dialog", name="Edit Recipient", exact=True)
        assert dialog.locator("select").input_value() == "IND, BLR", "Existing multiple assignments must remain selected"
        dialog.locator('input[type="text"]').fill("Updated Recipient")
        dialog.screenshot(path="outputs/recipients-directory-form.png")
        dialog.get_by_role("button", name="Save Changes", exact=True).click()
        dialog.wait_for(state="hidden")
        row.get_by_text("Updated Recipient", exact=True).wait_for()
        station_tabs.get_by_role("button", name="India (IND)", exact=True).click()
        assert directory.get_by_role("row").filter(has_text="del@example.test").count() == 0
        assert directory.get_by_role("combobox", name="Branch station").count() == 0
        assert row.get_by_text("IND", exact=True).count() == 1
        assert row.get_by_text("BLR", exact=True).count() == 0
        sections.get_by_role("tab", name="Branches", exact=True).click()
        parent_station = directory.get_by_role("combobox", name="Branch station")
        parent_station.wait_for()
        assert parent_station.locator("option").count() == 3
        assert directory.get_by_role("navigation", name="Recipient stations").count() == 0
        assert directory.get_by_role("table").count() == 0
        parent_station.select_option("IND")
        directory.get_by_role("heading", name="Bengaluru", exact=True).wait_for()
        directory.get_by_role("heading", name="Delhi", exact=True).wait_for()
        for name in ["Ahmedabad", "Mumbai", "Kochi"]:
            directory.get_by_role("heading", name=name, exact=True).wait_for()
        assert directory.get_by_text("JFK", exact=True).count() == 0
        assert directory.get_by_text("CMBT", exact=True).count() == 0
        directory.get_by_text("Updated Recipient", exact=True).wait_for()
        directory.screenshot(path="outputs/recipients-directory-branches.png")
        parent_station.select_option("CMB")
        directory.get_by_role("heading", name="Colombo Airport", exact=True).wait_for()
        assert directory.get_by_text("BLR", exact=True).count() == 0
        assert directory.get_by_text("DEL", exact=True).count() == 0
        directory.screenshot(path="outputs/recipients-directory-colombo-branches.png")
        parent_station.select_option("DXB")
        directory.get_by_text("No active branches are configured for this station.", exact=True).wait_for()
        sections.get_by_role("tab", name="Stations", exact=True).click()
        station_tabs.get_by_role("button", name="All Stations", exact=True).wait_for()
        assert directory.get_by_role("combobox", name="Branch station").count() == 0
        assert directory.get_by_text("CMBT", exact=True).count() == 0
        station_tabs.get_by_role("button", name="India (IND)", exact=True).click()
        row.wait_for()
        directory.get_by_role("button", name="Add Recipient", exact=True).click()
        dialog = page.get_by_role("dialog", name="Add New Recipient", exact=True)
        dialog.locator('input[type="email"]').fill("new@example.test")
        dialog.locator('input[type="text"]').fill("New Recipient")
        dialog.locator("select").select_option("BLR")
        dialog.get_by_role("button", name="Add Recipient", exact=True).click()
        dialog.wait_for(state="hidden")
        assert directory.get_by_role("row").filter(has_text="new@example.test").count() == 0
        assert next(user for user in users if user["email"] == "new@example.test")["station"] == "BLR"

        page.get_by_role("button", name="Admin Panel", exact=True).click()
        station_card = page.locator('[data-station-recipient-code="IND"]')
        station_card.wait_for()
        station_card.get_by_text("shared@example.test", exact=True).wait_for()
        assert "del@example.test" not in station_card.inner_text()
        assert "new@example.test" not in station_card.inner_text()
        with page.expect_response(lambda response: response.request.method == "POST" and "/api/send-report" in response.url):
            station_card.get_by_role("button", name="Send IND Report", exact=True).click()
        assert sent_reports[-1]["recipient_email"] == "shared@example.test", sent_reports
        assert sent_reports[-1]["company_code"] == "IND"
        assert not sent_reports[-1].get("branch")
        page.get_by_role("button", name=re.compile(r"^Branch-wise Mailers")).click()
        branch_card = page.locator('[data-branch-recipient-code="BLR"]')
        branch_card.get_by_text("new@example.test", exact=True).wait_for()
        with page.expect_response(lambda response: response.request.method == "POST" and "/api/send-report" in response.url):
            branch_card.get_by_role("button", name="Send BLR Report", exact=True).click()
        assert set(sent_reports[-1]["recipient_email"].split(", ")) == {"shared@example.test", "new@example.test"}, sent_reports
        assert sent_reports[-1]["branch"] == "BLR"
        assert sent_reports[-1]["report_level"] == "branch"

        page.get_by_role("button", name="Users", exact=True).click()
        sections.get_by_role("tab", name="Branches", exact=True).click()
        parent_station.select_option("IND")
        new_row = directory.locator('[data-directory-branch-code="BLR"] [data-recipient-id]').filter(has_text="new@example.test")
        new_row.wait_for()
        new_row.get_by_role("button", name="Delete", exact=True).click()
        new_row.wait_for(state="detached")
        sections.get_by_role("tab", name="Stations", exact=True).click()
        station_tabs.get_by_role("button", name="India (IND)", exact=True).click()
        row.wait_for()
        row.get_by_role("button", name="Delete Recipient", exact=True).click()
        row.wait_for(state="detached")
        assert len(deletions) == 2 and deletions[-1] == {"id": ["eq.00000000-0000-4000-8000-000000000001"]}, deletions
        assert any(method == "POST" and payload["email"] == "new@example.test" for method, payload in writes), writes
        assert any(method == "PATCH" and payload.get("display_name") == "Updated Recipient" for method, payload in writes), writes
        assert any(method == "PATCH" and payload.get("is_sea") is False for method, payload in writes), writes
        assert not forbidden, forbidden
        assert not errors, errors
        stations.clear()
        directory.get_by_role("button", name="Refresh list", exact=True).click()
        directory.get_by_text("No active stations are configured.", exact=True).wait_for()
        assert station_tabs.get_by_role("button").count() == 1, "An empty database must not show hardcoded stations"
        assert directory.get_by_role("combobox", name="Filter by branch").count() == 0
        print("PASS: exact station/branch assignments, separate IND/BLR send payloads, stale legacy isolation, directory tabs and recipient CRUD.")
        context.close()
        browser.close()


if __name__ == "__main__":
    main()
