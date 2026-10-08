"use client";

import {ComposedChart, Bar, Line, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from "recharts";
import {SeaConsol, seaTotals} from "@/lib/sea-consols";
import {seaGeographicalContribution} from "@/lib/sea-sectors";

const quantity = (value: number) => value.toLocaleString("en-US", {maximumFractionDigits: 2});

export function SeaGeographicalCharts({consols, print = false}: {consols: SeaConsol[]; print?: boolean}) {
  const regions = seaGeographicalContribution(consols);
  const totals = seaTotals(consols);
  const metrics = [{key: "teu", cargo: "FCL", label: "FCL TEUs", unit: "TEU", contribution: "teuContribution"},
    {key: "volume", cargo: "LCL", label: "LCL Volume", unit: "m³", contribution: "volumeContribution"}] as const;
  return <>{metrics.map(metric => {
    const title = `Sea Exports - Geographical Tonnage Contribution (${metric.cargo})`;
    const data = regions.map(region => ({name: region.name, value: region[metric.key], contribution: region[metric.contribution]}));
    // Quantity / total and contribution / 100 must share the same plot height.
    const quantityMaximum = totals[metric.key] > 0 ? totals[metric.key] : 1;
    return <section key={metric.key} data-sea-page={`geographical-${metric.cargo.toLowerCase()}`}
      data-sea-geographical-metric={metric.key} className="sea-report-group space-y-4">
      <div className="report-heading flex items-center gap-2 pb-2 border-b border-slate-200">
        <span className="h-5 w-1.5 bg-violet-600 rounded-full" />
        <h2 className="text-base print:text-sm font-bold text-slate-800">Geographical Contribution - {metric.cargo}</h2>
      </div>
      <div className={print ? "border border-slate-200 rounded-xl p-4 bg-white shadow-sm" : "saas-card p-6 bg-white"}
        style={{breakInside: "avoid"}}>
        <div className="report-heading flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div><p className="text-[11px] print:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Geographical contribution</p>
            <h3 className="text-lg print:text-sm font-bold text-slate-800 mt-0.5">{title}</h3></div>
          <span className="text-xs print:text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-3 py-1">
            Total: {quantity(totals[metric.key])} {metric.unit}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6 mb-3 text-xs print:text-[10px] text-slate-500">
          <span className="flex items-center gap-2"><span className="w-3 h-3 bg-[#3182CE] rounded-sm" />{metric.label} ({metric.unit})</span>
          <span className="flex items-center gap-2"><span className="w-5 h-0.5 bg-[#E53E3E]" />Contribution (%)</span>
        </div>
        {totals[metric.key] > 0 ? <div className="overflow-x-auto">
          <div className="min-w-[720px] print:min-w-0 w-full" style={{height: print ? 410 : 320}}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{top: 30, right: 12, left: 8, bottom: 15}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{fontSize: 11, fill: "#718096", fontWeight: 600}}
                  tickLine={false} axisLine={{stroke: "#E2E8F0"}} height={40} />
                <YAxis yAxisId="quantity" tick={{fontSize: 11, fill: "#718096"}} tickLine={false} axisLine={false}
                  domain={[0, quantityMaximum]} ticks={[0, 0.25, 0.5, 0.75, 1].map(share => share * quantityMaximum)}
                  allowDataOverflow tickFormatter={value => `${quantity(value)} ${metric.unit}`} width={85} />
                <YAxis yAxisId="contribution" orientation="right" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]}
                  tick={{fontSize: 11, fill: "#E53E3E"}} tickLine={false} axisLine={false} tickFormatter={value => `${value}%`} width={45} />
                <Tooltip contentStyle={{fontSize: 12, borderRadius: 8}}
                  formatter={(value: number, name: string) => name === "Contribution (%)"
                    ? [`${value.toFixed(1)}%`, name] : [`${quantity(value)} ${metric.unit}`, name]} />
                <Bar yAxisId="quantity" dataKey="value" name={metric.label} fill="#3182CE" radius={[4, 4, 0, 0]}
                  maxBarSize={50} isAnimationActive={!print} />
                <Line yAxisId="contribution" type="monotone" dataKey="contribution" name="Contribution (%)"
                  stroke="#E53E3E" strokeWidth={3} dot={{fill: "#E53E3E", r: 4}} activeDot={{r: 6}} isAnimationActive={!print}>
                  <LabelList dataKey="contribution" position="top" formatter={(value: number) => `${value.toFixed(1)}%`}
                    style={{fontSize: 11, fill: "#E53E3E", fontWeight: 700}} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div> : <p className="p-12 text-center text-sm text-slate-400">No {metric.cargo} cargo for the selected period.</p>}
        <p className="mt-3 text-xs print:text-[10px] text-slate-500">Destination sectors · Contribution is each sector's share of total {metric.label.toLowerCase()}.
          Other Sectors includes the remaining regions and unmapped destinations.</p>
      </div>
    </section>;
  })}</>;
}
