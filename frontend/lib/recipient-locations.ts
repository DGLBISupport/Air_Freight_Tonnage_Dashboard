type LocationRow = Record<string, any> & { code: string };

// Confirmed business hierarchy, including legacy rows stored only in stations.
const CONFIRMED_BRANCH_PARENTS: Record<string, string> = {
  AMD: "IND", BLR: "IND", BOM: "IND", COK: "IND", DEL: "IND",
};

const locationCode = (value: unknown): string => String(value || "").trim().toUpperCase();

function parentCode(row: LocationRow): string {
  for (const field of ["parent_station_code", "station_code", "company_code", "parent_code"]) {
    const parent = locationCode(row[field]);
    if (parent && parent !== row.code) return parent;
  }
  return "";
}

/** Cross-check both tables: a code classified as a branch cannot be a station. */
export function classifyRecipientLocations(stationRows: Record<string, any>[], branchRows: Record<string, any>[]) {
  const normalize = (rows: Record<string, any>[]): LocationRow[] => rows
    .filter(row => row.is_active !== false && locationCode(row.code))
    .map(row => ({ ...row, code: locationCode(row.code) }));
  const stations = normalize(stationRows);
  const branches = new Map<string, LocationRow>();

  for (const row of normalize(branchRows)) {
    branches.set(row.code, { ...row, company_code: CONFIRMED_BRANCH_PARENTS[row.code] || parentCode(row) });
  }
  for (const row of stations) {
    const kind = String(row.location_type || row.type || "").trim().toLowerCase();
    const parent = CONFIRMED_BRANCH_PARENTS[row.code] || parentCode(row);
    if (branches.has(row.code) || parent || row.is_branch === true || kind === "branch") {
      const branch: LocationRow = { ...row, ...branches.get(row.code), code: row.code };
      branch.company_code = CONFIRMED_BRANCH_PARENTS[row.code] || parentCode(branch) || parent;
      branches.set(row.code, branch);
    }
  }

  return {
    stations: Array.from(new Map(stations.filter(row => !branches.has(row.code)).map(row => [row.code, row])).values()),
    branches: Array.from(branches.values()).sort((left, right) => String(left.name || left.code).localeCompare(String(right.name || right.code))),
  };
}
