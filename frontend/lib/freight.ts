export type TransportMode = "AIR" | "SEA";

/** Labels for shared legacy air charts. Sea quantities are TEUs, never kg. */
export function freightText(text: string, mode: TransportMode): string {
  if (mode === "AIR") return text;
  return text
    .replace(/DGL Tonnage Analysis/g, "DGL Sea Freight Analysis")
    .replace(/Tonnage Dashboard/g, "Sea Freight Dashboard")
    .replace(/Master[_ ]Airway[_ ]Bill/gi, "Master Bill of Lading")
    .replace(/Air Freight/g, "Sea Freight")
    .replace(/Air Exports/g, "Sea Exports")
    .replace(/AIR EXPORTS/g, "SEA EXPORTS")
    .replace(/AIR CARRIERS/g, "SHIPPING LINE GROUPS")
    .replace(/Airline Carrier/g, "Shipping Line Group")
    .replace(/Airlines/g, "Shipping Line Groups")
    .replace(/Airline/g, "Shipping Line Group")
    .replace(/airlines/g, "shipping line groups")
    .replace(/airline/g, "shipping line group")
    .replace(/chargeable tonnage/gi, "FCL TEUs")
    .replace(/Total Tonnage/g, "FCL TEUs")
    .replace(/TONNAGE/g, "FCL TEUs")
    .replace(/Tonnage/g, "FCL TEUs")
    .replace(/tonnage/g, "TEUs")
    .replace(/\bweights?\b/gi, "TEUs")
    .replace(/\bkg\b/g, "TEU")
    .replace(/Rounded to nearest Ton/g, "TEUs shown to three decimal places")
    .replace(/\bTons?\b/g, "TEU");
}

/** Retain station/branch filters while returning only consol-level Sea fields. */
export function buildFreightQuery(sql: string, mode: TransportMode): string {
  if (mode === "AIR") return sql;
  let seaSql = sql
    .replace(/vt\.AirlineName1 AS Airline,/g, "vt.ShippingLineGroup AS ShippinglineGroup,")
    .replace(/vt\.AirlineName1\b/g, "vt.ShippingLineGroup")
    .replace(/Master_Airway_Bill/g, "Master_Bill_of_Lading")
    .replace(/vt\.Air_ChargebleWeight/g, "vt.FCLTEU")
    .replace(/vt\.Air_ActualWeight/g, "vt.LCLVolume")
    .replace(/Tonnage_Chargeable/g, "FCL_TEU_Count")
    .replace(/Tonnage_Actual/g, "LCL_Volume")
    .replace(/TransportMode = 'AIR'/g, "TransportMode = 'SEA'");
  // Sea quantities belong to the consol; remove customer/branch output grouping
  // while keeping the selected branch filter in WHERE.
  seaSql = seaSql
    .replace(/^\s*vs\.(Branch|BranchName|BranchCity|Consignor|ConsignorName|Consignee|ConsigneeName|AgentCode|AgentName) AS \w+,\s*$/gm, "")
    .replace(/^\s*COUNT\(DISTINCT vs\.ShipmentNumber\) AS Total_Shipments,\s*$/gm, "")
    .replace(/^\s*ROUND\(SUM\(vs\.(?:Cost_USD|Profit_USD)\)[^\n]*\n/gm, "")
    .replace(/^\s*ROUND\(SUM\(vs\.Profit_USD\) \/ NULLIF[^\n]*\n/gm, "")
    .replace(/ORDER BY vt\.ETD DESC, vs\.Branch,/g, "ORDER BY vt.ETD DESC,")
    .replace(/,\s*vs\.(Branch|BranchName|BranchCity|Consignor|ConsignorName|Consignee|ConsigneeName|AgentCode|AgentName)(?=\s*(?:,|\nORDER BY))/g, "");
  return seaSql.replace(/,\s*FROM\b/g, "\nFROM");
}

export function formatFreightQuantity(value: number | null | undefined, mode: TransportMode): string {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: mode === "SEA" ? 2 : 0 });
}
