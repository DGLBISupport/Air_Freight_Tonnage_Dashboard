type Location = {code: string; name?: string; company_code?: string};
export type ScheduleScope = {kind: "station" | "branch" | "global"; code: string; stationCode: string; label: string};

/** Accept the current branch field and schedules saved with the older name. */
export function resolveScheduleScope(filters: Record<string, any> = {}, stations: Location[] = [], branches: Location[] = []): ScheduleScope {
  const company = String(filters.company_code || "").trim().toUpperCase();
  const branch = String(filters.branch || filters.branch_code || "").trim().toUpperCase();
  const branchInfo = branches.find(location => location.code.toUpperCase() === (branch || company));
  if (branch || filters.report_level === "branch" || branchInfo) {
    const code = branch || branchInfo?.code.toUpperCase() || "UNSPECIFIED";
    const stationCode = String(branchInfo?.company_code || (company !== code ? company : "") || "").toUpperCase();
    return {kind: "branch", code, stationCode, label: `${branchInfo?.name || code} (${code})${stationCode ? ` · ${stationCode}` : ""}`};
  }
  if (company && !["ALL", "GLOBAL"].includes(company)) {
    const station = stations.find(location => location.code.toUpperCase() === company);
    return {kind: "station", code: company, stationCode: company, label: `${station?.name || filters.country || company} (${company})`};
  }
  return {kind: "global", code: "GLOBAL", stationCode: "", label: "Global (All)"};
}
