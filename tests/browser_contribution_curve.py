"""Check contribution point/bar alignment in Air and Sea dashboards and PDFs.

Uses fixture APIs only, including the reported Sea profile and small Air cargo.
Serve the isolated static frontend build on localhost:4173 before running.
"""
import base64
import json
import time
from pathlib import Path
from urllib.parse import urlencode, urlparse

from playwright.sync_api import sync_playwright
from browser_freight_modes import BASE, intercept, respond, sea_rows


GEOMETRY = """el => {
  const bars = [...el.querySelectorAll('.recharts-bar-rectangle')];
  const dots = [...el.querySelectorAll('.recharts-line-dots circle')];
  const points = dots.map(dot => ({x: Number(dot.getAttribute('cx')), y: Number(dot.getAttribute('cy'))}));
  const differences = bars.map((bar, i) => {
    const box = bar.getBBox();
    return box.height > 0 ? {index: i, x: Math.abs(points[i].x - box.x - box.width / 2),
      y: Math.abs(points[i].y - box.y)} : null;
  }).filter(Boolean);
  const curve = el.querySelector('.recharts-line-curve');
  const length = curve.getTotalLength();
  const samples = Array.from({length: 1001}, (_, i) => curve.getPointAtLength(length * i / 1000).y);
  return {bars: bars.length, dots: dots.length, differences,
    finite: points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)),
    minPoint: Math.min(...points.map(point => point.y)), maxPoint: Math.max(...points.map(point => point.y)),
    minCurve: Math.min(...samples), maxCurve: Math.max(...samples)};
}"""


def check_chart(chart):
    chart.locator('.recharts-line-dots circle').last.wait_for()
    geometry = chart.evaluate(GEOMETRY)
    assert geometry['bars'] == geometry['dots'] == 8, geometry
    assert geometry['finite'], geometry
    assert all(point['x'] < 1 and point['y'] < 1 for point in geometry['differences']), geometry
    assert geometry['minCurve'] >= geometry['minPoint'] - 0.5, geometry
    assert geometry['maxCurve'] <= geometry['maxPoint'] + 0.5, geometry
    return geometry


def main():
    Path('outputs').mkdir(exist_ok=True)
    original = dict(sea_rows[0])
    sea_rows[:] = [dict(original, Console_Number=f'ALIGN-{i}', Destination_Sector=sector,
        FCL_TEU_Count=teu, LCL_Volume=volume) for i, (sector, teu, volume) in enumerate([
            ('Europe Other', 2, 0), ('USA', 11.2, 4.6), ('South East Asia', 1, 0), ('Other', 1, 0)])]
    sector_columns = ['Europe', 'USA', 'North_America_Other', 'Central_America', 'South_America',
        'Middle_East', 'South_East_Asia', 'India_Sub_Continent', 'Northern_Asia', 'Africa', 'South_Africa',
        'Australia', 'Pacific_Islands', 'Others']
    air_sector = []

    def fixture(route):
        if urlparse(route.request.url).path == '/api/sector-carrier-distribution':
            respond(route, {'status': 'success', 'data': air_sector})
        else:
            intercept(route)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel='chrome', headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.route('**/*', fixture)
        token = base64.urlsafe_b64encode(json.dumps({'exp': int(time.time()) + 86400, 'sub': 'fixture'}).encode()).decode().rstrip('=')
        session = {'access_token': 'eyJhbGciOiJIUzI1NiJ9.' + token + '.fixture', 'refresh_token': 'fixture',
            'token_type': 'bearer', 'expires_in': 86400, 'expires_at': int(time.time()) + 86400,
            'user': {'id': 'fixture', 'email': 'fixture@example.test', 'aud': 'authenticated'}}
        context.add_init_script(f"localStorage.setItem('sb-fixture-auth-token', {json.dumps(json.dumps(session))});")
        for profile, quantities, modes in [('mixed', (2000, 11200, 1000, 1000), ('SEA', 'AIR')),
                                          ('small-air', (4, 14, 1, 1), ('AIR',))]:
            air_sector[:] = [dict.fromkeys(sector_columns, 0) | {'Airline': 'Fixture carrier',
                'Europe': quantities[0], 'USA': quantities[1], 'South_East_Asia': quantities[2], 'Others': quantities[3],
                'Total_Tons': sum(quantities), 'Air_Exp_Tong': sum(quantities), 'Air_Imp_Tong': 0}]
            for mode in modes:
                selector = '[data-geographical-chart="air"]' if mode == 'AIR' else '[data-sea-geographical-metric]'
                for printed in (False, True):
                    page = context.new_page()
                    if printed:
                        page.emulate_media(media='print')
                        page.goto(BASE + '/print-view/?' + urlencode({'transport_mode': mode,
                            'include_weekly_visual': 'false', 'include_weekly_ledger': 'false',
                            'include_monthly_visual': 'false', 'include_monthly_ledger': 'false'}))
                        page.locator('#pdf-ready').wait_for()
                    else:
                        page.goto(BASE, wait_until='networkidle')
                        if mode == 'SEA':
                            page.get_by_role('tab', name='Sea Freight').click()
                    charts = page.locator(selector)
                    charts.first.wait_for()
                    for i in range(charts.count()):
                        chart = charts.nth(i)
                        check_chart(chart)
                        if not printed:
                            chart.evaluate('el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 100)')
                            chart.screenshot(path=f'outputs/contribution-{mode.lower()}-{profile}-{i}.png')
                    if printed:
                        page.pdf(path=f'outputs/contribution-{mode.lower()}-{profile}.pdf', format='A4',
                            landscape=True, print_background=True)
                    page.close()
                    print(f'PASS: {mode} {profile} {"PDF" if printed else "dashboard"}: points align with bars; zero sectors and curve bounds correct.')
        browser.close()


if __name__ == '__main__':
    main()
