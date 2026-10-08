import {SeaConsol} from "@/lib/sea-consols";
import {seaSectorSummary, seaSectors, SeaSectorRow, formatSeaSectorQuantity} from "@/lib/sea-sectors";

export function SeaSectorReport({consols, print = false}: {consols: SeaConsol[]; print?: boolean}) {
  const summary = seaSectorSummary(consols);
  const number = formatSeaSectorQuantity;
  const metrics = [{key: "teu", title: "FCL TEUs", unit: "TEUs", tint: "bg-blue-50/50", color: "text-blue-700"},
    {key: "volume", title: "LCL Volume", unit: "m³", tint: "bg-teal-50/50", color: "text-teal-700"}] as const;
  return <section data-sea-sector-report className="space-y-4">
    <div className="report-heading border-b border-slate-200 pb-2">
      <h2 className="text-base print:text-sm font-bold text-slate-800">TOP 20 SHIPPING LINES &amp; Total FCL / LCL - Sector wise (TEUs and Volume)</h2>
      <p className="text-xs print:text-[9px] text-slate-500 mt-1">Destination sectors · Ranked by FCL TEUs, then LCL volume · {summary.lineCount} shipping line groups. Remaining groups are included in Others.</p>
    </div>
    {metrics.map((metric, metricIndex) => {
      const rowCells = (row: SeaSectorRow, rank?: number, total = false) => <tr key={total ? "grand-total" : row.name}
        data-sea-sector-row={total ? "total" : row.others ? "others" : "line"}
        style={{breakAfter: !total && (row.others || rank === summary.rows.length) ? "avoid" : undefined}}
        className={total ? "bg-slate-100 border-t-2 border-slate-300 font-bold" : row.others ? "bg-slate-50 font-semibold" : "even:bg-slate-50/40"}>
        <td className="px-1 py-2 print:py-1 text-slate-400 text-center">{rank}</td>
        <th scope="row" className="px-2 py-2 print:px-1 print:py-1 text-left font-semibold [overflow-wrap:anywhere]">{row.name}</th>
        <td className={`px-1 py-2 print:py-1 text-right font-bold tabular-nums ${metric.tint} ${metric.color}`}>{number(row[metric.key])}</td>
        {row.sectors.map((sector, index) => <td key={index} className="px-1 py-2 print:py-1 text-right tabular-nums">{number(sector[metric.key])}</td>)}
      </tr>;
      return <div key={metric.key} data-sea-sector-metric={metric.key} className="border border-slate-200 rounded-xl bg-white p-3 shadow-sm" style={print && metricIndex > 0 ? {breakBefore: "page"} : undefined}>
        <h3 className={`report-heading text-sm print:text-xs font-bold mb-2 ${metric.color}`}>{metric.title} - Sector wise ({metric.unit})</h3>
        <div className="overflow-x-auto">
          <table aria-label={`Top 20 shipping lines sector-wise ${metric.title}`} className="w-full min-w-[1100px] print:min-w-0 table-fixed text-[11px] print:text-[10px] leading-snug border-collapse text-slate-700">
            <colgroup><col className="w-[2.5%]" /><col className="w-[14%]" /><col className="w-[7%]" />{seaSectors.map(sector => <col key={sector.key} />)}</colgroup>
            <thead className="bg-slate-50 text-[10px] print:text-[9px] text-slate-500 uppercase">
              <tr className="border-b border-slate-200">
                <th rowSpan={2} className="px-1 py-2 text-center">SL</th><th rowSpan={2} className="px-2 py-2 text-left">Shipping Line Group</th>
                <th rowSpan={2} className={`px-1 py-2 text-right ${metric.tint} ${metric.color}`}>Total ({metric.unit})</th>
                <th colSpan={seaSectors.length} className="py-1 text-center font-bold text-slate-700">Geographical Sector {metric.title} ({metric.unit})</th>
              </tr>
              <tr className="border-b border-slate-200">{seaSectors.map(sector => <th key={sector.key} className="px-1 py-2 print:py-1 text-right break-words">{sector.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">{summary.rows.map((row, index) => rowCells(row, row.others ? undefined : index + 1))}
              {!summary.rows.length && <tr><td colSpan={17} className="p-3 text-center text-slate-500">No consol records for the selected period.</td></tr>}
            </tbody>
            <tfoot style={{display: "table-row-group", breakBefore: "avoid", breakInside: "avoid"}}>{rowCells(summary.total, undefined, true)}</tfoot>
          </table>
        </div>
      </div>;
    })}
    <p className="text-[10px] print:text-[8px] text-slate-500">FCL is measured in TEUs; LCL is measured in cubic metres. Unmapped destination countries are included in the Others sector.</p>
  </section>;
}
