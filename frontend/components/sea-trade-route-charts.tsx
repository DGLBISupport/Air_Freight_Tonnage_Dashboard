"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { SeaConsol, seaRouteShares, seaTotals } from "@/lib/sea-consols";

const colors = ["#4299E1", "#319795", "#ED64A6", "#5A67D8", "#81E6D9"];
const quantity = (value: number) => value.toLocaleString("en-US", {maximumFractionDigits: 2});

export function SeaTradeRouteCharts({rows, print = false}: {rows: SeaConsol[]; print?: boolean}) {
  const totals = seaTotals(rows);
  const metrics = [{key: "teu", title: "Trade Routes by TEU (Top 5)", label: "FCL TEUs", unit: "TEU"},
    {key: "volume", title: "Trade Routes by Volume (Top 5)", label: "LCL Volume", unit: "m³"}] as const;
  return <div data-sea-trade-route-charts className="space-y-4">
    {metrics.map(metric => {
      const entries = seaRouteShares(rows, metric.key);
      const total = totals[metric.key];
      const color = (index: number) => entries[index].others ? "#718096" : colors[index];
      return <section key={metric.key} data-sea-route-metric={metric.key} data-sea-chart={metric.title}
        className={print ? "border border-slate-200 rounded-xl p-3 bg-white shadow-sm" : "saas-card p-6 bg-white"}
        style={{breakInside: "avoid"}}>
        <div className="report-heading flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
          <div><p className="text-[11px] print:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Route Distribution · {metric.label}</p>
            <h3 className="text-sm print:text-xs font-bold text-slate-800 mt-0.5">{metric.title}</h3></div>
          <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Top 5 + Others</span>
        </div>
        {entries.length ? <div className="flex flex-col md:flex-row print:flex-row items-center gap-4 print:gap-6">
          <div className="relative w-full md:w-1/3 print:w-1/3 shrink-0" style={{height: print ? 220 : 240}}>
            <ResponsiveContainer width="100%" height="100%"><PieChart>
              <Pie data={entries} dataKey="value" nameKey="name" innerRadius={print ? 58 : 68} outerRadius={print ? 90 : 102}
                paddingAngle={3} isAnimationActive={!print}>
                {entries.map((entry, index) => <Cell key={entry.key} fill={color(index)} />)}
              </Pie><Tooltip formatter={(value: number) => [`${quantity(value)} ${metric.unit} (${(value / total * 100).toFixed(1)}%)`, metric.label]} />
            </PieChart></ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[9px] print:text-[8px] font-bold text-slate-400 uppercase">Total {metric.label}</span>
              <span className="text-sm print:text-xs font-extrabold text-slate-800 tabular-nums mt-1">{quantity(total)} {metric.unit}</span>
            </div>
          </div>
          <ul aria-label={metric.title} className="w-full min-w-0">
            {entries.map((entry, index) => <li key={entry.key} data-sea-route-share={entry.others ? "Others" : entry.key}
              className="flex items-center justify-between gap-4 py-2 border-b border-slate-100" style={{breakInside: "avoid"}}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: color(index)}} />
                <div className="min-w-0">
                  <p data-sea-route-cities className="text-xs print:text-[11px] leading-tight font-bold text-slate-800 [overflow-wrap:anywhere]">{entry.cityRoute}</p>
                  {entry.countryRoute && <p data-sea-route-countries className="text-[10px] print:text-[9px] leading-tight text-slate-400 mt-0.5 [overflow-wrap:anywhere]">{entry.countryRoute}</p>}
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums whitespace-nowrap">
                <p data-sea-route-value className="text-xs print:text-[11px] leading-tight font-bold text-slate-800">{quantity(entry.value)} {metric.unit}</p>
                <p data-sea-route-percentage className="text-[10px] print:text-[9px] leading-tight text-slate-400 mt-0.5">{(entry.value / total * 100).toFixed(1)}%</p>
              </div>
            </li>)}
          </ul>
        </div> : <p className="p-6 text-center text-xs text-slate-400">No {metric.label} route data for the selected period.</p>}
      </section>;
    })}
  </div>;
}
