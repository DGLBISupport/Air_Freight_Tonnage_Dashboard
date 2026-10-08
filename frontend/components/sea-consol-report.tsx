"use client";

import { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { seaConsols, seaSummary, seaTotals } from "@/lib/sea-consols";
import { freightIsoWeek } from "@/lib/operational-date";
import { SeaVolumePanel } from "./sea-volume-panel";
import { SeaShippingTable, SeaRouteTable, SeaDestinationTable, SeaLedgerTable } from "./sea-consol-tables";
import { Skeleton } from "./ui/skeleton";

type Sections = {weeklyVisual: boolean; weeklyLedger: boolean; monthlyVisual: boolean; monthlyLedger: boolean; sectorDistribution: boolean};
const allSections: Sections = {weeklyVisual: true, weeklyLedger: true, monthlyVisual: true, monthlyLedger: true, sectorDistribution: true};
const colors = ["#4299E1", "#319795", "#ED64A6", "#5A67D8", "#81E6D9", "#ED8936", "#ECC94B", "#48BB78", "#9F7AEA", "#718096"];
const quantity = (value: number) => value.toLocaleString("en-US", {maximumFractionDigits: 2});
const money = (value: number) => value.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 2});
const labelForDay = (day: string) => {
  const date = new Date(day + "T00:00:00Z");
  return `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
};

/** Air's visual layout with exclusively consol-based Sea metrics. */
export function SeaConsolReport({records, print = false, loading = false, dateRange = "", station = "", sections = allSections,
  maxRows, viewMode = "standard", reportType = "weekly", showRouteBreakdown = true}: {records: any[]; print?: boolean; loading?: boolean;
  dateRange?: string; station?: string; sections?: Sections; maxRows?: number; viewMode?: "standard" | "custom-sql"; reportType?: string; showRouteBreakdown?: boolean}) {
  const rows = useMemo(() => seaConsols(records), [records]);
  const totals = seaTotals(rows);
  const lines = seaSummary(rows, r => r.line).sort((a, b) => b.teu - a.teu);
  const daily = seaSummary(rows.filter(r => r.day), r => r.day).sort((a, b) => a.name.localeCompare(b.name)).map(row => ({...row, label: labelForDay(row.name)}));
  const topLines = lines.slice(0, 10), otherLines = lines.slice(10);
  const share = [...topLines.map((line, i) => ({name: line.name, value: line.teu, color: colors[i]})),
    ...(otherLines.length ? [{name: "Others", value: otherLines.reduce((sum, line) => sum + line.teu, 0), color: "#718096"}] : [])];
  // Numeric series keys keep dots and brackets in shipping-line names literal.
  const lineKeys = new Map(topLines.map((line, i) => [line.name, `line_${i}`]));
  const stacks = new Map(daily.map(day => [day.name, {...day} as Record<string, any>]));
  for (const row of rows) {
    const day = stacks.get(row.day);
    if (day) { const key = lineKeys.get(row.line) ?? "others"; day[key] = (day[key] ?? 0) + row.teu; }
  }
  const weekly = seaSummary(rows.filter(r => r.day), r => {
    const week = freightIsoWeek(new Date(r.day + "T00:00:00Z"), "SEA");
    return `${week.year}-${String(week.week).padStart(2, "0")}`;
  }).sort((a, b) => a.name.localeCompare(b.name)).map(row => ({...row, label: `W${Number(row.name.slice(5))} '${row.name.slice(2, 4)}`}));
  const panel = print ? "border border-slate-200 rounded-xl p-2 bg-white shadow-sm" : "saas-card p-6 bg-white";
  const tick = {fontSize: print ? 9 : 10, fill: "#718096", fontWeight: 500};
  const badge = "text-[10px] text-[#4299E1] bg-[#EBF8FF] font-semibold px-2 py-0.5 rounded-full border border-[#BEE3F8]";
  const period = reportType === "monthly" ? "Monthly" : "Weekly";
  const chapter = (title: string) => <div className="report-heading flex flex-wrap items-center gap-2 pb-2 border-b border-[#E2E8F0]">
    <span className="h-5 w-1.5 bg-[#4299E1] rounded-full" /><h2 className="text-base print:text-sm font-bold text-[#1A202C]">{title}</h2>
    {station && <span className={badge}>{station}</span>}
  </div>;
  const chartHeading = (eyebrow: string, title: string, tag: string) => <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:mb-1 border-b border-[#F1F5F9] pb-4 print:pb-1">
    <div><p className="text-[11px] print:text-[9px] font-bold text-slate-400 uppercase tracking-widest">{eyebrow}</p><h3 className="text-sm print:text-xs font-bold text-[#1A202C] mt-0.5">{title}</h3></div><span className={badge}>{tag}</span>
  </div>;
  return <div data-sea-report className={print ? "space-y-4" : "space-y-6"}>
    {print && <header className="report-heading border-b-2 border-slate-200 pb-3 flex flex-col gap-1">
      <div className="flex items-center gap-2.5"><img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" /><h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-none">Sea Freight Consol Analysis</h1></div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1"><p className="text-[12.5px] font-semibold text-slate-400">Dart Global Logistics · {period} Operational Performance</p><span className="text-slate-700 font-bold text-[12.5px] tabular-nums">{[dateRange, station].filter(Boolean).join(" | ")}</span></div>
    </header>}
    <div className={`sea-kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 ${print ? "gap-4" : "gap-6"}`} style={{breakInside: "avoid"}}>
      {[{name: "Revenue", value: money(totals.revenue)}, {name: "FCL TEUs", value: quantity(totals.teu)}, {name: "LCL Volume (m³)", value: quantity(totals.volume)}, {name: "No. of Consols", value: String(totals.consols)}].map(card =>
        <div key={card.name} className={print ? "sea-kpi-card border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-center gap-1.5 h-[80px]" : "sea-kpi-card saas-card p-5 bg-white flex flex-col justify-center h-28 relative overflow-hidden"}>
          <p className={`${print ? "text-[11.5px]" : "text-[10px]"} uppercase font-bold text-slate-400 tracking-widest`}>{card.name}</p>
          {loading ? <Skeleton className="h-8 w-28 mt-2 bg-slate-100" /> : <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1">{card.value}</h3>}
        </div>)}
    </div>
    {loading ? <p role="status" className="p-8 text-sm text-slate-500">Loading consol data…</p> : <>
      <div className="space-y-4">
        {chapter(`${period} Operational Performance`)}
        {sections.weeklyVisual && <div className={`sea-operational-grid grid grid-cols-12 ${print ? "gap-4" : "gap-6"}`} style={{breakInside: print ? "avoid" : undefined}}>
          <section className={`${panel} col-span-12 lg:col-span-8 print:col-span-8`}>
            {chartHeading(viewMode === "standard" ? "Revenue Flow" : "Shipping Line Breakdown", viewMode === "standard" ? "Cargo Revenue Trend - Weekly" : "Top 10 Shipping Lines FCL TEU Share", viewMode === "standard" ? "Weekly aggregation" : "Day-by-Day Stack")}
            <div style={{height: print ? 110 : 320}}><ResponsiveContainer width="100%" height="100%">
              {viewMode === "standard" ? <AreaChart data={weekly} margin={{top: 15, right: 10, left: 0, bottom: 5}}>
                <defs><linearGradient id={print ? "seaPrintRevenue" : "seaRevenue"} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4299E1" stopOpacity={0.25} /><stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{stroke: "#E2E8F0"}} /><YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={v => `$${quantity(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => [money(value), "Revenue"]} /><Area dataKey="revenue" name="Revenue" stroke="#3182CE" strokeWidth={2.5} fill={`url(#${print ? "seaPrintRevenue" : "seaRevenue"})`} dot={{r: 3}} isAnimationActive={!print} />
              </AreaChart> : <BarChart data={Array.from(stacks.values())} margin={{top: 15, right: 10, left: 0, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{stroke: "#E2E8F0"}} /><YAxis tick={tick} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number, name: string) => [`${quantity(value)} TEU`, name]} />
                {topLines.map((line, i) => <Bar key={line.name} name={line.name} dataKey={`line_${i}`} stackId="lines" fill={colors[i]} isAnimationActive={!print} />)}
                {otherLines.length > 0 && <Bar dataKey="others" name="Others" stackId="lines" fill="#718096" isAnimationActive={!print} />}
              </BarChart>}
            </ResponsiveContainer></div>
            {viewMode === "custom-sql" && <div className="grid grid-cols-2 gap-x-6 gap-y-2 print:gap-x-4 print:gap-y-0.5 mt-4 print:mt-1 pt-2 print:pt-1 border-t border-slate-100">
              {share.map(line => <div key={line.name} data-sea-share-line={line.name} className="flex items-start justify-between gap-2 text-[10px] print:text-[8px] print:leading-tight border-b border-slate-50 pb-1 print:pb-0.5">
                <span className="flex items-start gap-1.5 min-w-0"><span className="w-2.5 h-2.5 print:w-2 print:h-2 rounded-full shrink-0 mt-0.5" style={{backgroundColor: line.color}} />
                  <span className="font-semibold text-slate-700 truncate print:whitespace-normal print:overflow-visible print:text-clip print:break-words" title={line.name}>{line.name}</span>
                </span>
                <span className="flex flex-wrap justify-end gap-x-1.5 shrink-0 text-right tabular-nums"><span className="font-bold text-[#2D3748]">{quantity(line.value)} TEU</span>
                  <span className="text-slate-400 font-medium">({(totals.teu > 0 ? line.value / totals.teu * 100 : 0).toFixed(1)}%)</span>
                </span>
              </div>)}
            </div>}
          </section>
          <section className={`${panel} col-span-12 lg:col-span-4 print:col-span-4`}>
            {chartHeading("Shipping Line FCL TEUs", "Shipping Line TEU Share", "Distribution")}
            <div className="relative flex items-center justify-center" style={{height: print ? 100 : 160}}><ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={share.filter(line => line.value > 0)} dataKey="value" nameKey="name" innerRadius={print ? 30 : 48} outerRadius={print ? 45 : 64} paddingAngle={3} isAnimationActive={!print}>{share.filter(line => line.value > 0).map(line => <Cell key={line.name} fill={line.color} />)}</Pie><Tooltip formatter={(value: number) => [`${quantity(value)} TEU`, "FCL TEUs"]} />
            </PieChart></ResponsiveContainer><div className="absolute text-center pointer-events-none"><span className="block text-[8px] print:text-[6px] font-bold text-slate-400 uppercase tracking-widest">Total TEUs</span><span className="text-[11px] font-extrabold text-[#2D3748]">{quantity(totals.teu)}</span></div></div>
            <div className="space-y-2 print:space-y-0 print:grid print:grid-cols-2 print:gap-0.5 print:gap-x-3 mt-3 print:mt-1">{share.map(line => <div key={line.name} className="flex items-start justify-between gap-2 text-[10px] print:text-[8px] print:leading-tight"><span className="flex items-start gap-1.5 min-w-0 font-semibold text-slate-700"><span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{backgroundColor: line.color}} />{line.name}</span><span className="font-bold text-[#2D3748] tabular-nums shrink-0">{quantity(line.value)}</span></div>)}</div>
          </section>
        </div>}
        <div className={`grid ${sections.weeklyVisual ? "grid-cols-1 lg:grid-cols-2 print:grid-cols-2" : "grid-cols-1"} ${print ? "gap-4" : "gap-6"}`} style={{breakInside: print ? "avoid" : undefined}}>
          {sections.weeklyVisual && <section className={panel}>
            {chartHeading("Departure Trend", "Daily FCL TEUs", "TEU")}
            <div style={{height: print ? 130 : 240}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{stroke: "#E2E8F0"}} /><YAxis tick={tick} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [quantity(value), "FCL TEUs"]} /><Area type="monotone" dataKey="teu" stroke="#3182CE" fill="#EBF8FF" strokeWidth={2.5} dot={{r: 3}} isAnimationActive={!print} />
            </AreaChart></ResponsiveContainer></div>
          </section>}
          <SeaVolumePanel records={rows.map(row => ({FCL_TEU_Count: row.teu, LCL_Volume: row.volume, Revenue_USD: row.revenue, ETD: row.day}))} print={print} showSummary={false} />
        </div>
        {sections.weeklyLedger && <SeaShippingTable rows={rows} print={print} showRouteBreakdown={showRouteBreakdown} />}
      </div>
      {(sections.monthlyVisual || sections.sectorDistribution || sections.monthlyLedger) && <div className="space-y-4">
        {chapter("Strategic Analysis & Consol Details")}
        {sections.monthlyVisual && <SeaRouteTable rows={rows} print={print} />}
        {sections.sectorDistribution && <SeaDestinationTable rows={rows} print={print} />}
        {sections.monthlyLedger && <SeaLedgerTable rows={rows} print={print} maxRows={maxRows} />}
      </div>}
      {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No consols match the selected period and filters.</p>}
    </>}
    {print && <footer className="border-t border-slate-200 pt-2 text-[9px] text-slate-400 flex justify-between"><span>© 2026 Dart Global Logistics · Sea Freight Consol Analysis</span><span>FCL: TEUs · LCL: m³</span></footer>}
  </div>;
}
