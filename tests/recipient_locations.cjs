const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const exportsObject = {};
const source = fs.readFileSync("frontend/lib/recipient-locations.ts", "utf8");
vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {exports: exportsObject});
const classify = (stations, branches) => JSON.parse(JSON.stringify(exportsObject.classifyRecipientLocations(stations, branches)));

const confirmed = ["AMD", "BLR", "BOM", "COK", "DEL"];
const rawStations = [
  {code: "IND", name: "India", country: "India"},
  {code: "CMB", name: "Colombo", country: "Sri Lanka"},
  {code: "DXB", name: "Dubai", country: "United Arab Emirates"},
  ...confirmed.map(code => ({code, name: code + " city", country: "India"})),
  {code: "DXB1", name: "Dubai Branch", parent_station_code: "DXB"},
  {code: "PX1", name: "Metadata-only Branch", company_code: "IND"},
];
const rawBranches = [
  {code: " blr ", name: "Bengaluru", company_code: "IND"},
  {code: "del", name: "Delhi", company_code: "IND"},
  {code: "DXB1", name: "Dubai Office", company_code: "DXB"},
  {code: "PX1", name: "Branch without parent in branches table"},
  {code: "HIDDEN", name: "Inactive Branch", is_active: false},
];
const original = JSON.stringify([rawStations, rawBranches]);
const result = classify(rawStations, rawBranches);
assert.deepEqual(result.stations.map(row => row.code).sort(), ["CMB", "DXB", "IND"]);
for (const code of confirmed) {
  assert.equal(result.stations.some(row => row.code === code), false);
  assert.equal(result.branches.filter(row => row.code === code).length, 1);
  assert.equal(result.branches.find(row => row.code === code).company_code, "IND");
}
assert.equal(result.branches.find(row => row.code === "BLR").name, "Bengaluru");
assert.equal(result.branches.find(row => row.code === "DXB1").company_code, "DXB");
assert.equal(result.branches.find(row => row.code === "PX1").company_code, "IND");
assert.equal(result.branches.some(row => row.code === "HIDDEN"), false);
assert.equal(JSON.stringify([rawStations, rawBranches]), original, "Do not mutate source database rows");
assert.deepEqual(classify([], []), {stations: [], branches: []}, "Do not fabricate database locations");
assert.deepEqual(classify([{code: " ind ", name: "India", company_code: "IND"}], []).stations.map(row => row.code), ["IND"], "A station's own company code is not a branch relationship");
console.log("PASS: duplicate table entries, station-only Indian branches, database parent metadata, normalization, inactive rows and source preservation.");
