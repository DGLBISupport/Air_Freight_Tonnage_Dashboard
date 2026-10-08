import { operationalDay } from "./operational-date";

export type SeaConsol = {
  console: string; master: string | null; line: string; group: string; day: string;
  origin: string; destination: string; company: string; teu: number; volume: number; revenue: number;
  originCountry: string; originCity: string; destinationCountry: string; destinationCity: string;
  sector?: string;
};
export type SeaTotals = { teu: number; volume: number; revenue: number; consols: number; masters: number };

/** All Sea carrier charts and tables use the shipping-line group. */
export function seaShippingGroup(row: any): string {
  const group = row.ShippinglineGroup ?? row.shippinglineGroup ?? row.ShippingLineGroup;
  return group === undefined || group === null || group === "" ? "Unknown Group" : String(group);
}

// Only NULL is excluded. Every other value is compared exactly as supplied.
export function seaMasterKey(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function seaMasterNumber(row: any): string | null {
  for (const column of ["Master_Bill_of_Lading", "Master_Airway_Bill", "MasterBillNum"]) {
    if (row[column] !== undefined) return seaMasterKey(row[column]);
  }
  return null;
}

export function seaMasterCount(rows: SeaConsol[]): number {
  return new Set(rows.map(row => seaMasterKey(row.master)).filter(value => value !== null)).size;
}

export function seaConsols(records: any[]): SeaConsol[] {
  const map = new Map<string, SeaConsol>();
  for (const row of records) {
    const number = String(row.Console_Number ?? row.ConsoleNumber ?? "");
    if (!number) continue;
    const teu = Number(row.FCL_TEU_Count ?? row.TEUCount ?? row.Total_Tonnage ?? 0);
    const volume = Number(row.LCL_Volume ?? row.Volume_M3 ?? row.Total_Volume_M3 ?? 0);
    const revenue = Number(row.Revenue_USD ?? row.Total_Revenue ?? 0);
    const existing = map.get(number);
    if (existing) {
      existing.teu = Math.max(existing.teu, teu);
      existing.volume = Math.max(existing.volume, volume);
      existing.revenue += revenue;
      if (existing.master === null) existing.master = seaMasterNumber(row);
    } else {
      const route = (city: any, country: any) => [city, country].filter(v => v && v !== "N/A").join(", ") || "N/A";
      map.set(number, {
        console: number, master: seaMasterNumber(row),
        line: seaShippingGroup(row), group: seaShippingGroup(row),
        day: operationalDay(row.ETD, row.Company_Code ?? row.Company, row.Origin_Country),
        origin: route(row.Origin_City, row.Origin_Country), destination: route(row.Destination_City, row.Destination_Country),
        originCountry: row.Origin_Country || "N/A", originCity: row.Origin_City || "N/A",
        destinationCountry: row.Destination_Country || "N/A", destinationCity: row.Destination_City || "N/A",
        company: row.Company_Code ?? "Unlinked", teu, volume, revenue,
        sector: row.Destination_Sector ?? "Other",
      });
    }
  }
  return Array.from(map.values());
}

export function seaTotals(rows: SeaConsol[]): SeaTotals {
  return rows.reduce((sum, row) => ({teu: sum.teu + row.teu, volume: sum.volume + row.volume,
    revenue: sum.revenue + row.revenue, consols: sum.consols + 1, masters: sum.masters}),
    {teu: 0, volume: 0, revenue: 0, consols: 0, masters: seaMasterCount(rows)});
}

export function seaSummary(rows: SeaConsol[], key: (row: SeaConsol) => string) {
  const map = new Map<string, SeaTotals>();
  const masters = new Map<string, Set<string>>();
  for (const row of rows) {
    const name = key(row), total = map.get(name) ?? {teu: 0, volume: 0, revenue: 0, consols: 0, masters: 0};
    total.teu += row.teu; total.volume += row.volume; total.revenue += row.revenue; total.consols += 1;
    const bills = masters.get(name) ?? new Set<string>();
    const bill = seaMasterKey(row.master);
    if (bill !== null) bills.add(bill);
    masters.set(name, bills);
    total.masters = bills.size;
    map.set(name, total);
  }
  return Array.from(map.entries()).map(([name, total]) => ({name, ...total}));
}

export function seaRouteShares(rows: SeaConsol[], metric: "teu" | "volume") {
  const secondary = metric === "teu" ? "volume" : "teu";
  const routes = seaSummary(rows, row => JSON.stringify([
    row.originCountry, row.originCity, row.destinationCountry, row.destinationCity,
  ])).filter(route => route[metric] > 0)
    .sort((a, b) => b[metric] - a[metric] || b[secondary] - a[secondary] || a.name.localeCompare(b.name));
  const entries = routes.slice(0, 5).map(route => {
    const [originCountry, originCity, destinationCountry, destinationCity]: string[] = JSON.parse(route.name);
    const place = (city: string, country: string) => [city, country].filter(value => value && value !== "N/A").join(", ") || "N/A";
    return {key: route.name, name: `${place(originCity, originCountry)} → ${place(destinationCity, destinationCountry)}`,
      cityRoute: `${originCity} → ${destinationCity}`, countryRoute: `${originCountry} → ${destinationCountry}`,
      value: route[metric], others: false};
  });
  if (routes.length > 5) entries.push({key: "others", name: "Others", cityRoute: "Others", countryRoute: "", others: true,
    value: routes.slice(5).reduce((sum, route) => sum + route[metric], 0)});
  return entries;
}
