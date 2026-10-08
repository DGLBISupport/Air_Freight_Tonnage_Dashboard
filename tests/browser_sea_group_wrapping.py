"""Check complete, non-overlapping group labels with fixture APIs only."""
import base64
import json
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, respond, sea_rows


def check_labels(page):
    report = page.locator('[data-sea-report]:visible')
    report.locator('[data-sea-group-tick]').first.wait_for()
    legend = report.locator('[data-sea-group-label]')
    details = legend.evaluate_all("""els => els.map(el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      const value = el.parentElement.nextElementSibling.getBoundingClientRect();
      return {name: el.textContent, title: el.title, overflow: s.textOverflow,
        whitespace: s.whiteSpace, width: el.clientWidth, contentWidth: el.scrollWidth,
        height: r.height, lineHeight: parseFloat(s.lineHeight), right: r.right, valueLeft: value.left};
    })""")
    assert details and all(d['name'] == d['title'] and '…' not in d['name'] for d in details)
    assert all(d['overflow'] != 'ellipsis' and d['whitespace'] == 'normal' for d in details)
    assert all(d['contentWidth'] <= d['width'] + 1 and d['right'] <= d['valueLeft'] for d in details), details
    assert any(d['height'] > d['lineHeight'] * 1.5 for d in details), 'Expected wrapped long names'
    for title in ('Shipping Line FCL TEUs', 'Shipping Line LCL Volume'):
        chart = report.locator(f'[data-sea-chart="{title}"]')
        ticks = chart.locator('[data-sea-group-tick]').evaluate_all("""els => els.map(el => {
          const text = el.querySelector('text'), r = text.getBoundingClientRect();
          const svg = el.closest('svg').getBoundingClientRect();
          return {name: el.dataset.seaGroupTick, visible: [...text.querySelectorAll('tspan')].map(s => s.textContent).join(''),
            top: r.top, bottom: r.bottom, left: r.left, right: r.right,
            svgTop: svg.top, svgBottom: svg.bottom, svgLeft: svg.left, svgRight: svg.right};
        })""")
        assert len(ticks) == 10, (title, len(ticks))
        assert all(''.join(t['name'].split()) == ''.join(t['visible'].split()) for t in ticks), ticks
        assert all(t['left'] >= t['svgLeft'] - 1 and t['right'] <= t['svgRight'] + 1 and
                   t['top'] >= t['svgTop'] - 1 and t['bottom'] <= t['svgBottom'] + 1 for t in ticks), ticks
        ordered = sorted(ticks, key=lambda tick: tick['top'])
        assert all(a['bottom'] < b['top'] for a, b in zip(ordered, ordered[1:])), ticks


def main():
    original = dict(sea_rows[0])
    sea_rows[:] = [dict(original, Console_Number=f'WRAP-{i}',
        ShippinglineGroup=(f'MEDITERRANEAN SHIPPING COMPANY INTERNATIONAL GROUP {i:02}' if i else 'W' * 48),
        FCL_TEU_Count=12-i, LCL_Volume=12-i) for i in range(12)]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        def fixture(route):
            url = urlparse(route.request.url)
            if url.path == '/api/airlines' and parse_qs(url.query).get('transport_mode') == ['SEA']:
                respond(route, {'status': 'success', 'data': [row['ShippinglineGroup'] for row in sea_rows]})
            else:
                intercept(route)
        context.route('**/*', fixture)
        token = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + 86400, 'sub': 'fixture'}).encode()).decode().rstrip('=')
        session = {'access_token': 'eyJhbGciOiJIUzI1NiJ9.' + token + '.fixture', 'refresh_token': 'fixture',
            'token_type': 'bearer', 'expires_in': 86400, 'expires_at': int(time.time()) + 86400,
            'user': {'id': 'fixture', 'email': 'fixture@example.test', 'aud': 'authenticated'}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        Path('outputs').mkdir(exist_ok=True)
        for printed in (False, True):
            page = context.new_page()
            if printed:
                page.emulate_media(media='print')
                page.goto(BASE + '/print-view/?transport_mode=SEA')
                page.locator('#pdf-ready').wait_for()
            else:
                page.goto(BASE, wait_until='networkidle')
                page.get_by_role('tab', name='Sea Freight').click()
                dropdown = page.locator('#freight-panel-SEA .multiselect-ShippingLineGroup')
                dropdown.get_by_role('button').first.click()
                option = dropdown.get_by_text(sea_rows[0]['ShippinglineGroup'], exact=True)
                option.wait_for()
                assert option.evaluate("el => getComputedStyle(el).whiteSpace === 'normal' && el.scrollWidth <= el.clientWidth + 1")
                dropdown.get_by_role('button').first.click()
            check_labels(page)
            if not printed:
                for chart in ('Shipping Line TEU Share', 'Shipping Line FCL TEUs'):
                    target = page.locator(f'[data-sea-chart="{chart}"]')
                    target.evaluate('el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 100)')
                    target.screenshot(path=f'outputs/sea-wrap-{chart.replace(" ", "-").lower()}.png')
            print(f'PASS: {"Printable report" if printed else "Dashboard"}: complete wrapped names, no ellipses, clipping or overlapping chart labels.')
            page.close()
        browser.close()


if __name__ == '__main__':
    main()
