const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const util = {};
const compile = code => ts.transpileModule(code, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(compile(fs.readFileSync('frontend/lib/operational-date.ts', 'utf8')), {exports: util});

function actualFunction(path, name, context) {
  const source = ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) body = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert(body, name);
  const exports = {};
  vm.runInNewContext(compile('exports.run = ' + body), {...context, exports});
  return exports.run;
}

for (const zone of ['UTC', 'Asia/Colombo', 'America/Los_Angeles', 'Pacific/Auckland']) {
  process.env.TZ = zone;
  assert.equal(util.operationalDay('2026-10-01T00:15:00', 'IND'), '2026-10-01');
  assert.equal(util.operationalDay('2026-09-30T19:00:00Z', 'IND'), '2026-10-01');
  assert.equal(util.operationalDay('2026-10-01T00:15:00+05:30', 'IND'), '2026-10-01');
  assert.equal(util.operationalDay('2026-11-01T04:30:00Z', 'NYC'), '2026-11-01');
  assert.equal(util.operationalDay('2026-03-08T04:30:00Z', 'NYC'), '2026-03-07');
  const rows = [
    {Console_Number: 'C1', Company_Code: 'IND', ETD: '2026-10-01T00:15:00', Airline: 'MSC', Total_Tonnage: 41.8},
    {Console_Number: 'C2', Company_Code: 'IND', ETD: '2026-09-30T19:00:00Z', Airline: 'MSC', Total_Tonnage: 110.6},
  ];
  const context = {...util, transportMode: 'SEA', data: rows, getAirlineWiseData: () => [{name: 'MSC'}],
    startDate: '2026-10-01', endDate: '2026-10-07', mode: 'custom-sql',
    sqlQuery: "SELECT * WHERE ETD >= '2026-10-01' AND ETD <= '2026-10-07'"};
  for (const path of ['frontend/app/page.tsx', 'frontend/app/print-view/page.tsx']) {
    const days = actualFunction(path, 'getDailyStackedAirlineData', context)();
    assert(days.some(d => d.sortKey === '2026-10-01'));
    assert(!days.some(d => d.sortKey.startsWith('2026-09')));
    assert(Math.abs(days.find(d => d.sortKey === '2026-10-01').MSC - 152.4) < 1e-9);
    const months = actualFunction(path, 'parseMonthlyData', context)(rows, 'SEA');
    assert.equal(months.length, 1);
    assert.equal(months[0].Month, 10);
    const weeks = actualFunction(path, 'parseWeeklyData', context)(rows, 'SEA');
    assert.equal(weeks.length, 1);
    assert.equal(weeks[0].Week_Start, '2026-09-28'); // ISO week start, not a daily ETD.
  }
  const days = actualFunction('frontend/app/page.tsx', 'getDailyTonnageData', context)();
  assert.equal(days.length, 1);
  assert.equal(days[0].date_label, 'Thu 1/10');
  assert.equal(util.freightIsoWeek(util.freightEtdDate({ETD: '2027-01-01'}, 'SEA'), 'SEA').year, 2026);
}
console.log('PASS: Actual dashboard/PDF daily, weekly and monthly functions use station dates in four browser timezones.');
