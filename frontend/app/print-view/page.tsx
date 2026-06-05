"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Plane, Globe, CheckSquare, Square, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "http://localhost:8000";

const formatCurrency = (val: number | null | undefined) => {
  if (val == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(val);
};

const formatNumber = (val: number | null | undefined) => {
  if (val == null) return "0";
  return Number(val).toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const PIE_COLORS = ["#4299E1", "#81E6D9", "#CBD5E0", "#5A67D8", "#ED64A6"];

// Parse weekly trend data dynamically from custom SQL result rows
const parseWeeklyData = (rows: any[]) => {
  const hasWeek = rows.some((r) => r.Week !== undefined || r.week !== undefined || r.Week_Number !== undefined);
  if (hasWeek) {
    const weeklyMap: { [key: string]: any } = {};
    rows.forEach((r) => {
      const yr = r.Year ?? r.year ?? 2025;
      const wk = r.Week ?? r.week ?? r.Week_Number ?? 1;
      const key = `${yr}-W${wk}`;
      if (!weeklyMap[key]) {
        weeklyMap[key] = {
          Year: yr,
          Week: wk,
          Total_Tonnage: 0,
          Total_Revenue: 0,
          Total_Shipments: 0,
          week_label: `W${wk} '${String(yr).slice(-2)}`,
        };
      }
      weeklyMap[key].Total_Tonnage += Number(r.Total_Tonnage ?? r.Tonnage_Chargeable ?? r.Air_ChargebleWeight ?? r.tonnage ?? 0);
      weeklyMap[key].Total_Revenue += Number(r.Total_Revenue ?? r.Revenue_USD ?? r.revenue ?? 0);
      weeklyMap[key].Total_Shipments += Number(r.Total_Shipments ?? r.ShipmentCount ?? r.Shipments ?? 1);
    });
    return Object.values(weeklyMap).sort((a: any, b: any) => a.Year !== b.Year ? a.Year - b.Year : a.Week - b.Week);
  }
  
  const hasEtd = rows.some((r) => r.ETD || r.etd || r.etd_date);
  if (hasEtd) {
    const weeklyMap: { [key: string]: any } = {};
    rows.forEach((r) => {
      const etdVal = r.ETD ?? r.etd ?? r.etd_date;
      if (!etdVal) return;
      const date = new Date(etdVal);
      if (isNaN(date.getTime())) return;
      
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      const weekStr = monday.toISOString().slice(0, 10);
      
      const tempDate = new Date(date.valueOf());
      tempDate.setHours(0, 0, 0, 0);
      tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
      const week1 = new Date(tempDate.getFullYear(), 0, 4);
      const weekNum = 1 + Math.round(((tempDate.valueOf() - week1.valueOf()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      
      const key = weekStr;
      if (!weeklyMap[key]) {
        weeklyMap[key] = {
          Year: date.getFullYear(),
          Week: weekNum,
          Week_Start: weekStr,
          Total_Tonnage: 0,
          Total_Revenue: 0,
          Total_Shipments: 0,
          week_label: `W${weekNum} '${String(date.getFullYear()).slice(-2)}`,
        };
      }
      weeklyMap[key].Total_Tonnage += Number(r.Total_Tonnage ?? r.Tonnage_Chargeable ?? r.Air_ChargebleWeight ?? r.tonnage ?? 0);
      weeklyMap[key].Total_Revenue += Number(r.Total_Revenue ?? r.Revenue_USD ?? r.revenue ?? 0);
      weeklyMap[key].Total_Shipments += Number(r.Total_Shipments ?? r.ShipmentCount ?? r.Shipments ?? 1);
    });
    return Object.values(weeklyMap).sort((a: any, b: any) => a.Week_Start.localeCompare(b.Week_Start));
  }
  
  return [];
};

// Parse monthly trend data dynamically from custom SQL result rows
const parseMonthlyData = (rows: any[]) => {
  const monthsNames: { [key: number]: string } = {
    1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
    7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
  };

  const hasMonth = rows.some((r) => r.Month !== undefined || r.month !== undefined || r.Month_Number !== undefined);
  if (hasMonth) {
    const monthlyMap: { [key: string]: any } = {};
    rows.forEach((r) => {
      const yr = r.Year ?? r.year ?? 2025;
      const mo = r.Month ?? r.month ?? r.Month_Number ?? 1;
      const key = `${yr}-${mo}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          Year: yr,
          Month: mo,
          Total_Tonnage: 0,
          Total_Revenue: 0,
          Total_Shipments: 0,
          month_label: `${monthsNames[mo]} '${String(yr).slice(-2)}`,
        };
      }
      monthlyMap[key].Total_Tonnage += Number(r.Total_Tonnage ?? r.Tonnage_Chargeable ?? r.Air_ChargebleWeight ?? r.tonnage ?? 0);
      monthlyMap[key].Total_Revenue += Number(r.Total_Revenue ?? r.Revenue_USD ?? r.revenue ?? 0);
      monthlyMap[key].Total_Shipments += Number(r.Total_Shipments ?? r.ShipmentCount ?? r.Shipments ?? 1);
    });
    return Object.values(monthlyMap).sort((a: any, b: any) => a.Year !== b.Year ? a.Year - b.Year : a.Month - b.Month);
  }
  
  const hasEtd = rows.some((r) => r.ETD || r.etd || r.etd_date);
  if (hasEtd) {
    const monthlyMap: { [key: string]: any } = {};
    rows.forEach((r) => {
      const etdVal = r.ETD ?? r.etd ?? r.etd_date;
      if (!etdVal) return;
      const date = new Date(etdVal);
      if (isNaN(date.getTime())) return;
      const yr = date.getFullYear();
      const mo = date.getMonth() + 1;
      const key = `${yr}-${mo}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          Year: yr,
          Month: mo,
          Total_Tonnage: 0,
          Total_Revenue: 0,
          Total_Shipments: 0,
          month_label: `${monthsNames[mo]} '${String(yr).slice(-2)}`,
        };
      }
      monthlyMap[key].Total_Tonnage += Number(r.Total_Tonnage ?? r.Tonnage_Chargeable ?? r.Air_ChargebleWeight ?? r.tonnage ?? 0);
      monthlyMap[key].Total_Revenue += Number(r.Total_Revenue ?? r.Revenue_USD ?? r.revenue ?? 0);
      monthlyMap[key].Total_Shipments += Number(r.Total_Shipments ?? r.ShipmentCount ?? r.Shipments ?? 1);
    });
    return Object.values(monthlyMap).sort((a: any, b: any) => a.Year !== b.Year ? a.Year - b.Year : a.Month - b.Month);
  }
  
  return [];
};

export default function PrintView() {
  const searchParams = useSearchParams();
  const startDate = searchParams?.get("start_date") || "2025-06-01";
  const endDate = searchParams?.get("end_date") || "2026-05-21";
  const country = searchParams?.get("country") || "";
  const airline = searchParams?.get("airline") || "";
  const companyCode = searchParams?.get("company_code") || "";
  const originCity = searchParams?.get("origin_city") || "";
  const destinationCountry = searchParams?.get("destination_country") || "";
  const destinationCity = searchParams?.get("destination_city") || "";
  const branch = searchParams?.get("branch") || "";
  const maxDataRows = parseInt(searchParams?.get("max_data_rows") || "100");

  const [data, setData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Section selection state - read from URL params or default to all true
  const [selectedSections, setSelectedSections] = useState({
    weeklyVisual: searchParams?.get("include_weekly_visual") !== "false",
    weeklyLedger: searchParams?.get("include_weekly_ledger") !== "false",
    monthlyVisual: searchParams?.get("include_monthly_visual") !== "false",
    monthlyLedger: searchParams?.get("include_monthly_ledger") !== "false",
  });

  // Toggle section selection
  const toggleSection = (section: keyof typeof selectedSections) => {
    setSelectedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Select all sections
  const selectAllSections = () => {
    setSelectedSections({
      weeklyVisual: true,
      weeklyLedger: true,
      monthlyVisual: true,
      monthlyLedger: true,
    });
  };

  // Deselect all sections
  const deselectAllSections = () => {
    setSelectedSections({
      weeklyVisual: false,
      weeklyLedger: false,
      monthlyVisual: false,
      monthlyLedger: false,
    });
  };

  const fetchPrintData = useCallback(async () => {
    setLoading(true);
    try {
      const mode = searchParams?.get("mode");
      const customSql = searchParams?.get("custom_sql");

      if (mode === "custom-sql" && customSql) {
        const res = await fetch(`${API}/api/custom-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: customSql }),
        });
        const d = await res.json();
        if (res.status === 200 && d.status === "success") {
          const records = d.data;
          setData(records);

          // Dynamic client-side aggregates
          const totalTonnage = records.reduce((sum: number, r: any) => sum + Number(r.Total_Tonnage ?? r.Tonnage_Chargeable ?? r.Air_ChargebleWeight ?? r.tonnage ?? 0), 0);
          const totalRevenue = records.reduce((sum: number, r: any) => sum + Number(r.Total_Revenue ?? r.Revenue_USD ?? r.revenue ?? 0), 0);
          const totalCost = records.reduce((sum: number, r: any) => sum + Number(r.Total_Cost ?? r.Cost_USD ?? r.cost ?? 0), 0);
          const totalProfit = records.reduce((sum: number, r: any) => sum + Number(r.Total_Profit ?? r.Profit_USD ?? r.profit ?? 0), 0);
          const gpMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
          const totalShipments = records.reduce((sum: number, r: any) => sum + Number(r.Total_Shipments ?? r.ShipmentCount ?? r.Shipments ?? 1), 0);
          
          const airlinesSet = new Set(records.map((r: any) => r.Airline ?? r.AirlineName1 ?? r.carrier).filter(Boolean));
          const countriesSet = new Set(records.map((r: any) => r.Origin_Country ?? r.ConLoadPortCountryName ?? r.country).filter(Boolean));
          
          setKpi({
            Total_Tonnage: totalTonnage,
            Total_Revenue: totalRevenue,
            Total_Cost: totalCost,
            Total_Profit: totalProfit,
            GP_Margin: gpMargin,
            Total_Shipments: totalShipments,
            Unique_Airlines: airlinesSet.size,
            Unique_Countries: countriesSet.size,
          });

          // Dynamic Date Groupings using same logic
          setWeeklyData(parseWeeklyData(records));
          setMonthlyData(parseMonthlyData(records));
        }
      } else {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (country) params.append("country", country);
        if (airline) params.append("airline", airline);
        if (companyCode) params.append("company_code", companyCode);
        if (originCity) params.append("origin_city", originCity);
        if (destinationCountry) params.append("destination_country", destinationCountry);
        if (destinationCity) params.append("destination_city", destinationCity);
        if (branch) params.append("branch", branch);

        const [dataRes, weekRes, monthRes, kpiRes] = await Promise.all([
          fetch(`${API}/api/data?${params}`),
          fetch(`${API}/api/weekly?${params}`),
          fetch(`${API}/api/monthly?${params}`),
          fetch(`${API}/api/kpi?${params}`),
        ]);
        const [d, w, m, k] = await Promise.all([dataRes.json(), weekRes.json(), monthRes.json(), kpiRes.json()]);
        if (d.status === "success") setData(d.data);
        if (w.status === "success") setWeeklyData(w.data);
        if (m.status === "success") setMonthlyData(m.data);
        if (k.status === "success") setKpi(k.data);
      }
    } catch (e) {
      console.error("Failed to load print preview", e);
    }
    setLoading(false);
  }, [startDate, endDate, country, airline, companyCode, originCity, destinationCountry, destinationCity, branch, searchParams]);

  useEffect(() => {
    fetchPrintData();
  }, [fetchPrintData]);

  // Update selected sections when URL parameters change (from parent preview modal)
  useEffect(() => {
    setSelectedSections({
      weeklyVisual: searchParams?.get("include_weekly_visual") !== "false",
      weeklyLedger: searchParams?.get("include_weekly_ledger") !== "false",
      monthlyVisual: searchParams?.get("include_monthly_visual") !== "false",
      monthlyLedger: searchParams?.get("include_monthly_ledger") !== "false",
    });
  }, [searchParams?.get("include_weekly_visual"), searchParams?.get("include_weekly_ledger"), searchParams?.get("include_monthly_visual"), searchParams?.get("include_monthly_ledger")]);

  // Process data for Doughnut distribution (top 4 countries + others)
  const getDoughnutData = () => {
    const grouped = data.reduce((acc: any, curr: any) => {
      const countryName = curr.Origin_Country || "Unknown Hub";
      acc[countryName] = (acc[countryName] || 0) + (curr.Total_Revenue || 0);
      return acc;
    }, {});
    
    const sorted = Object.entries(grouped)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 4) return sorted;
    const top4 = sorted.slice(0, 4);
    const othersVal = sorted.slice(4).reduce((sum, item) => sum + item.value, 0);
    return [...top4, { name: "Others", value: othersVal }];
  };

  const doughnutData = getDoughnutData();

  const selectedAirlines = airline ? airline.split(",").map((a: string) => a.trim()) : [];

  // Process data for Airline Carrier wise tonnage (Top 10 overall, or highlight selected ones)
  const getAirlineWiseData = () => {
    const aggregated = data.reduce((acc: any, curr: any) => {
      const carrier = curr.Airline || "Unknown Carrier";
      acc[carrier] = (acc[carrier] || 0) + (curr.Total_Tonnage || 0);
      return acc;
    }, {});

    const sorted = Object.entries(aggregated)
      .map(([name, tonnage]) => ({
        name,
        tonnage: tonnage as number,
        isSelected: selectedAirlines.includes(name)
      }))
      .sort((a, b) => b.tonnage - a.tonnage);

    return sorted.slice(0, 10);
  };

  const airlineWiseData = getAirlineWiseData();

  // Process data for stacked class breakdown
  const stackedWeightBars = weeklyData.slice(-12).map((item) => {
    const total = item.Total_Shipments ?? 0;
    const heavyClass = Math.round(total * 0.72);
    const lightClass = total - heavyClass;
    return {
      week: item.week_label || `W${item.Week}`,
      Converted: heavyClass,
      Cancelled: lightClass
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Preparing A4 Landscape Print View...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center bg-slate-150 py-4 gap-8 print:block print:p-0 print:gap-0 print:bg-transparent select-none">
      {/* Hidden indicator for PDF capture readiness */}
      <div id="pdf-ready" style={{display: 'none'}}>ready</div>
      
      {/* ── SECTIONS STATUS INDICATOR ── */}
      <div className="print:hidden w-full max-w-[1123px] bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm p-3 mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-xs font-semibold text-blue-900">
              PDF Sections: 
              <span className="ml-2">
                {selectedSections.weeklyVisual && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold mr-1 inline-block">Weekly Charts</span>}
                {selectedSections.weeklyLedger && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold mr-1 inline-block">Weekly Tables</span>}
                {selectedSections.monthlyVisual && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold mr-1 inline-block">Monthly Charts</span>}
                {selectedSections.monthlyLedger && <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold mr-1 inline-block">Monthly Tables</span>}
              </span>
            </p>
          </div>
          <span className="text-[10px] font-bold text-blue-600 bg-white px-2.5 py-1 rounded-full border border-blue-200">
            {Object.values(selectedSections).filter(Boolean).length} / 4 Sections
          </span>
        </div>
      </div>
      
      {/* ── SECTION SELECTOR (Only visible on screen, hidden when printing) ── */}
      <div className="print:hidden w-full max-w-[1123px] bg-white border border-slate-200 rounded-lg shadow-md p-4 mx-auto">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                Customize PDF Sections
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Select which sections to include in your PDF export and preview</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllSections}
                className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 font-semibold transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAllSections}
                className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md hover:bg-slate-200 font-semibold transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Section 1: Weekly Visual */}
            <button
              onClick={() => toggleSection('weeklyVisual')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedSections.weeklyVisual
                  ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {selectedSections.weeklyVisual ? (
                  <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-sm text-slate-800">Weekly Dashboard</p>
                  <p className="text-xs text-slate-500 mt-0.5">Charts & KPIs</p>
                </div>
              </div>
            </button>

            {/* Section 2: Weekly Ledger */}
            <button
              onClick={() => toggleSection('weeklyLedger')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedSections.weeklyLedger
                  ? 'border-blue-400 bg-blue-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {selectedSections.weeklyLedger ? (
                  <CheckSquare className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-sm text-slate-800">Weekly Ledger</p>
                  <p className="text-xs text-slate-500 mt-0.5">Carrier details</p>
                </div>
              </div>
            </button>

            {/* Section 3: Monthly Visual */}
            <button
              onClick={() => toggleSection('monthlyVisual')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedSections.monthlyVisual
                  ? 'border-teal-400 bg-teal-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {selectedSections.monthlyVisual ? (
                  <CheckSquare className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-sm text-slate-800">Monthly Dashboard</p>
                  <p className="text-xs text-slate-500 mt-0.5">Trends & insights</p>
                </div>
              </div>
            </button>

            {/* Section 4: Monthly Ledger */}
            <button
              onClick={() => toggleSection('monthlyLedger')}
              className={`p-3 rounded-lg border-2 transition-all text-left ${
                selectedSections.monthlyLedger
                  ? 'border-purple-400 bg-purple-50 shadow-sm'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-2">
                {selectedSections.monthlyLedger ? (
                  <CheckSquare className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold text-sm text-slate-800">Monthly Ledger</p>
                  <p className="text-xs text-slate-500 mt-0.5">Financial summary</p>
                </div>
              </div>
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-xs text-slate-600">
            <span className="font-semibold">Tip:</span> Deselect sections you don't need to reduce file size and printing time. Use Ctrl+P to print when ready.
          </div>
        </div>
      </div>
      
      {/* ── SECTION 1: WEEKLY VISUAL DASHBOARD (Page 1) ── */}
      {selectedSections.weeklyVisual && (
      <div className="bg-white text-slate-900 p-8 w-[1123px] h-[794px] overflow-hidden flex flex-col justify-between shadow-lg print:shadow-none" style={{ pageBreakAfter: "always", breakAfter: "page" }}>
        
        {/* Print Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">DGL Tonnage Analysis</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Dart Global Logistics · Weekly Operational Performance Dashboard</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-150 font-bold text-[9px] px-2 py-0.5 rounded shadow-sm">
              📅 {startDate} to {endDate}
            </Badge>
            <div className="flex flex-wrap gap-1 mt-0.5 justify-end max-w-[500px]">
              {companyCode && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  🏢 Entity: {companyCode}
                </span>
              )}
              {branch && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  🏢 Branch: {branch}
                </span>
              )}
              <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                🌍 From: {originCity ? `${originCity}, ` : ""}{country || "Global Markets"}
              </span>
              {destinationCountry && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  📍 To: {destinationCity ? `${destinationCity}, ` : ""}{destinationCountry}
                </span>
              )}
              <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded max-w-[150px] truncate">
                ✈️ Carrier: {airline || "All Carriers"}
              </span>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-5 gap-4 mt-4">
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Revenue</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Revenue)}</h3>
            <span className="text-[8px] text-blue-500 font-semibold">✓ Consol Revenue</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Cost</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Cost)}</h3>
            <span className="text-[8px] text-rose-500 font-semibold">✗ Total Expenses</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Profit</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Profit)}</h3>
            <span className="text-[8px] text-emerald-600 font-semibold">✓ Net Earnings</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">GP Margin</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">
              {kpi.GP_Margin ? `${kpi.GP_Margin.toFixed(1)}%` : "0.0%"}
            </h3>
            <span className="text-[8px] text-teal-600 font-semibold">✓ Margin Ratio</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Tonnage</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatNumber(kpi.Total_Tonnage)} kg</h3>
            <span className="text-[8px] text-indigo-600 font-semibold">✈️ Active Weight</span>
          </div>
        </div>

        {/* Expanded Charts Grid */}
        <div className="grid grid-cols-12 gap-6 my-4 flex-1 items-stretch">
          {/* Left: Weekly Revenue Trend Area Chart */}
          <div className="col-span-8 border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between h-[450px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Revenue Flow & Trends (Weekly)</span>
            <div className="h-[390px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="printArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4299E1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 8, fill: "#718096" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Area type="monotone" dataKey="Total_Revenue" stroke="#3182CE" strokeWidth={2} fill="url(#printArea)" dot={{ fill: "#3182CE", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Airline wise Tonnage Chart */}
          <div className="col-span-4 border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between h-[450px]">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Airline Carrier Tonnage</span>
              {selectedAirlines.length > 0 && (
                <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50 text-[6px] font-bold px-1 py-0.2 rounded shrink-0">
                  Selection Active
                </Badge>
              )}
            </div>
            <div className="h-[390px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={airlineWiseData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={true} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 8, fill: "#A0AEC0" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 8, fill: "#4A5568", fontWeight: 600 }}
                    axisLine={{ stroke: "#E2E8F0" }}
                    tickLine={false}
                    width={70}
                  />
                  <Bar dataKey="tonnage" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {airlineWiseData.map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.isSelected || selectedAirlines.length === 0 ? "#3182CE" : "#CBD5E0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[8px] text-slate-400">
          <span>Generated via Headless Chromium PDF Print Engine</span>
          <span>© 2026 Dart Global Logistics · Visual Summary Page</span>
        </div>
      </div>
      )}

      {/* ── SECTION 2: WEEKLY DETAILED CARRIER LEDGER (Page 2+, Dynamic Flow) ── */}
      {selectedSections.weeklyLedger && (
      <div className="bg-white text-slate-900 p-8 w-[1123px] min-h-[794px] flex flex-col print:block justify-between shadow-lg print:shadow-none print:min-h-0" style={{ pageBreakAfter: "always", breakAfter: "page" }}>
        
        <div className="flex flex-col print:block gap-6 flex-1">
          {/* Print Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">DGL Tonnage Analysis</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">Dart Global Logistics · Weekly Carrier Metrics Detailed Ledger</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-150 font-bold text-[9px] px-2 py-0.5 rounded shadow-sm">
                📅 {startDate} to {endDate}
              </Badge>
            </div>
          </div>

          {/* Carrier Metrics Complete Table */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex-1">
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#F1F5F9]">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Weekly Carrier Ledger</span>
              <span className="text-[8px] text-slate-400 font-bold">All Carrier Records ({data.length})</span>
            </div>
            <div>
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-slate-400 uppercase font-bold text-[8px] tracking-wider bg-slate-50/50">
                    {searchParams?.get("mode") === "custom-sql" ? (
                      data.length > 0 ? (
                        Object.keys(data[0]).map((key) => (
                          <th key={key} className="px-3 py-1.5 first:rounded-l-md last:rounded-r-md">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))
                      ) : (
                        <th className="px-3 py-1.5">Custom SQL Columns</th>
                      )
                    ) : (
                      <>
                        <th className="px-3 py-1.5">Branch</th>
                        <th className="px-3 py-1.5">Airline Name</th>
                        <th className="px-3 py-1.5">Origin</th>
                        <th className="px-3 py-1.5">Destination</th>
                        <th className="px-3 py-1.5 text-right">Revenue</th>
                        <th className="px-3 py-1.5 text-right">Tonnage</th>
                        <th className="px-3 py-1.5 text-right">Shipments</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {searchParams?.get("mode") === "custom-sql" ? (
                    data.slice(0, maxDataRows).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        {Object.entries(row).map(([key, val]: any, cellIdx) => {
                          const isPrice = key.toLowerCase().includes("revenue") || key.toLowerCase().includes("cost") || key.toLowerCase().includes("profit") || key.toLowerCase().includes("amount") || key.toLowerCase().includes("usd");
                          const isWeight = key.toLowerCase().includes("tonnage") || key.toLowerCase().includes("weight");
                          const isNumeric = typeof val === "number";

                          let displayVal = val;
                          if (val == null) {
                            displayVal = "—";
                          } else if (isPrice && isNumeric) {
                            displayVal = formatCurrency(val);
                          } else if (isWeight && isNumeric) {
                            displayVal = `${formatNumber(val)} kg`;
                          } else if (isNumeric) {
                            displayVal = formatNumber(val);
                          }

                          return (
                            <td
                              key={cellIdx}
                              className={`px-3 py-1.5 text-slate-700 font-medium ${
                                isNumeric ? "text-right tabular-nums" : ""
                              } ${key.toLowerCase().includes("airline") || key.toLowerCase().includes("carrier") ? "font-bold text-slate-800" : ""}`}
                            >
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    data.slice(0, maxDataRows).map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-3 py-1.5 font-bold text-slate-500">{row.Company_Code ?? "—"}</td>
                        <td className="px-3 py-1.5 font-semibold text-slate-800 truncate max-w-[150px]">{row.Airline ?? "—"}</td>
                        <td className="px-3 py-1.5 text-slate-500 truncate max-w-[150px]">
                          {row.Origin_City ? `${row.Origin_City}, ` : ""}{row.Origin_Country ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 truncate max-w-[150px]">
                          {row.Destination_City ? `${row.Destination_City}, ` : ""}{row.Destination_Country ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-blue-600">
                          {row.Total_Revenue != null ? formatCurrency(row.Total_Revenue) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-600 font-semibold">
                          {row.Total_Tonnage != null ? `${formatNumber(row.Total_Tonnage)} kg` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400">
                          {row.Total_Shipments != null ? formatNumber(row.Total_Shipments) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-slate-400">No carrier ledger data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div className="border-t border-slate-200 pt-2 mt-4 flex items-center justify-between text-[8px] text-slate-400">
          <span>Generated via Headless Chromium PDF Print Engine</span>
          <span>© 2026 Dart Global Logistics · Carrier Ledger Page</span>
        </div>
      </div>
      )}

      {/* ── SECTION 3: MONTHLY VISUAL DASHBOARD (Page 3) ── */}
      {selectedSections.monthlyVisual && (
      <div className="bg-white text-slate-900 p-8 w-[1123px] h-[794px] overflow-hidden flex flex-col justify-between shadow-lg print:shadow-none" style={{ pageBreakAfter: "always", breakAfter: "page" }}>
        
        {/* Print Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">DGL Tonnage Analysis</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">Dart Global Logistics · Monthly Strategic Analysis & Contribution Dashboard</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <Badge className="bg-teal-50 text-teal-700 border border-teal-150 font-bold text-[9px] px-2 py-0.5 rounded shadow-sm">
              📅 {startDate} to {endDate}
            </Badge>
            <div className="flex flex-wrap gap-1 mt-0.5 justify-end max-w-[500px]">
              {companyCode && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  🏢 Entity: {companyCode}
                </span>
              )}
              {branch && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  🏢 Branch: {branch}
                </span>
              )}
              <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                🌍 From: {originCity ? `${originCity}, ` : ""}{country || "Global Markets"}
              </span>
              {destinationCountry && (
                <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                  📍 To: {destinationCity ? `${destinationCity}, ` : ""}{destinationCountry}
                </span>
              )}
              <span className="text-[7px] uppercase font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded max-w-[150px] truncate">
                ✈️ Carrier: {airline || "All Carriers"}
              </span>
            </div>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-5 gap-4 mt-4">
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Revenue</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Revenue)}</h3>
            <span className="text-[8px] text-blue-500 font-semibold">✓ Consol Revenue</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Cost</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Cost)}</h3>
            <span className="text-[8px] text-rose-500 font-semibold">✗ Total Expenses</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Profit</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Profit)}</h3>
            <span className="text-[8px] text-emerald-600 font-semibold">✓ Net Earnings</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">GP Margin</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">
              {kpi.GP_Margin ? `${kpi.GP_Margin.toFixed(1)}%` : "0.0%"}
            </h3>
            <span className="text-[8px] text-teal-600 font-semibold">✓ Margin Ratio</span>
          </div>
          <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Tonnage</span>
            <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatNumber(kpi.Total_Tonnage)} kg</h3>
            <span className="text-[8px] text-indigo-600 font-semibold">✈️ Active Weight</span>
          </div>
        </div>

        {/* Expanded Charts Grid */}
        <div className="grid grid-cols-12 gap-6 my-4 flex-1 items-stretch">
          
          {/* Left Column - Origin Contribution (Pie Chart) */}
          <div className="col-span-4 border border-slate-200 rounded-xl p-4 bg-white shadow-sm h-[450px] flex flex-col justify-between">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Origin Contribution</span>
            <div className="relative h-[220px] flex items-center justify-center mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={doughnutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {doughnutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center flex flex-col justify-center items-center">
                <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Share</span>
                <span className="text-[9px] font-extrabold text-[#2D3748]">{formatCurrency(kpi.Total_Revenue).slice(0, 7)}</span>
              </div>
            </div>

            <div className="space-y-1 mt-2 overflow-hidden flex-1">
              {doughnutData.slice(0, 4).map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between text-[9px] text-slate-500">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    <span className="truncate max-w-[90px] font-semibold">{entry.name}</span>
                  </div>
                  <span className="font-bold text-slate-700">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Monthly Revenue Flow Area Chart */}
          <div className="col-span-8 border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between h-[450px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Revenue Flow & Trends (Monthly)</span>
            <div className="h-[390px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="printAreaMonthly" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#319795" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                  <XAxis dataKey="month_label" tick={{ fontSize: 8, fill: "#718096" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Area type="monotone" dataKey="Total_Revenue" stroke="#319795" strokeWidth={2} fill="url(#printAreaMonthly)" dot={{ fill: "#319795", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-[8px] text-slate-400">
          <span>Generated via Headless Chromium PDF Print Engine</span>
          <span>© 2026 Dart Global Logistics · Visual Summary Page</span>
        </div>
      </div>
      )}

      {/* ── SECTION 4: MONTHLY DETAILED FINANCIAL LEDGER (Page 4+, Dynamic Flow) ── */}
      {selectedSections.monthlyLedger && (
      <div className="bg-white text-slate-900 p-8 w-[1123px] min-h-[794px] flex flex-col print:block justify-between shadow-lg print:shadow-none print:min-h-0">
        
        <div className="flex flex-col print:block gap-6 flex-1">
          {/* Print Header */}
          <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
              <div>
                <h1 className="text-lg font-bold text-slate-800 tracking-tight">DGL Tonnage Analysis</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">Dart Global Logistics · Monthly Strategic Analysis & Contribution Ledger</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Badge className="bg-teal-50 text-teal-700 border border-teal-150 font-bold text-[9px] px-2 py-0.5 rounded shadow-sm">
                📅 {startDate} to {endDate}
              </Badge>
            </div>
          </div>

          {/* Monthly Summary Table Complete Table */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex-1">
            <div className="flex items-center justify-between mb-2 pb-1 border-b border-[#F1F5F9]">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Monthly Financial Ledger</span>
              <span className="text-[8px] text-slate-400 font-bold">All Monthly Records ({monthlyData.length})</span>
            </div>
            <div>
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-slate-400 uppercase font-bold text-[8px] tracking-wider bg-slate-50/55">
                    <th className="px-3 py-1.5">Year</th>
                    <th className="px-3 py-1.5">Month</th>
                    <th className="px-3 py-1.5 text-right">Revenue (USD)</th>
                    <th className="px-3 py-1.5 text-right">Tonnage</th>
                    <th className="px-3 py-1.5 text-right">Shipments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {monthlyData.slice(0, maxDataRows).map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 font-bold text-slate-500">{row.Year}</td>
                      <td className="px-3 py-1.5 font-semibold text-slate-800">{row.month_label ? row.month_label.split(" '")[0] : "—"}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-teal-600">
                        {row.Total_Revenue != null ? formatCurrency(row.Total_Revenue) : "$0"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-600 font-semibold">
                        {row.Total_Tonnage != null ? `${formatNumber(row.Total_Tonnage)} kg` : "0 kg"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-400">
                        {row.Total_Shipments != null ? formatNumber(row.Total_Shipments) : "0"}
                      </td>
                    </tr>
                  ))}
                  {monthlyData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400">No monthly ledger data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Print Footer */}
        <div className="border-t border-slate-200 pt-2 mt-4 flex items-center justify-between text-[8px] text-slate-400">
          <span>Generated via Headless Chromium PDF Print Engine</span>
          <span>© 2026 Dart Global Logistics · Monthly Ledger Page</span>
        </div>
      </div>
      )}

    </div>
  );
}
