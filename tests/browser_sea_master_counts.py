"""Offline browser regression for distinct bills in Sea dashboards/print views.

Serve the isolated static build on localhost:4173. All API calls use fixtures;
no email, authentication or database requests leave this session.
"""
import base64
import json
import re
import time
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright, expect
from browser_freight_modes import BASE, intercept, sea_rows


def check_counts(report):
    assert report.locator('[data-sea-page="departures"]').count() == 0
    assert 'Departure Trend' not in report.inner_text()
    assert 'Individual carrier' not in report.inner_text()
    assert report.locator('[data-sea-sector-metric="teu"] [data-sea-sector-row="line"]').count() == 3
    expect(report.locator('[data-sea-master-count="total"]')).to_have_text('17')
    shipping = report.locator('[data-sea-table="Shipping Line Consol Summary"]')
    expect(shipping.locator('tfoot [data-sea-master-count]')).to_have_text('17')
    msc = shipping.locator('[data-summary-row]').filter(has_text='MSC')
    expect(msc.locator('[data-sea-master-count]')).to_have_text('11')
    assert msc.locator('td').all_text_contents()[-4:] == ['78.5', '0', '11', '$0.00']
    missing = shipping.locator('[data-summary-row]').filter(has_text='Missing bill')
    expect(missing.locator('[data-sea-master-count]')).to_have_text('1')
    formats = shipping.locator('[data-summary-row]').filter(has_text='Format values')
    expect(formats.locator('[data-sea-master-count]')).to_have_text('5')
    routes = report.locator('[data-sea-table="Trade Route Consol Summary"]')
    expect(routes.locator('tfoot [data-sea-master-count]')).to_have_text('17')
    # Shared bill + N/A + five exact format values; actual NULL adds none.
    expect(routes.locator('[data-others-row] [data-sea-master-count]')).to_have_text('7')
    first = routes.locator('[data-summary-row]').first
    expect(first.locator('[data-sea-master-count]')).to_have_text('1')
    # Repeated bill numbers do not remove cargo belonging to distinct consols.
    assert shipping.locator('tfoot td').all_text_contents()[-4:] == ['78.5', '0', '17', '$0.00']


def main():
    original = dict(sea_rows[0])
    sea_rows[:] = [dict(original, Console_Number=f'COUNT-{i}', Shippingline=f'Individual carrier {i}',
        ShippinglineGroup='MSC', Destination_City=f'Destination {i}',
        Master_Bill_of_Lading=' BOL-SHARED ' if i in (0, 10, 11) else f'BOL-{i}',
        FCL_TEU_Count=12-i, LCL_Volume=0, Revenue_USD=0) for i in range(12)]
    sea_rows.extend([
        dict(sea_rows[1], Console_Number='ALIAS-1', Master_Bill_of_Lading=' ',
             Master_Airway_Bill=' bol-1 ', FCL_TEU_Count=0.5),
        dict(original, Console_Number='BLANK-1', ShippinglineGroup='Missing bill',
             Master_Bill_of_Lading=None, Destination_City='Missing', FCL_TEU_Count=0,
             LCL_Volume=0, Revenue_USD=0),
        dict(original, Console_Number='BLANK-2', ShippinglineGroup='Missing bill',
             Master_Bill_of_Lading='N/A', Destination_City='Missing', FCL_TEU_Count=0,
             LCL_Volume=0, Revenue_USD=0),
        dict(sea_rows[0]),  # Joined duplicate of the same consol.
    ])
    sea_rows.extend(dict(original, Console_Number=f'FORMAT-{i}', ShippinglineGroup='Format values',
        Master_Bill_of_Lading=bill, Destination_City='Missing', FCL_TEU_Count=0,
        LCL_Volume=0, Revenue_USD=0) for i, bill in enumerate(['BOL-SHARED', 'bol-shared', '', '-', 'NULL']))
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.route('**/*', intercept)
        token = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + 86400,
                                                  'sub': 'fixture'}).encode()).decode().rstrip('=')
        session = {'access_token': 'eyJhbGciOiJIUzI1NiJ9.' + token + '.fixture',
                   'refresh_token': 'fixture', 'token_type': 'bearer', 'expires_in': 86400,
                   'expires_at': int(time.time()) + 86400,
                   'user': {'id': 'fixture', 'email': 'fixture@example.test', 'aud': 'authenticated'}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        page = context.new_page()
        page.goto(BASE, wait_until='networkidle')
        page.get_by_role('tab', name='Sea Freight').click()
        panel = page.locator('#freight-panel-SEA')
        check_counts(panel.locator('[data-sea-report]'))
        print('PASS: Sea standard dashboard distinct master bills, grouped counts and Others.')
        for period in ('Weekly', 'Monthly'):
            panel.get_by_role('button', name=f'{period} Reports', exact=True).click()
            panel.get_by_role('button', name=re.compile('Execute Custom SQL')).click()
            panel.get_by_text(re.compile('Query executed successfully')).wait_for()
            check_counts(panel.locator('[data-sea-report]'))
            print(f'PASS: Sea {period.lower()} SQL dashboard distinct master bills.')
        for custom in (False, True):
            printed = context.new_page()
            printed.emulate_media(media='print')
            params = {'transport_mode': 'SEA'}
            if custom:
                params['mode'] = 'custom-sql'
                printed.add_init_script("window.__FREIGHT_PRINT_CONFIG__ = {customSql: \"SELECT * WHERE TransportMode = 'SEA'\"};")
            printed.goto(BASE + '/print-view/?' + urlencode(params))
            printed.locator('#pdf-ready').wait_for()
            check_counts(printed.locator('[data-sea-report]'))
            print(f'PASS: Sea {"custom SQL" if custom else "standard"} printable report distinct master bills.')
            printed.close()
        browser.close()


if __name__ == '__main__':
    main()
