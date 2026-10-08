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
assert.equal(total.teu, 3.5);
assert.equal(total.volume, 15.75);
assert.equal(total.revenue, 320);
assert.equal(sea.seaSummary(rows, row => row.line)[0].consols, 2);
assert(!('Total_Shipments' in rows[0]));
console.log('PASS: Sea consol totals, query aliases, duplicate customer rows and station dates.');
