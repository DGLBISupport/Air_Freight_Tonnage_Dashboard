const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("../frontend/node_modules/typescript");
const helpers = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("frontend/lib/recipient-assignments.ts", "utf8"), {
  compilerOptions: {module: ts.ModuleKind.CommonJS}
}).outputText, {exports: helpers});
const users = [
  {email: "branch@example.test", station: "BLR", is_air: true, is_sea: true},
  {email: "station@example.test", station: "IND", is_air: true, is_sea: false},
  {email: "explicit-both@example.test", station: "IND, DEL", is_air: true, is_sea: true},
];
const air = JSON.parse(JSON.stringify(helpers.buildRecipientGroups(users, "AIR")));
assert.deepEqual(air.IND, ["station@example.test", "explicit-both@example.test"]);
assert.deepEqual(air.BLR, ["branch@example.test"]);
assert.deepEqual(air.DEL, ["explicit-both@example.test"]);
assert.equal(helpers.updateRecipientAssignment("BLR", "DEL"), "BLR, DEL");
assert.equal(helpers.updateRecipientAssignment("BLR", "BLR", true), "", "Removing the last location must not subscribe to Global");
assert.equal(helpers.updateRecipientAssignment("IND", "BLR"), "IND, BLR", "Preserve separately saved explicit subscriptions");
assert.equal(helpers.updateRecipientAssignment("CMB", "BLR"), "CMB, BLR", "Do not invent an IND subscription");
const sea = JSON.parse(JSON.stringify(helpers.buildRecipientGroups(users, "SEA")));
assert.deepEqual(sea.IND, ["explicit-both@example.test"]);
assert.deepEqual(sea.BLR, ["branch@example.test"]);
console.log("PASS: branch-only, station-only and explicit dual memberships stay independent; removing an assignment does not grant Global.");
