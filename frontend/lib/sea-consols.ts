import { operationalDay } from "./operational-date";

export type SeaConsol = {
  console: string; master: string; line: string; group: string; day: string;
  origin: string; destination: string; company: string; teu: number; volume: number; revenue: number;
  originCountry: string; originCity: string; destinationCountry: string; destinationCity: string;
};
export type SeaTotals = { teu: number; volume: number; revenue: number; consols: number };

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
    } else {
      const route = (city: any, country: any) => [city, country].filter(v => v && v !== "N/A").join(", ") || "N/A";
      map.set(number, {
        console: number, master: row.Master_Bill_of_Lading ?? row.Master_Airway_Bill ?? row.MasterBillNum ?? "—",
        line: row.Shippingline ?? row.ShippingLine ?? row.Airline ?? "Unknown",
        group: row.shippinglineGroup ?? row.ShippinglineGroup ?? row.ShippingLineGroup ?? "—",
        day: operationalDay(row.ETD, row.Company_Code ?? row.Company, row.Origin_Country),
        origin: route(row.Origin_City, row.Origin_Country), destination: route(row.Destination_City, row.Destination_Country),
        originCountry: row.Origin_Country || "N/A", originCity: row.Origin_City || "N/A",
        destinationCountry: row.Destination_Country || "N/A", destinationCity: row.Destination_City || "N/A",
        company: row.Company_Code ?? "Unlinked", teu, volume, revenue,
      });
    }
  }
  return Array.from(map.values());
}

export function seaTotals(rows: SeaConsol[]): SeaTotals {
  return rows.reduce((sum, row) => ({teu: sum.teu + row.teu, volume: sum.volume + row.volume,
    revenue: sum.revenue + row.revenue, consols: sum.consols + 1}), {teu: 0, volume: 0, revenue: 0, consols: 0});
}

export function seaSummary(rows: SeaConsol[], key: (row: SeaConsol) => string) {
  const map = new Map<string, SeaTotals>();
  for (const row of rows) {
    const name = key(row), total = map.get(name) ?? {teu: 0, volume: 0, revenue: 0, consols: 0};
    total.teu += row.teu; total.volume += row.volume; total.revenue += row.revenue; total.consols += 1;
    map.set(name, total);
  }
  return Array.from(map.entries()).map(([name, total]) => ({name, ...total}));
}
