type ShippingLineEntry = {name: string; value: number; color: string};

/** Clean, modern shipping-line legend lists matching Air freight's Airlines Share & Top 10 Airlines Tonnage Share. */
export function SeaLineLegendTable({
  entries,
  total,
  metric,
  unit,
  identifyShareRows = false,
  print = false,
  layout = "2-col",
}: {
  entries: ShippingLineEntry[];
  total: number;
  metric: "FCL TEUs" | "LCL Volume";
  unit: "TEU" | "m³";
  identifyShareRows?: boolean;
  print?: boolean;
  layout?: "1-col" | "2-col";
}) {
  const isOneCol = layout === "1-col";

  const containerClasses = print
    ? isOneCol
      ? "space-y-1 mt-1 overflow-hidden flex-1 border-t border-slate-100 pt-1.5 shrink-0"
      : "grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 pr-1 border-t border-slate-100 pt-1.5 shrink-0"
    : isOneCol
      ? "space-y-2 mt-3 pr-1"
      : "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 max-h-[140px] overflow-y-auto pr-1";

  const rowClasses = print
    ? isOneCol
      ? "flex items-start justify-between text-[12.5px] print:text-[10px] text-slate-600 gap-2 border-b border-slate-50 pb-1"
      : "flex items-start justify-between text-[12.5px] print:text-[10px] border-b border-slate-50 pb-1 gap-2"
    : isOneCol
      ? "flex items-center justify-between text-xs text-slate-600 gap-2 border-b border-slate-50 pb-1"
      : "flex items-center justify-between text-[10px] text-slate-600 border-b border-slate-50 pb-1 gap-2";

  const dotClasses = print
    ? isOneCol
      ? "w-2 h-2 rounded-full flex-shrink-0 mt-1 print:mt-0.5"
      : "w-2 h-2 rounded-full shrink-0 mt-1 print:mt-0.5"
    : "w-2.5 h-2.5 rounded-full shrink-0";

  const nameClasses = print
    ? isOneCol
      ? "font-semibold text-slate-700 leading-snug truncate max-w-[140px] print:max-w-none print:whitespace-normal print:overflow-visible"
      : "font-bold text-slate-700 leading-snug truncate max-w-[130px] print:max-w-none print:whitespace-normal print:overflow-visible"
    : isOneCol
      ? "font-semibold text-slate-700 leading-snug truncate max-w-[140px]"
      : "font-semibold text-slate-700 truncate max-w-[120px]";

  const valueClasses = "font-bold text-[#2D3748] tabular-nums whitespace-nowrap";
  const pctClasses = "text-slate-400 font-medium whitespace-nowrap";

  return (
    <div className={containerClasses} data-sea-line-list={metric}>
      {entries.map((entry) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
        const valFormatted = entry.value.toLocaleString("en-US", { maximumFractionDigits: 2 });
        return (
          <div
            key={entry.name}
            data-sea-share-line={identifyShareRows ? entry.name : undefined}
            className={rowClasses}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={dotClasses}
                style={{ backgroundColor: entry.color }}
              />
              <span className={nameClasses} title={entry.name}>
                {entry.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-right">
              <div className={valueClasses}>
                {valFormatted} {unit}
              </div>
              <div className={pctClasses}>
                ({pct}%)
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
