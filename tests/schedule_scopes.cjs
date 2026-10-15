const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/lib/schedule-scope.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS}
}).outputText, {exports: helpers});
const resolve = filters => JSON.parse(JSON.stringify(helpers.resolveScheduleScope(filters,
  [{code: 'IND', name: 'India'}, {code: 'CMB', name: 'Colombo'}],
  [{code: 'BLR', name: 'Bengaluru', company_code: 'IND'}, {code: 'DEL', name: 'Delhi', company_code: 'IND'}])));
for (const field of ['branch', 'branch_code']) {
  const scope = resolve({company_code: 'IND', [field]: 'blr'});
  assert.equal(scope.kind, 'branch');
  assert.equal(scope.code, 'BLR');
  assert.equal(scope.stationCode, 'IND');
}
assert.equal(resolve({company_code: 'IND'}).kind, 'station');
assert.equal(resolve({company_code: 'BLR'}).kind, 'branch');
assert.equal(resolve({company_code: 'all'}).kind, 'global');
assert.equal(resolve({}).kind, 'global');
assert.equal(resolve({branch: 'NEW', company_code: 'CUSTOM'}).stationCode, 'CUSTOM');
assert.equal(resolve({branch: 'BLR', branch_code: 'DEL'}).code, 'BLR');
console.log('PASS: station, current/legacy branch and global schedules have separate scopes; unknown saved codes remain visible.');
