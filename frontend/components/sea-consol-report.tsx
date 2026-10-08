"use client";

import { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { seaConsols, seaSummary, seaTotals } from "@/lib/sea-consols";
import { freightIsoWeek } from "@/lib/operational-date";
import { wrapSeaGroupLabel } from "@/lib/sea-group-label";
import { SeaShippingTable, SeaRouteTable } from "./sea-consol-tables";
import { Skeleton } from "./ui/skeleton";
import { SeaLineLegendTable } from "./sea-line-legend-table";
import { SeaSectorReport } from "./sea-sector-report";
import { SeaTradeRouteCharts } from "./sea-trade-route-charts";
import { SeaGeographicalCharts } from "./sea-geographical-charts";

type Sections = {weeklyVisual: boolean; weeklyLedger: boolean; monthlyVisual: boolean; monthlyLedger: boolean; sectorDistribution: boolean; seaSectorDistribution?: boolean};
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
  const pieShare = [...lines.slice(0, 5).map((line, i) => ({name: line.name, value: line.teu, color: colors[i]})),
    ...(lines.length > 5 ? [{name: "Others", value: lines.slice(5).reduce((sum, line) => sum + line.teu, 0), color: "#718096"}] : [])];
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
  const { weekStackLabels, fclStackData, fclStackKeys, lclStackData, lclStackKeys } = useMemo(() => {
    const weekSet = new Map<string, string>();
    for (const r of rows) {
      if (!r.day) continue;
      const d = new Date(r.day + "T00:00:00Z");
      if (isNaN(d.getTime())) continue;
      const { year, week, sortKey } = freightIsoWeek(d, "SEA");
      if (!weekSet.has(sortKey)) {
        weekSet.set(sortKey, `W${week}'${String(year).slice(-2)}`);
      }
    }
    const sortedWeeks = Array.from(weekSet.entries()).sort(([a], [b]) => a.localeCompare(b));
    const weekLabels = sortedWeeks.map(([, lbl]) => lbl);
    const weekSortKeys = sortedWeeks.map(([k]) => k);

    const fclLines = seaSummary(rows, r => r.line)
      .filter(l => l.teu > 0)
      .sort((a, b) => b.teu - a.teu)
      .slice(0, 10);

    const fclData = fclLines.map((lineItem, idx) => {
      const row: Record<string, any> = { line: lineItem.name, total: lineItem.teu, colorIdx: idx };
      if (weekLabels.length === 0) {
        row["FCL TEUs"] = lineItem.teu;
      } else {
        weekLabels.forEach(wk => { row[wk] = 0; });
        for (const r of rows) {
          if (r.line !== lineItem.name) continue;
          if (!r.day) {
            row[weekLabels[0]] = (row[weekLabels[0]] || 0) + r.teu;
            continue;
          }
          const d = new Date(r.day + "T00:00:00Z");
          if (isNaN(d.getTime())) {
            row[weekLabels[0]] = (row[weekLabels[0]] || 0) + r.teu;
            continue;
          }
          const { sortKey } = freightIsoWeek(d, "SEA");
          const wIdx = weekSortKeys.indexOf(sortKey);
          const targetWk = wIdx >= 0 ? weekLabels[wIdx] : weekLabels[0];
          row[targetWk] = (row[targetWk] || 0) + r.teu;
        }
      }
      return row;
    });

    const lclLines = seaSummary(rows, r => r.line)
      .filter(l => l.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);

    const lclData = lclLines.map((lineItem, idx) => {
      const row: Record<string, any> = { line: lineItem.name, total: lineItem.volume, colorIdx: idx };
      if (weekLabels.length === 0) {
        row["LCL Volume"] = lineItem.volume;
      } else {
        weekLabels.forEach(wk => { row[wk] = 0; });
        for (const r of rows) {
          if (r.line !== lineItem.name) continue;
          if (!r.day) {
            row[weekLabels[0]] = (row[weekLabels[0]] || 0) + r.volume;
            continue;
          }
          const d = new Date(r.day + "T00:00:00Z");
          if (isNaN(d.getTime())) {
            row[weekLabels[0]] = (row[weekLabels[0]] || 0) + r.volume;
            continue;
          }
          const { sortKey } = freightIsoWeek(d, "SEA");
          const wIdx = weekSortKeys.indexOf(sortKey);
          const targetWk = wIdx >= 0 ? weekLabels[wIdx] : weekLabels[0];
          row[targetWk] = (row[targetWk] || 0) + r.volume;
        }
      }
      return row;
    });

    return {
      weekStackLabels: weekLabels,
      fclStackData: fclData,
      fclStackKeys: weekLabels.length > 0 ? weekLabels : ["FCL TEUs"],
      lclStackData: lclData,
      lclStackKeys: weekLabels.length > 0 ? weekLabels : ["LCL Volume"],
    };
  }, [rows]);

  const groupAxisWidth = print ? 120 : 150;
  const groupFontSize = print ? 8 : 10;
  const groupLineHeight = groupFontSize + 2;
  const groupLabels = useMemo(() => new Map([...fclStackData, ...lclStackData].map(row =>
    [row.line, wrapSeaGroupLabel(row.line, groupAxisWidth - 12, groupFontSize)])), [fclStackData, lclStackData, groupAxisWidth, groupFontSize]);
  const groupChartHeight = (data: typeof fclStackData) => Math.max(print ? 320 : 200,
    data.length * Math.max(28, ...data.map(row => (groupLabels.get(row.line)?.length ?? 1) * groupLineHeight + 8)) + 36);
  const fclChartHeight = groupChartHeight(fclStackData);
  const lclChartHeight = groupChartHeight(lclStackData);
  const groupTick = ({x = 0, y = 0, payload}: {x?: number; y?: number; payload?: {value: string}}) => {
    const name = payload?.value ?? "";
    const labelLines = groupLabels.get(name) ?? [name];
    return <g data-sea-group-tick={name} transform={`translate(${x},${y})`}>
      <text textAnchor="end" dominantBaseline="central" fill="#4A5568" fontFamily="Arial" fontWeight={600} fontSize={groupFontSize} aria-label={name}>
        {labelLines.map((line, index) => <tspan key={index} x={0} y={(index - (labelLines.length - 1) / 2) * groupLineHeight}>{line}</tspan>)}
      </text>
    </g>;
  };

  const panel = print ? "border border-slate-200 rounded-xl p-4 bg-white shadow-sm" : "saas-card p-6 bg-white";
  const tick = {fontSize: 11, fill: "#718096", fontWeight: 500};
  const badge = "text-[10px] text-[#4299E1] bg-[#EBF8FF] font-semibold px-2 py-0.5 rounded-full border border-[#BEE3F8]";
  const period = reportType === "monthly" ? "Monthly" : "Weekly";
  const chapter = (title: string) => <div className="report-heading flex flex-wrap items-center gap-2 pb-2 border-b border-[#E2E8F0]">
    <span className="h-5 w-1.5 bg-[#4299E1] rounded-full" /><h2 className="text-base print:text-sm font-bold text-[#1A202C]">{title}</h2>
    {station && <span className={badge}>{station}</span>}
  </div>;
  const chartHeading = (eyebrow: string, title: string, tag: string) => <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:mb-1 border-b border-[#F1F5F9] pb-4 print:pb-1">
    <div><p className="text-[11px] print:text-[9px] font-bold text-slate-400 uppercase tracking-widest">{eyebrow}</p><h3 className="text-sm print:text-xs font-bold text-[#1A202C] mt-0.5">{title}</h3></div><span className={badge}>{tag}</span>
  </div>;
  return <div data-sea-report className={print ? "space-y-4" : "space-y-10"}>
    {print && <header className="report-heading border-b-2 border-slate-200 pb-3 flex flex-col gap-1">
      <div className="flex items-center gap-2.5"><img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" /><h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-none">Sea Freight Consol Analysis</h1></div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-1"><p className="text-[12.5px] font-semibold text-slate-400">Dart Global Logistics · {period} Operational Performance</p><span className="text-slate-700 font-bold text-[12.5px] tabular-nums">{[dateRange, station].filter(Boolean).join(" | ")}</span></div>
    </header>}
    <div className={`sea-kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 ${print ? "gap-4" : "gap-6"}`} style={{breakInside: "avoid"}}>
      {[{name: "Revenue", value: money(totals.revenue)}, {name: "FCL TEUs", value: quantity(totals.teu)}, {name: "LCL Volume (m³)", value: quantity(totals.volume)}, {name: "No of Masters", value: String(totals.masters)}].map(card =>
        <div key={card.name} className={print ? "sea-kpi-card border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-center gap-1.5 h-[80px]" : "sea-kpi-card saas-card p-5 bg-white flex flex-col justify-center h-28 relative overflow-hidden"}>
          <p className={`${print ? "text-[11.5px]" : "text-[10px]"} uppercase font-bold text-slate-400 tracking-widest`}>{card.name}</p>
          {loading ? <Skeleton className="h-8 w-28 mt-2 bg-slate-100" /> : <h3 data-sea-master-count={card.name === "No of Masters" ? "total" : undefined} className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1">{card.value}</h3>}
        </div>)}
    </div>
    {loading ? <p role="status" className="p-8 text-sm text-slate-500">Loading consol data…</p> : <>
      {sections.weeklyVisual && <section data-sea-page="overview" className="sea-report-group space-y-4">
        {chapter(`${period} Operational Performance`)}
        <div className="sea-operational-grid grid grid-cols-12 gap-6" style={{breakInside: print ? "avoid" : undefined}}>
          <section className={`${panel} col-span-12 lg:col-span-8 print:col-span-8 flex flex-col justify-between`}>
            {chartHeading(viewMode === "standard" ? "Revenue Flow" : "Shipping Line Breakdown", viewMode === "standard" ? "Cargo Revenue Trend - Weekly" : "Top 10 Shipping Lines FCL TEU Share", viewMode === "standard" ? "Weekly aggregation" : "Day-by-Day Stack")}
            <div style={{height: print ? 220 : 320}}><ResponsiveContainer width="100%" height="100%">
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
            {viewMode === "custom-sql" && <SeaLineLegendTable entries={share} total={totals.teu} metric="FCL TEUs" unit="TEU" identifyShareRows print={print} layout="2-col" />}
          </section>
          <section data-sea-chart="Shipping Line TEU Share" className={`${panel} col-span-12 lg:col-span-4 print:col-span-4 flex flex-col justify-between [&_[data-sea-line-list]]:max-h-none`}>
            {chartHeading("Shipping Line FCL TEUs", "Shipping Line TEU Share", "Top 5 + Others")}
            <div className="relative flex items-center justify-center" style={{height: 220}}><ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={pieShare.filter(line => line.value > 0)} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3} isAnimationActive={!print}>{pieShare.filter(line => line.value > 0).map(line => <Cell key={line.name} fill={line.color} />)}</Pie><Tooltip formatter={(value: number) => [`${quantity(value)} TEU`, "FCL TEUs"]} />
            </PieChart></ResponsiveContainer><div className="absolute text-center pointer-events-none"><span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total TEUs</span><span className="text-base font-extrabold text-[#2D3748]">{quantity(totals.teu)}</span></div></div>
            <SeaLineLegendTable entries={pieShare} total={totals.teu} metric="FCL TEUs" unit="TEU" print={print} layout="1-col" />
          </section>
        </div>
      </section>}
        {sections.weeklyVisual && (
          <section data-sea-page="shipping-breakdown" className="sea-report-group space-y-4">
          {chapter("Shipping Line Breakdown")}
          <div className={`grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 ${print ? "gap-4" : "gap-6"}`} style={{breakInside: print ? "avoid" : undefined}}>
            {/* Chart 1: Shipping Line FCL TEUs (Horizontal Bar Chart) */}
            <section className={`${panel} flex flex-col justify-between`} data-sea-chart="Shipping Line FCL TEUs">
              {chartHeading("Shipping Line Breakdown", weekStackLabels.length > 1 ? "Shipping Line FCL TEUs by Week Period" : "Shipping Line FCL TEUs", `${fclStackData.length} Shipping Lines${weekStackLabels.length > 1 ? ` · ${weekStackLabels.length} Weeks` : ""}`)}
              <div style={{height: fclChartHeight}}>
                {fclStackData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4">No FCL shipping line data for the selected period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fclStackData} layout="vertical" margin={{top: 4, right: print ? 10 : 20, left: 0, bottom: 4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={true} horizontal={false} />
                      <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={v => quantity(v)} />
                      <YAxis dataKey="line" type="category" interval={0} tick={groupTick} axisLine={{stroke: "#E2E8F0"}} tickLine={false} width={groupAxisWidth} />
                      <Tooltip contentStyle={{fontSize: "10px", borderRadius: "6px", maxWidth: "240px"}} formatter={(value: any, name: any) => [`${quantity(Number(value))} TEU`, name]} />
                      {fclStackKeys.map((wkLabel, wIdx) => (
                        <Bar key={wkLabel} dataKey={wkLabel} stackId="fcl_stack" radius={wIdx === fclStackKeys.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]} isAnimationActive={!print}>
                          {fclStackData.map(row => (
                            <Cell key={`${row.line}-${wkLabel}`} fill={colors[row.colorIdx % colors.length]} fillOpacity={fclStackKeys.length > 1 ? 0.45 + (wIdx / (fclStackKeys.length - 1)) * 0.55 : 1} />
                          ))}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {fclStackData.length > 0 && <SeaLineLegendTable
                entries={fclStackData.map(row => ({name: row.line, value: row.total, color: colors[row.colorIdx % colors.length]}))}
                total={totals.teu} metric="FCL TEUs" unit="TEU" print={print} layout="2-col" />}
            </section>

            {/* Chart 2: Shipping Line LCL Volume (Horizontal Bar Chart) */}
            <section className={`${panel} flex flex-col justify-between`} data-sea-chart="Shipping Line LCL Volume">
              {chartHeading("Shipping Line Breakdown", weekStackLabels.length > 1 ? "Shipping Line LCL Volume by Week Period" : "Shipping Line LCL Volume", `${lclStackData.length} Shipping Lines${weekStackLabels.length > 1 ? ` · ${weekStackLabels.length} Weeks` : ""}`)}
              <div style={{height: lclChartHeight}}>
                {lclStackData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 text-center px-4">No LCL shipping line data for the selected period.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lclStackData} layout="vertical" margin={{top: 4, right: print ? 10 : 20, left: 0, bottom: 4}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={true} horizontal={false} />
                      <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={v => quantity(v)} />
                      <YAxis dataKey="line" type="category" interval={0} tick={groupTick} axisLine={{stroke: "#E2E8F0"}} tickLine={false} width={groupAxisWidth} />
                      <Tooltip contentStyle={{fontSize: "10px", borderRadius: "6px", maxWidth: "240px"}} formatter={(value: any, name: any) => [`${quantity(Number(value))} m³`, name]} />
                      {lclStackKeys.map((wkLabel, wIdx) => (
                        <Bar key={wkLabel} dataKey={wkLabel} stackId="lcl_stack" radius={wIdx === lclStackKeys.length - 1 ? [0, 3, 3, 0] : [0, 0, 0, 0]} isAnimationActive={!print}>
                          {lclStackData.map(row => (
                            <Cell key={`${row.line}-${wkLabel}`} fill={colors[row.colorIdx % colors.length]} fillOpacity={lclStackKeys.length > 1 ? 0.45 + (wIdx / (lclStackKeys.length - 1)) * 0.55 : 1} />
                          ))}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {lclStackData.length > 0 && <SeaLineLegendTable
                entries={lclStackData.map(row => ({name: row.line, value: row.total, color: colors[row.colorIdx % colors.length]}))}
                total={totals.volume} metric="LCL Volume" unit="m³" print={print} layout="2-col" />}
            </section>
          </div>
          </section>
        )}
      {sections.monthlyVisual && <>
        <section data-sea-page="route-distribution" className="sea-report-group space-y-4">
        {chapter("Route Distribution")}
        <SeaTradeRouteCharts rows={rows} print={print} />
        </section>
        <section data-sea-page="trade-routes" className="sea-report-group">
        <SeaRouteTable rows={rows} print={print} />
        </section>
      </>}
      {sections.seaSectorDistribution !== false && <>
        <SeaGeographicalCharts consols={rows} print={print} />
        <section data-sea-page="sectors" className="sea-report-group"><SeaSectorReport consols={rows} print={print} /></section>
      </>}
      {sections.weeklyLedger && <section data-sea-page="shipping-summary" className="sea-report-group"><SeaShippingTable rows={rows} print={print} showRouteBreakdown={showRouteBreakdown} /></section>}
      {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No consols match the selected period and filters.</p>}
    </>}
    {print && <footer className="border-t border-slate-200 pt-2 text-[9px] text-slate-400 flex justify-between"><span>© 2026 Dart Global Logistics · Sea Freight Consol Analysis</span><span>FCL: TEUs · LCL: m³</span></footer>}
  </div>;
}
