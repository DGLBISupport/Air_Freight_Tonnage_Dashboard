"use client";

import { Fragment } from "react";
import { SeaConsol, SeaTotals, seaSummary, seaTotals } from "@/lib/sea-consols";

const colors = ["#4299E1", "#319795", "#ED64A6", "#5A67D8", "#81E6D9", "#ED8936", "#ECC94B", "#48BB78", "#9F7AEA", "#718096"];
const countryColors = ["#EBF8FF", "#F0FFF4", "#FFFBEB", "#FAF5FF", "#FFF1F2", "#F0FDFA"];
const quantity = (value: number) => value.toLocaleString("en-US", {maximumFractionDigits: 2});
const money = (value: number) => value.toLocaleString("en-US", {style: "currency", currency: "USD"});
const cell = "px-3 py-3 print:py-2 print:px-2 print:leading-tight";
const head = "border-b border-[#E2E8F0] text-slate-400 uppercase font-bold text-[10px] print:text-[10px] tracking-wider bg-slate-50/70";
const table = "w-full text-left text-xs print:text-[11px] border-collapse";
const routeKey = (row: SeaConsol) => JSON.stringify([row.originCountry, row.originCity, row.destinationCountry, row.destinationCity]);

function TablePanel({title, description, count, print, children}: {
  title: string; description: string; count: string; print: boolean; children: React.ReactNode;
}) {
  return <section data-sea-table={title} className={print ? "border border-slate-200 rounded-xl p-3 bg-white shadow-sm" : "saas-card bg-white p-6"}>
    <div className="report-heading flex flex-wrap items-center justify-between gap-2 mb-4 print:mb-2 pb-2 border-b border-[#F1F5F9]">
      <div><h3 className="text-sm print:text-[12.5px] font-bold text-[#1A202C]">{title}</h3>
        <p className="text-xs print:text-[9px] text-slate-400 mt-0.5">{description}</p></div>
      <span className="text-[10px] print:text-[9px] font-semibold text-slate-400">{count}</span>
    </div>
    <div className="overflow-x-auto print:overflow-visible">{children}</div>
  </section>;
}

function Rank({index, color, pastel = false}: {index: number; color: string; pastel?: boolean}) {
  return <td className={`${cell} w-8`}><span className={`inline-flex items-center justify-center w-5 h-5 rounded-xl text-[10px] font-extrabold ${pastel ? "text-slate-800 border border-slate-300" : "text-white"}`} style={{backgroundColor: color, borderRadius: "50%"}}>{index + 1}</span></td>;
}

function MetricHead() {
  return <><th className={`${cell} text-right`}>FCL TEUs</th><th className={`${cell} text-right`}>LCL Volume (m³)</th>
    <th className={`${cell} text-right`}>No of Masters</th><th className={`${cell} text-right`}>Revenue (USD)</th></>;
}

function Metrics({row, total, color = "#4299E1", share = false, route = false}: {
  row: SeaTotals; total?: SeaTotals; color?: string; share?: boolean; route?: boolean;
}) {
  const shareMetric = total?.teu ? "teu" : "volume";
  const percentage = total?.[shareMetric] ? Math.min(100, row[shareMetric] / total[shareMetric] * 100) : 0;
  return <><td className={`${cell} text-right tabular-nums`}><div className="flex flex-col items-end gap-0.5">
    <span className={route ? "font-semibold text-slate-700" : "font-bold text-[#3182CE]"}>{quantity(row.teu)}</span>
    {share && shareMetric === "teu" && <div aria-label={`${quantity(percentage)}% of FCL TEUs`} className="h-1 rounded-full bg-slate-100 w-16 overflow-hidden"><div className="h-full rounded-full" style={{width: `${percentage}%`, backgroundColor: color}} /></div>}
  </div></td><td className={`${cell} text-right tabular-nums font-semibold text-slate-700`}><div className="flex flex-col items-end gap-0.5">{quantity(row.volume)}
    {share && shareMetric === "volume" && <div aria-label={`${quantity(percentage)}% of LCL volume`} className="h-1 rounded-full bg-slate-100 w-16 overflow-hidden"><div className="h-full rounded-full" style={{width: `${percentage}%`, backgroundColor: color}} /></div>}
  </div></td><td data-sea-master-count className={`${cell} text-right tabular-nums font-semibold text-slate-700`}>{row.masters}</td>
    <td className={`${cell} text-right tabular-nums font-bold text-emerald-600 whitespace-nowrap`}>{money(row.revenue)}</td></>;
}

function Total({rows, span, label = "TOTAL"}: {rows: SeaConsol[]; span: number; label?: string}) {
  return <tfoot style={{display: "table-row-group"}}><tr className="border-t-2 border-[#E2E8F0] bg-slate-50/80 font-extrabold text-xs print:text-[10px]">
    <td colSpan={span} className={`${cell} text-[#2D3748]`}>{label}</td><Metrics row={seaTotals(rows)} />
  </tr></tfoot>;
}

export function SeaShippingTable({rows, print = false, showRouteBreakdown = true}: {rows: SeaConsol[]; print?: boolean; showRouteBreakdown?: boolean}) {
  const lines = seaSummary(rows, row => row.line).sort((a, b) => b.teu - a.teu || b.volume - a.volume);
  const total = seaTotals(rows);
  return <TablePanel title="Shipping Line Consol Summary" description="Aggregated by shipping line · ranked by FCL TEUs" count={`${lines.length} Shipping Lines`} print={print}>
    <table className={table}><thead><tr className={head}><th className={`${cell} w-8`}>#</th><th className={cell}>Shipping Line</th><MetricHead /></tr></thead>
      <tbody className="divide-y divide-[#F1F5F9]">{lines.map((line, index) => {
        const lineRows = rows.filter(row => row.line === line.name);
        const groups = Array.from(new Set(lineRows.map(row => row.group).filter(group => group !== "—"))).join(", ");
        const routes = seaSummary(lineRows, routeKey).sort((a, b) => b.teu - a.teu || b.volume - a.volume);
        return <Fragment key={line.name}><tr data-summary-row className="hover:bg-slate-50/60 transition-colors">
          <Rank index={index} color={colors[index % colors.length]} /><td className={`${cell} font-bold text-[#2D3748]`}>{line.name}
            {groups && <span className="block text-[10px] print:text-[9px] font-normal text-slate-400 mt-0.5">{groups}</span>}</td>
          <Metrics row={line} total={total} color={colors[index % colors.length]} share />
        </tr>{showRouteBreakdown && routes.map(route => {
          const [, originCity, , destinationCity] = JSON.parse(route.name);
          return <tr data-route-row key={route.name} className="bg-[#EBF8FF]/50 text-slate-950 text-[11px] print:text-[9px] border-l-4 border-blue-300 hover:bg-[#EBF8FF]/70 transition-colors">
            <td /><td className="px-3 py-2 pl-8 print:py-1 print:pl-5">{originCity} → {destinationCity}</td><Metrics row={route} route />
          </tr>;
        })}</Fragment>;
      })}</tbody><Total rows={rows} span={2} /></table>
  </TablePanel>;
}

export function SeaRouteTable({rows, print = false}: {rows: SeaConsol[]; print?: boolean}) {
  const allRoutes = seaSummary(rows, routeKey).sort((a, b) => b.teu - a.teu || b.volume - a.volume);
  const routes = allRoutes.slice(0, 10);
  const remaining = allRoutes.slice(10);
  const remainingKeys = new Set(remaining.map(route => route.name));
  // A bill appearing in multiple remaining routes still counts once in Others.
  const others = seaTotals(rows.filter(row => remainingKeys.has(routeKey(row))));
  const total = seaTotals(rows);
  const countries = Array.from(new Set(rows.map(row => row.destinationCountry)));
  return <TablePanel title="Trade Route Consol Summary" description="Top 10 origin and destination routes · ranked by FCL TEUs, then LCL volume" count={`${allRoutes.length} Routes${remaining.length ? " · Top 10 + Others" : ""}`} print={print}>
    <table className={table}><thead><tr className={head}>{["#", "Origin Country", "Origin City", "Destination Country", "Destination City"].map(label => <th key={label} className={cell}>{label}</th>)}<MetricHead /></tr></thead>
      <tbody className="divide-y divide-[#F1F5F9]">{routes.map((route, index) => {
        const places: string[] = JSON.parse(route.name);
        const color = countryColors[countries.indexOf(places[2]) % countryColors.length];
        return <tr key={route.name} data-summary-row style={{backgroundColor: color}} className="hover:opacity-90 transition-colors"><Rank index={index} color={color} pastel />
          {places.map((place, i) => <td key={i} className={`${cell} ${i === 0 ? "font-bold text-[#2D3748]" : "font-medium text-slate-600"}`}>{place}</td>)}
          <Metrics row={route} total={total} color="#319795" share /></tr>;
      })}{remaining.length > 0 && <tr data-others-row className="bg-slate-50 font-semibold">
        <td colSpan={5} className={`${cell} text-[#2D3748]`}>Others <span className="text-slate-400 font-normal">({remaining.length} routes)</span></td>
        <Metrics row={others} total={total} color="#718096" share />
      </tr>}</tbody><Total rows={rows} span={5} /></table>
  </TablePanel>;
}

export function SeaDestinationTable({rows, print = false}: {rows: SeaConsol[]; print?: boolean}) {
  const destinations = seaSummary(rows, row => row.destination).sort((a, b) => b.teu - a.teu || b.volume - a.volume);
  return <TablePanel title="Destination Consol Summary" description="Aggregated by destination · ranked by FCL TEUs" count={`${destinations.length} Destinations`} print={print}>
    <table className={table}><thead><tr className={head}><th className={`${cell} w-8`}>#</th><th className={cell}>Destination</th><MetricHead /></tr></thead>
      <tbody className="divide-y divide-[#F1F5F9]">{destinations.map((row, index) => <tr key={row.name} data-summary-row className="hover:bg-slate-50/60 transition-colors">
        <Rank index={index} color={colors[index % colors.length]} /><td className={`${cell} font-bold text-[#2D3748]`}>{row.name}</td>
        <Metrics row={row} total={seaTotals(rows)} color={colors[index % colors.length]} share />
      </tr>)}</tbody><Total rows={rows} span={2} /></table>
  </TablePanel>;
}

export function SeaLedgerTable({rows, print = false, maxRows}: {rows: SeaConsol[]; print?: boolean; maxRows?: number}) {
  const visible = print && maxRows ? rows.slice(0, maxRows) : rows;
  const total = seaTotals(visible);
  return <TablePanel title="Consol Ledger" description="One row per consol · departure, route and cargo details" count={`${visible.length} of ${rows.length} consols`} print={print}>
    <table className={table}><thead><tr className={head}>{["Consol", "Master Bill of Lading", "Shipping Line / Group", "ETD", "Origin", "Destination", "Company", "FCL TEUs", "LCL (m³)", "Revenue (USD)"].map((label, i) => <th key={label} className={`${cell} ${i >= 7 ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-[#F1F5F9]">{visible.map(row => <tr key={row.console} className="hover:bg-slate-50/60 transition-colors">
        <td className={`${cell} font-bold text-[#2D3748]`}>{row.console}</td><td className={`${cell} text-slate-600`}>{row.master ?? "—"}</td>
        <td className={`${cell} font-semibold text-[#2D3748]`}>{row.line}<span className="block text-[10px] print:text-[9px] font-normal text-slate-400">{row.group}</span></td>
        <td className={`${cell} text-slate-600 whitespace-nowrap`}>{row.day || "—"}</td><td className={`${cell} text-slate-600`}>{row.origin}</td><td className={`${cell} text-slate-600`}>{row.destination}</td><td className={`${cell} text-slate-600`}>{row.company}</td>
        <td className={`${cell} text-right tabular-nums font-bold text-[#3182CE]`}>{quantity(row.teu)}</td><td className={`${cell} text-right tabular-nums font-semibold text-slate-700`}>{quantity(row.volume)}</td><td className={`${cell} text-right tabular-nums font-bold text-emerald-600 whitespace-nowrap`}>{money(row.revenue)}</td>
      </tr>)}</tbody><tfoot style={{display: "table-row-group"}}><tr className="border-t-2 border-[#E2E8F0] bg-slate-50/80 font-extrabold text-xs print:text-[10px]">
        <td className={`${cell} text-[#2D3748]`} colSpan={7}>{visible.length < rows.length ? "SUBTOTAL (DISPLAYED CONSOLS)" : "TOTAL"}</td>
        <td className={`${cell} text-right tabular-nums text-[#3182CE]`}>{quantity(total.teu)}</td><td className={`${cell} text-right tabular-nums text-slate-700`}>{quantity(total.volume)}</td><td className={`${cell} text-right tabular-nums text-emerald-600 whitespace-nowrap`}>{money(total.revenue)}</td>
      </tr></tfoot></table>
  </TablePanel>;
}
