import {SeaConsol} from "./sea-consols";

export const seaSectors = [
  {key: "Europe Other", label: "Europe"}, {key: "USA", label: "USA"},
  {key: "North America Other", label: "North America"},
  {key: "Central America & Caribbean", label: "Central America"},
  {key: "South America", label: "South America"}, {key: "Middle East", label: "Middle East"},
  {key: "South East Asia", label: "South East Asia"},
  {key: "India & Sub Continent", label: "India & Sub Continent"},
  {key: "Northern Asia", label: "Northern Asia"}, {key: "Africa", label: "Africa"},
  {key: "South Africa", label: "South Africa"}, {key: "Australia", label: "Australia"},
  {key: "Pacific Islands", label: "Pacific"}, {key: "Other", label: "Others"},
];
export type SectorValues = {teu: number; volume: number};
export type SeaSectorRow = SectorValues & {name: string; sectors: SectorValues[]; others?: boolean};

export function seaSectorSummary(consols: SeaConsol[]) {
  const empty = (name: string): SeaSectorRow => ({name, teu: 0, volume: 0,
    sectors: seaSectors.map(() => ({teu: 0, volume: 0}))});
  const byLine = new Map<string, SeaSectorRow>();
  for (const consol of consols) {
    const row = byLine.get(consol.line) ?? empty(consol.line);
    let index = seaSectors.findIndex(sector => sector.key.toLowerCase() === (consol.sector ?? "").trim().toLowerCase());
    if (index < 0) index = seaSectors.length - 1;
    row.teu += consol.teu; row.volume += consol.volume;
    row.sectors[index].teu += consol.teu; row.sectors[index].volume += consol.volume;
    byLine.set(consol.line, row);
  }
  const all = Array.from(byLine.values()).sort((a, b) => b.teu - a.teu || b.volume - a.volume || a.name.localeCompare(b.name));
  const sumRows = (rows: SeaSectorRow[], name: string) => rows.reduce((sum, row) => {
    sum.teu += row.teu; sum.volume += row.volume;
    row.sectors.forEach((sector, index) => {
      sum.sectors[index].teu += sector.teu; sum.sectors[index].volume += sector.volume;
    });
    return sum;
  }, empty(name));
  const rows = all.slice(0, 20);
  if (all.length > 20) rows.push({...sumRows(all.slice(20), "OTHERS – TOTAL"), others: true});
  return {rows, total: sumRows(all, "TOTAL"), lineCount: all.length};
}

export function formatSeaSectorQuantity(value: number | null | undefined): string {
  const num = Number(value);
  if (value == null || isNaN(num) || num === 0 || Math.abs(num) < 0.0001) return "-";
  return num.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

/** Match Air's eight chart regions, including all remaining sectors in Other Sectors. */
export function seaGeographicalContribution(consols: SeaConsol[]) {
  const {total} = seaSectorSummary(consols);
  const groups = [
    {name: "Europe", sectors: [0]}, {name: "USA", sectors: [1]},
    {name: "S.East Asia", sectors: [6]}, {name: "Africa", sectors: [9]},
    {name: "India & Sub Cont.", sectors: [7]}, {name: "Mid East", sectors: [5]},
    {name: "Australia", sectors: [11]}, {name: "Other Sectors", sectors: [2, 3, 4, 8, 10, 12, 13]},
  ];
  return groups.map(group => {
    const values = group.sectors.reduce((sum, index) => ({
      teu: sum.teu + total.sectors[index].teu,
      volume: sum.volume + total.sectors[index].volume,
    }), {teu: 0, volume: 0});
    return {name: group.name, ...values,
      teuContribution: total.teu > 0 ? values.teu / total.teu * 100 : 0,
      volumeContribution: total.volume > 0 ? values.volume / total.volume * 100 : 0};
  });
}
