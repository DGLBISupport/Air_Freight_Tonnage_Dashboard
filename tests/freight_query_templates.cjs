const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const exportsObject = {};
const source = ts.transpileModule(fs.readFileSync('frontend/lib/freight.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInNewContext(source, { exports: exportsObject });
const sql = `SELECT
    vt.MasterBillNum AS Master_Airway_Bill,
    vt.AirlineName1 AS Airline,
    vs.Branch AS Branch_Code,
    vs.BranchName AS Branch_Name,
    vs.Consignor AS Consigner,
    vs.ConsignorName AS Consigner_Name,
    vs.Consignee AS Consignee,
    vs.AgentName AS Agent_Name,
    ROUND(MAX(vt.Air_ChargebleWeight), 2) AS Tonnage_Chargeable,
    ROUND(MAX(vt.Air_ActualWeight), 2) AS Tonnage_Actual
FROM vt JOIN vs ON vt.ConsoleNumber = vs.ConsoleNumber
WHERE vt.TransportMode = 'AIR' AND vt.ETD <= '2026-09-27' AND vs.Branch = 'BLR'
GROUP BY vt.ConsoleNumber, vt.MasterBillNum, vt.AirlineName1,
    vs.Branch,
    vs.BranchName,
    vs.Consignor,
    vs.ConsignorName,
    vs.Consignee,
    vs.AgentName
ORDER BY vt.ETD DESC, vs.Branch, ROUND(SUM(vs.Revenue_USD), 2) DESC;`;
assert.equal(exportsObject.buildFreightQuery(sql, 'AIR'), sql);
const sea = exportsObject.buildFreightQuery(sql, 'SEA');
assert(sea.includes("TransportMode = 'SEA'"));
assert(sea.includes("vt.ETD <= '2026-09-27'"));
assert(!sea.includes('DATEADD'));
assert(!sea.includes('vt.ShippinLine'));
assert(sea.includes('vt.ShippingLineGroup AS ShippinglineGroup'));
assert(exportsObject.buildFreightQuery(sql.replace("vs.Branch = 'BLR'", "vt.AirlineName1 = 'MSC'"), 'SEA').includes("vt.ShippingLineGroup = 'MSC'"));
assert.equal(exportsObject.freightText('Airline Carrier', 'SEA'), 'Shipping Line Group');
assert(sea.includes('MAX(vt.FCLTEU)'));
assert(sea.includes('MAX(vt.LCLVolume)'));
assert(!sea.includes('AS Branch_Code'));
assert(sea.includes('ORDER BY vt.ETD DESC,'));
assert(sea.includes('AS FCL_TEU_Count') && sea.includes('AS LCL_Volume'));
assert(!sea.includes('Total_Shipments') && !sea.includes('Cost_USD') && !sea.includes('Profit_USD'));
assert(!sea.includes('AirlineName1') && !sea.includes('Air_ChargebleWeight'));
assert(!sea.includes('vs.Consignor') && !sea.includes('vs.Consignee') && !sea.includes('vs.AgentName'));
assert(!sea.match(/GROUP BY[\s\S]*vs\.Branch/));
// Check the actual dashboard templates, including their trailing financial columns.
const page = fs.readFileSync('frontend/app/page.tsx', 'utf8');
for (const kind of ['Station', 'Branch']) {
  const match = page.match(new RegExp('const get' + kind + 'wiseSqlTemplate =[\\s\\S]*?buildFreightQuery\\(`([\\s\\S]*?)`, transportMode\\)'));
  assert(match, 'Missing actual ' + kind + ' template');
  const run = new Function('buildFreightQuery', 'transportMode', 'country', 'companyCode', 'branch', 'sDate', 'eDate',
    'return buildFreightQuery(`' + match[1] + '`, transportMode);');
  const generated = run(exportsObject.buildFreightQuery, 'SEA', 'India', 'IND', 'BLR', '2026-09-21', '2026-09-27');
  assert(generated.includes('AS FCL_TEU_Count') && generated.includes('AS LCL_Volume'));
  assert(!/Total_Shipments|Cost_USD|Profit_USD|GP_Margin|AS Consigner|AS Agent/.test(generated));
  assert(!/,\s*FROM/.test(generated));
  assert(!/GROUP BY[\s\S]*vs\.(Branch|Consignor|Consignee|Agent)/.test(generated));
}
console.log('PASS: Air query preserved; sea branch query keeps TEUs/volume at consol grain.');
