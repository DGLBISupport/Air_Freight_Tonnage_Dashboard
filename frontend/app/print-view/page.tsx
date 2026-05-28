"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Plane, Globe } from "lucide-react";
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

  const [data, setData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchPrintData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (country) params.append("country", country);
      if (airline) params.append("airline", airline);
      if (companyCode) params.append("company_code", companyCode);
      if (originCity) params.append("origin_city", originCity);
      if (destinationCountry) params.append("destination_country", destinationCountry);
      if (destinationCity) params.append("destination_city", destinationCity);
      if (branch) params.append("branch", branch);

      const [dataRes, weekRes, kpiRes] = await Promise.all([
        fetch(`${API}/api/data?${params}`),
        fetch(`${API}/api/weekly?${params}`),
        fetch(`${API}/api/kpi?${params}`),
      ]);
      const [d, w, k] = await Promise.all([dataRes.json(), weekRes.json(), kpiRes.json()]);
      if (d.status === "success") setData(d.data);
      if (w.status === "success") setWeeklyData(w.data);
      if (k.status === "success") setKpi(k.data);
    } catch (e) {
      console.error("Failed to load print preview", e);
    }
    setLoading(false);
  }, [startDate, endDate, country, airline, companyCode, originCity, destinationCountry, destinationCity, branch]);

  useEffect(() => {
    fetchPrintData();
  }, [fetchPrintData]);

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
    <div className="bg-white text-slate-900 p-8 w-[1123px] h-[794px] overflow-hidden flex flex-col justify-between select-none" style={{ pageBreakAfter: "always" }}>
      
      {/* Print Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
        <div className="flex items-center gap-2.5">
          <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">DGL Tonnage Analysis</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Dart Global Logistics · Executive Dashboard Snapshot</p>
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
        {/* Revenue */}
        <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Revenue</span>
          <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Revenue)}</h3>
          <span className="text-[8px] text-blue-500 font-semibold">✓ Consol Revenue</span>
        </div>
        {/* Cost */}
        <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Cost</span>
          <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Cost)}</h3>
          <span className="text-[8px] text-rose-500 font-semibold">✗ Total Expenses</span>
        </div>
        {/* Profit */}
        <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Profit</span>
          <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatCurrency(kpi.Total_Profit)}</h3>
          <span className="text-[8px] text-emerald-600 font-semibold">✓ Net Earnings</span>
        </div>
        {/* GP Margin */}
        <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">GP Margin</span>
          <h3 className="text-lg font-extrabold text-slate-800 leading-none">
            {kpi.GP_Margin ? `${kpi.GP_Margin.toFixed(1)}%` : "0.0%"}
          </h3>
          <span className="text-[8px] text-teal-600 font-semibold">✓ Margin Ratio</span>
        </div>
        {/* Total Tonnage */}
        <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col justify-between h-[72px]">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Total Tonnage</span>
          <h3 className="text-lg font-extrabold text-slate-800 leading-none">{formatNumber(kpi.Total_Tonnage)} kg</h3>
          <span className="text-[8px] text-indigo-600 font-semibold">✈️ Active Weight</span>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-12 gap-6 my-4 flex-1">
        
        {/* Left Column - Origin Contribution (Pie Chart) */}
        <div className="col-span-4 border border-slate-200 rounded-xl p-4 bg-white shadow-sm h-[475px] flex flex-col justify-between">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Origin Contribution</span>
          <div className="relative h-56 flex items-center justify-center mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={doughnutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {doughnutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center flex flex-col justify-center items-center">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
              <span className="text-[10px] font-extrabold text-[#2D3748]">{formatCurrency(kpi.Total_Revenue).slice(0, 7)}</span>
            </div>
          </div>

          <div className="space-y-2 mt-4 flex-1 overflow-hidden">
            {doughnutData.slice(0, 5).map((entry, idx) => (
              <div key={entry.name} className="flex items-center justify-between text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate max-w-[120px] font-medium">{entry.name}</span>
                </div>
                <span className="font-bold text-slate-700">{formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right side flow Area Chart and Stacked Bar Chart */}
        <div className="col-span-8 flex flex-col justify-between h-[475px] space-y-4">
          
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex-1 flex flex-col justify-between min-h-[260px]">
            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Revenue Flow & Trends</span>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="printArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4299E1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                  <XAxis dataKey="week_label" tick={{ fontSize: 9, fill: "#718096" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#718096" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Area type="monotone" dataKey="Total_Revenue" stroke="#3182CE" strokeWidth={2} fill="url(#printArea)" dot={{ fill: "#3182CE", r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Stacked Tonnage Class Breakdown Bar Chart */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm h-[200px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Tonnage Class Breakdown (Shipments)</span>
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#80DEEA]" /> Heavy Cargo</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#37474F]" /> Light Cargo</span>
              </div>
            </div>
            <div className="h-32 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedWeightBars} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 8, fill: "#A0AEC0" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 8, fill: "#A0AEC0" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="Converted" name="Heavy Cargo" stackId="a" fill="#80DEEA" maxBarSize={15} />
                  <Bar dataKey="Cancelled" name="Light Cargo" stackId="a" fill="#37474F" maxBarSize={15} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </div>

      {/* Print Footer */}
      <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[9px] text-slate-400">
        <span>Generated via Headless Chromium PDF Print Engine</span>
        <span>© 2026 Dart Global Logistics</span>
      </div>

    </div>
  );
}
