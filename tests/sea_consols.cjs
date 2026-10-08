const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
function moduleFrom(path, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020}
  }).outputText;
  vm.runInNewContext(source, {exports, require: name => dependencies[name], Intl, Date});
  return exports;
}
const dates = moduleFrom('frontend/lib/operational-date.ts');
const sea = moduleFrom('frontend/lib/sea-consols.ts', {'./operational-date': dates});
const rows = sea.seaConsols([
  {Console_Number: 'C1', Master_Airway_Bill: 'B1', Shippingline: 'MSC', shippinglineGroup: 'MSC',
    FCL_TEU_Count: 2.5, LCL_Volume: 10.25, Revenue_USD: 100, Company_Code: 'IND', ETD: '2026-09-30T19:00:00Z',
    Origin_Country: 'India', Origin_City: 'Mumbai', Destination_Country: 'Singapore', Destination_City: 'Singapore'},
  {Console_Number: 'C1', FCL_TEU_Count: 2.5, LCL_Volume: 10.25, Revenue_USD: 200, Total_Shipments: 4},
  {Console_Number: 'C2', Shippingline: 'MSC', TEUCount: 1, Volume_M3: 5.5, Revenue_USD: 20}
]);
assert.equal(rows.length, 2);
assert.equal(rows[0].master, 'B1');
assert.equal(rows[0].group, 'MSC');
assert.equal(rows[0].day, '2026-10-01');
assert.equal(rows[0].originCountry, 'India');
assert.equal(rows[0].originCity, 'Mumbai');
assert.equal(rows[0].destinationCountry, 'Singapore');
assert.equal(rows[0].origin, 'Mumbai, India');
const total = sea.seaTotals(rows);
assert.equal(total.consols, 2);
assert.equal(total.masters, 1);
assert.equal(total.teu, 3.5);
assert.equal(total.volume, 15.75);
assert.equal(total.revenue, 320);
assert.equal(sea.seaSummary(rows, row => row.line)[0].consols, 2);
assert(!('Total_Shipments' in rows[0]));
console.log('PASS: Sea consol totals, query aliases, duplicate customer rows and station dates.');
const masterRows = sea.seaConsols([
  {Console_Number: 'M1', Master_Bill_of_Lading: ' BOL-1 ', Shippingline: 'MSC', Destination_City: 'Singapore', FCL_TEU_Count: 2},
  {Console_Number: 'M1', Master_Bill_of_Lading: 'BOL-1', Shippingline: 'MSC', FCL_TEU_Count: 2},
  {Console_Number: 'M2', Master_Airway_Bill: 'bol-1', Shippingline: 'MSC', Destination_City: 'Singapore', FCL_TEU_Count: 3},
  {Console_Number: 'M3', MasterBillNum: 'BOL-1', Shippingline: 'Other line', Destination_City: 'Dubai', FCL_TEU_Count: 4},
  {Console_Number: 'M4', MasterBillNum: 'BOL-2', Shippingline: 'MSC', Destination_City: 'Dubai', FCL_TEU_Count: 1},
  ...[null, '', ' ', 'N/A', '—', 'Unknown'].map((master, i) => ({Console_Number: `BLANK-${i}`, Master_Bill_of_Lading: master})),
  {Console_Number: 'LATE', Master_Bill_of_Lading: ''},
  {Console_Number: 'LATE', Master_Bill_of_Lading: ' ', Master_Airway_Bill: 'BOL-2'},
]);
assert.equal(sea.seaTotals(masterRows).masters, 9);
assert.equal(sea.seaTotals(masterRows).teu, 10); // Cargo remains counted per consol.
assert.equal(sea.seaTotals([]).masters, 0);
assert.equal(sea.seaSummary(masterRows, row => row.line).find(row => row.name === 'MSC').masters, 3);
assert.equal(sea.seaSummary(masterRows, row => row.destinationCity).find(row => row.name === 'Singapore').masters, 2);
assert.equal(masterRows.find(row => row.console === 'LATE').master, '');
assert.equal(masterRows.find(row => row.console === 'M1').master, ' BOL-1 ');
assert.equal(sea.seaMasterKey(' BOL/123-A '), ' BOL/123-A ');
assert.equal(sea.seaMasterKey(null), null);
assert.equal(sea.seaMasterKey(''), '');
const exactBills = ['', ' ', 'N/A', 'NA', 'NULL', 'NONE', 'UNKNOWN', 'UNLINKED', '-', '--', '—', 'bol-1', 'BOL-1', ' BOL-1 ', 0];
const exactRows = sea.seaConsols([...exactBills, ...exactBills, null].map((master, i) => ({Console_Number: `EXACT-${i}`, Master_Bill_of_Lading: master})));
assert.equal(sea.seaTotals(exactRows).masters, 15);
assert.equal(sea.seaSummary(exactRows, row => row.line)[0].masters, 15);
console.log('PASS: Only NULL master bills excluded; exact duplicates counted once; all other values preserved.');
const sectors = moduleFrom('frontend/lib/sea-sectors.ts');
const sectorRecords = Array.from({length: 21}, (_, index) => ({Console_Number: `C${index + 1}`,
  Shippingline: `Line ${index + 1}`, FCL_TEU_Count: index + 1, LCL_Volume: (index + 1) / 4,
  Destination_Sector: index % 2 === 0 ? 'USA' : 'Unmapped sector'}));
sectorRecords.push({...sectorRecords[20]});
const summary = sectors.seaSectorSummary(sea.seaConsols(sectorRecords));
assert.equal(summary.lineCount, 21);
assert.equal(summary.rows.length, 21);
assert.equal(summary.rows[0].name, 'Line 21');
assert.equal(summary.rows[20].others, true);
assert.equal(summary.rows[20].teu, 1);
assert.equal(summary.rows[20].volume, 0.25);
assert.equal(summary.total.teu, 231);
assert.equal(summary.total.volume, 57.75);
assert.equal(summary.total.sectors[1].teu, 121);
assert.equal(summary.total.sectors[13].teu, 110);
assert.equal(summary.total.sectors.reduce((sum, sector) => sum + sector.teu, 0), summary.total.teu);
assert.equal(summary.total.sectors.reduce((sum, sector) => sum + sector.volume, 0), summary.total.volume);
assert.equal(summary.rows.reduce((sum, row) => sum + row.teu, 0), summary.total.teu);
assert.equal(summary.rows.reduce((sum, row) => sum + row.volume, 0), summary.total.volume);
const volumeOnly = sectors.seaSectorSummary(sea.seaConsols([{Console_Number: 'LCL-1', Shippingline: 'LCL Line',
  FCL_TEU_Count: 0, LCL_Volume: 9.75, Destination_Sector: 'Australia'}]));
assert.equal(volumeOnly.rows.length, 1);
assert.equal(volumeOnly.total.sectors[11].volume, 9.75);
assert.equal(volumeOnly.total.teu, 0);
assert.equal(sectors.formatSeaSectorQuantity(0), "-");
assert.equal(sectors.formatSeaSectorQuantity(0.0), "-");
assert.equal(sectors.formatSeaSectorQuantity(null), "-");
assert.equal(sectors.formatSeaSectorQuantity(undefined), "-");
assert.equal(sectors.formatSeaSectorQuantity(0.00001), "-");
assert.equal(sectors.formatSeaSectorQuantity(2.5), "2.50");
assert.equal(sectors.formatSeaSectorQuantity(15.75), "15.75");
assert.equal(sectors.formatSeaSectorQuantity(1000), "1,000.00");
console.log('PASS: Top 20 sector totals, Others, unknown destinations, duplicate consols, zero-formatting and LCL-only cargo.');
const geoConsols = sea.seaConsols([
  {Console_Number: 'G1', FCL_TEU_Count: 3, LCL_Volume: 10, Destination_Sector: 'Europe Other'},
  {Console_Number: 'G1', FCL_TEU_Count: 3, LCL_Volume: 10, Destination_Sector: 'Europe Other'},
  {Console_Number: 'G2', FCL_TEU_Count: 1, LCL_Volume: 30, Destination_Sector: 'USA'},
  {Console_Number: 'G3', FCL_TEU_Count: 4, LCL_Volume: 40, Destination_Sector: 'North America Other'},
  {Console_Number: 'G4', FCL_TEU_Count: 2, LCL_Volume: 20, Destination_Sector: 'Unmapped'},
]);
const geo = sectors.seaGeographicalContribution(geoConsols);
assert.equal(geo.reduce((sum, region) => sum + region.teu, 0), 10);
assert.equal(geo.reduce((sum, region) => sum + region.volume, 0), 100);
assert.equal(geo.find(region => region.name === 'Europe').teuContribution, 30);
assert.equal(geo.find(region => region.name === 'Europe').volumeContribution, 10);
assert.equal(geo.find(region => region.name === 'Other Sectors').teuContribution, 60);
assert.equal(geo.find(region => region.name === 'Other Sectors').volumeContribution, 60);
assert.equal(geo.reduce((sum, region) => sum + region.teuContribution, 0), 100);
assert.equal(geo.reduce((sum, region) => sum + region.volumeContribution, 0), 100);
assert(sectors.seaGeographicalContribution([]).every(region => region.teuContribution === 0 && region.volumeContribution === 0));
const lclGeo = sectors.seaGeographicalContribution(sea.seaConsols([{Console_Number: 'G5', FCL_TEU_Count: 0,
  LCL_Volume: 5, Destination_Sector: 'Australia'}]));
assert(lclGeo.every(region => region.teuContribution === 0));
assert.equal(lclGeo.find(region => region.name === 'Australia').volumeContribution, 100);
console.log('PASS: Geographical contributions preserve totals, use independent FCL/LCL percentages, include unknown sectors and handle empty cargo.');
const routeRecords = Array.from({length: 7}, (_, i) => ({Console_Number: `ROUTE-${i + 1}`,
  Origin_Country: 'India', Origin_City: 'Mumbai', Destination_Country: 'Singapore', Destination_City: `Port ${i + 1}`,
  FCL_TEU_Count: i + 1, LCL_Volume: 7 - i}));
const routeConsols = sea.seaConsols([...routeRecords, {...routeRecords[6]}]);
const fclRoutes = sea.seaRouteShares(routeConsols, 'teu');
const lclRoutes = sea.seaRouteShares(routeConsols, 'volume');
assert(fclRoutes[0].name.endsWith('Port 7, Singapore'));
assert(lclRoutes[0].name.endsWith('Port 1, Singapore'));
for (const shares of [fclRoutes, lclRoutes]) {
  assert.equal(shares.length, 6);
  assert.equal(shares[5].name, 'Others');
  assert.equal(shares[5].value, 3);
  assert.equal(shares.reduce((sum, entry) => sum + entry.value, 0), 28);
}
assert.equal(sea.seaRouteShares([], 'teu').length, 0);
const lclOnlyRoutes = sea.seaConsols([{...routeRecords[0], FCL_TEU_Count: 0, LCL_Volume: 9.75}]);
assert.equal(sea.seaRouteShares(lclOnlyRoutes, 'teu').length, 0);
assert.equal(sea.seaRouteShares(lclOnlyRoutes, 'volume')[0].value, 9.75);
console.log('PASS: Independent Top 5 route rankings, Others, duplicate consols and LCL-only routes.');
