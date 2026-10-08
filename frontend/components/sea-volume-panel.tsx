"use client";

import { useMemo } from "react";
import { Ship } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { operationalDay } from "@/lib/operational-date";

const quantity = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** LCL chart and consol-level shipping-line summary. */
export function SeaVolumePanel({ records, print = false, showSummary = true }: { records: any[]; print?: boolean; showSummary?: boolean }) {
  const { volume, lines, days } = useMemo(() => {
    const lines = new Map<string, { name: string; teu: number; volume: number; revenue: number; consols: number; groups: Set<string> }>();
    const days = new Map<string, number>();
    let volume = 0;
    for (const row of records) {
      const name = row.Shippingline || row.ShippingLine || row.Airline || "Unknown";
      const cbm = Number(row.LCL_Volume ?? row.Volume_M3 ?? row.Total_Volume_M3 ?? 0);
      volume += cbm;
      const line = lines.get(name) || { name, teu: 0, volume: 0, revenue: 0, consols: 0, groups: new Set<string>() };
      line.consols += 1;
      const group = row.ShippinglineGroup || row.shippinglineGroup || row.ShippingLineGroup;
      if (group) line.groups.add(String(group));
      line.teu += Number(row.FCL_TEU_Count ?? row.TEUCount ?? row.Total_Tonnage ?? 0);
      line.volume += cbm;
      line.revenue += Number(row.Revenue_USD ?? row.Total_Revenue ?? 0);
      lines.set(name, line);
      const day = operationalDay(row.ETD, row.Company_Code ?? row.Company, row.Origin_Country);
      if (day) days.set(day, (days.get(day) || 0) + cbm);
    }
    return { volume, lines: Array.from(lines.values()).sort((a, b) => b.volume - a.volume),
      days: Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, volume]) => ({ day, volume })) };
  }, [records]);

  return (
    <section className={print ? "border border-slate-200 rounded-xl p-2 bg-white shadow-sm sea-print-volume" : "saas-card p-6 bg-white"}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 print:mb-1 border-b border-[#F1F5F9] pb-4 print:pb-1" style={print ? { breakInside: "avoid", breakAfter: "avoid" } : undefined}>
        <div>
          <p className="text-[11px] print:text-[9px] font-bold text-slate-400 uppercase tracking-widest">Departure Trend</p>
          <h3 className="text-sm print:text-xs font-bold text-[#1A202C] mt-0.5">LCL Volume</h3>
        </div>
        <span className="text-[10px] text-[#4299E1] bg-[#EBF8FF] font-semibold px-2 py-0.5 rounded-full border border-[#BEE3F8]">{quantity(volume)} m³</span>
      </div>
      {days.length > 0 && <div style={{ height: print ? 130 : 240, breakInside: print ? "avoid" : undefined }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days}><CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: print ? 9 : 10, fill: "#718096" }} tickLine={false} axisLine={{stroke: "#E2E8F0"}} /><YAxis tick={{ fontSize: print ? 9 : 10, fill: "#718096" }} tickLine={false} axisLine={false} /><Tooltip formatter={(value: number) => [`${quantity(value)} m³`, "LCL Volume"]} /><Bar dataKey="volume" name="LCL Volume (m³)" fill="#4299E1" radius={[3, 3, 0, 0]} isAnimationActive={!print} /></BarChart>
        </ResponsiveContainer>
      </div>}
      {showSummary && <div className="overflow-x-auto">
        <h2 className="report-heading text-sm font-bold text-slate-800 mb-2">Shipping Line Consol Summary</h2>
        <table className="w-full text-xs text-left">
          <thead className="text-slate-500 border-b"><tr><th className="py-2"><span className="flex items-center gap-1"><Ship className="w-3 h-3" />Shipping Line</span></th><th className="py-2">Group</th><th className="py-2 text-right">No. of Consols</th><th className="py-2 text-right">FCL (TEU)</th><th className="py-2 text-right">LCL (m³)</th><th className="py-2 text-right">Revenue (USD)</th></tr></thead>
          <tbody>{lines.map(line => <tr key={line.name} className="border-b border-slate-100"><td className="py-2 font-semibold">{line.name}</td><td className="py-2 text-slate-500">{Array.from(line.groups).join(", ") || "—"}</td><td className="py-2 text-right">{line.consols}</td><td className="py-2 text-right tabular-nums">{quantity(line.teu)}</td><td className="py-2 text-right tabular-nums text-teal-700">{quantity(line.volume)}</td><td className="py-2 text-right tabular-nums">${quantity(line.revenue)}</td></tr>)}</tbody>
        </table>
        {lines.length === 0 && <p className="py-4 text-xs text-slate-400 text-center">No sea freight data for the selected period.</p>}
      </div>}
    </section>
  );
}
