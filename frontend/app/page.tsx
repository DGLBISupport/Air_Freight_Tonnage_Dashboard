"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Calendar, Globe, Plane, RefreshCw, Send, X, ArrowUpRight, ArrowDownRight, Layers, FileText, Printer, CheckCircle,
  Users, Check, ChevronDown, Plus, Settings, Eye, Info
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = "http://localhost:8000";

// Formatting helpers matching the clean image style
// Formatting helpers matching the clean image style
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

// Customized Pie Chart Colors matching user's image
const PIE_COLORS = ["#4299E1", "#81E6D9", "#CBD5E0", "#5A67D8", "#ED64A6"];


// Premium Multi-Select Dropdown Component
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
  isObject = false,
  emoji = "🔍"
}: {
  label: string;
  options: any[];
  selected: string[];
  onChange: (val: string[]) => void;
  placeholder: string;
  isObject?: boolean;
  emoji?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.multiselect-${label.replace(/\s+/g, "")}`)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [label]);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((x) => x !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    if (isObject) {
      onChange(options.map((o) => o.code));
    } else {
      onChange(options);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === options.length) return `All ${label}s`;
    return `${selected.length} Selected`;
  };

  return (
    <div className={`relative flex flex-col gap-1 w-full min-w-[130px] multiselect-${label.replace(/\s+/g, "")}`}>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 w-full bg-white border border-[#E2E8F0] hover:border-[#CBD5E0] px-3 text-xs text-slate-700 rounded-md flex items-center justify-between transition-all shadow-sm"
      >
        <span className="truncate mr-1 font-medium flex items-center gap-1.5">
          <span className="text-slate-400 shrink-0">{emoji}</span>
          <span className="truncate text-slate-700">{getDisplayText()}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 bg-white border border-[#CBD5E0] rounded-lg shadow-xl z-50 p-2 text-slate-805 animate-in fade-in-0 slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-2 py-1 mb-1.5 border-b border-slate-100 pb-1">
            <button
              onClick={handleSelectAll}
              className="text-[10px] text-[#3182CE] hover:text-[#2B6CB0] font-bold uppercase tracking-wider"
            >
              Select All
            </button>
            <button
              onClick={handleClearAll}
              className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
            {options.map((opt) => {
              const code = isObject ? opt.code : opt;
              const name = isObject ? opt.name : opt;
              const isChecked = selected.includes(code);
              return (
                <div
                  key={code}
                  onClick={() => handleToggle(code)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                    isChecked ? "bg-[#EBF8FF] text-[#2B6CB0] font-semibold" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#3182CE] focus:ring-[#3182CE] pointer-events-none"
                  />
                  <span className="truncate">
                    {isObject ? `${code} - ${name.replace("Dart Global Logistics", "DGL").replace("DGL SUPPLY CHAIN SOLUTIONS", "DGL SCS")}` : name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


export default function Dashboard() {
  // Filter States
  const [startDate, setStartDate] = useState("2025-06-01");
  const [endDate, setEndDate] = useState("2026-05-21");
  
  // Multi-Select filter selections
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedOriginCities, setSelectedOriginCities] = useState<string[]>([]);
  const [selectedDestCountries, setSelectedDestCountries] = useState<string[]>([]);
  const [selectedDestCities, setSelectedDestCities] = useState<string[]>([]);
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);

  // Dropdown option lists
  const [countries, setCountries] = useState<string[]>([]);
  const [airlines, setAirlines] = useState<string[]>([]);
  const [companyCodes, setCompanyCodes] = useState<{code: string, name: string}[]>([]);
  const [branches, setBranches] = useState<{code: string, name: string}[]>([]);
  const [originCities, setOriginCities] = useState<string[]>([]);
  const [destinationCountries, setDestinationCountries] = useState<string[]>([]);
  const [destinationCities, setDestinationCities] = useState<string[]>([]);

  // Multiple Recipient States
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [availableEmails, setAvailableEmails] = useState<string[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  // Modal preview state
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Load candidate recipients from API
  const fetchRecipients = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/recipients`);
      const d = await res.json();
      if (d.status === "success") {
        setAvailableEmails(d.data);
        // Default select the first email if nothing is selected yet
        if (d.data.length > 0) {
          setSelectedEmails((prev) => prev.length === 0 ? [d.data[0]] : prev);
        }
      }
    } catch (e) {
      console.error("Recipients fetch failed", e);
    }
  }, []);

  useEffect(() => { fetchRecipients(); }, [fetchRecipients]);

  // Main Tonnage Report data states
  const [data, setData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [kpi, setKpi] = useState<any>({});

  // Loading & Email Status
  const [loading, setLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<boolean | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // PDF Section selection for sending (before print preview)
  const [pdfSections, setPdfSections] = useState({
    weeklyVisual: true,
    weeklyLedger: true,
    monthlyVisual: true,
    monthlyLedger: true,
  });

  const [showSectionSelector, setShowSectionSelector] = useState(false);

  // --- SQL SANDBOX CONSOLE STATES ---
  const [dashboardMode, setDashboardMode] = useState<"standard" | "custom-sql">("standard");
  const [isSqlConsoleOpen, setIsSqlConsoleOpen] = useState(false);
  const [customSqlText, setCustomSqlText] = useState(`-- Write your own SQL query here!
-- Pre-populated default Vietnam - Turkish Airline Air Cargo report
SELECT
    vt.ConsoleNumber AS Console_Number,
    vt.MasterBillNum AS Master_Airway_Bill,
    vt.AirlineName1 AS Airline,
    vt.ConsolTransportMode AS Transport_Mode,
    vt.ETD,
    vt.ConLoadPortCountryName AS Origin_Country,
    COALESCE(MAX(vs.OriginCity), 'N/A') AS Origin_City,
    COALESCE(MAX(vs.DestCity), 'N/A') AS Destination_City,
    COALESCE(MAX(vs.DestCountry), 'N/A') AS Destination_Country,
    COALESCE(MAX(vs.Company), 'Unlinked') AS Company_Code,
    COUNT(DISTINCT vs.ShipmentNumber) AS Total_Shipments,
    ROUND(vt.Air_ChargebleWeight, 2) AS Tonnage_Chargeable,
    ROUND(vt.Air_ActualWeight, 2) AS Tonnage_Actual,
    ROUND(vt.Revenue_USD, 2) AS Revenue_USD,
    ROUND(vt.Cost_USD, 2) AS Cost_USD,
    ROUND(vt.Profit_USD, 2) AS Profit_USD,
    ROUND((vt.Profit_USD / NULLIF(vt.Revenue_USD, 0)) * 100, 2) AS GP_Margin_Percent
FROM dbo.ChatData_ViewShipConsolTransport vt
LEFT JOIN dbo.ChatData_ViewShipConsolLink vsc
    ON vsc.Link_ConsolNumber = vt.ConsoleNumber
LEFT JOIN dbo.ChatData_ViewRevandVolume_ShipmentDate vs
    ON vs.ShipmentNumber = vsc.Link_ShipmentNum
WHERE vt.ConLoadPortCountryName = 'Viet Nam'
    AND vt.ETD >= '2025-06-01'
    AND vt.ETD <= '2026-05-21'
    AND vt.AirlineName1 LIKE '%Turkish%'
    AND vt.TransportMode = 'AIR'
GROUP BY vt.ConsoleNumber, vt.MasterBillNum, vt.AirlineName1,
         vt.ConsolTransportMode, vt.ETD, vt.ConLoadPortCountryName,
         vt.Air_ChargebleWeight, vt.Air_ActualWeight,
         vt.Revenue_USD, vt.Cost_USD, vt.Profit_USD
ORDER BY vt.ETD DESC, vt.Revenue_USD DESC`);

  const [sqlError, setSqlError] = useState("");
  const [sqlExecutionStatus, setSqlExecutionStatus] = useState("");
  const [sqlIsRunning, setSqlIsRunning] = useState(false);

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

  const runCustomSqlQuery = async (overrideSql?: string) => {
    // Validate SQL query
    const activeSql = (overrideSql || customSqlText).trim();
    
    if (!activeSql) {
      setSqlError("SQL query cannot be empty. Please write a query and try again.");
      return;
    }

    setSqlIsRunning(true);
    setSqlExecutionStatus("Executing custom SQL query against SQL Server...");
    setSqlError("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/custom-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: activeSql }),
      });

      const d = await res.json();

      // Check if response is successful (status 200-299 range)
      if (res.ok && d.status === "success") {
        const records = d.data || [];

        // Validate that we have data
        if (!Array.isArray(records)) {
          setSqlError("Invalid response format: Expected array of records.");
          setSqlExecutionStatus("");
          setLoading(false);
          setSqlIsRunning(false);
          return;
        }

        // Update data state
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

        // Group weekly
        const weeklyGrouped = parseWeeklyData(records);
        setWeeklyData(weeklyGrouped);

        // Group monthly
        const monthlyGrouped = parseMonthlyData(records);
        setMonthlyData(monthlyGrouped);

        setSqlExecutionStatus(`✓ Query executed successfully! Returned ${records.length} rows.`);
      } else {
        // Handle error response from backend
        const errorMessage = d.detail || d.error || "Database query failed to execute. Please check your SQL syntax.";
        setSqlError(errorMessage);
        setSqlExecutionStatus("");
      }
    } catch (e: any) {
      // Handle network or parsing errors
      const errorMessage = e.message || "Could not connect to database endpoint. Please ensure the backend API is running.";
      setSqlError(`Connection Error: ${errorMessage}`);
      setSqlExecutionStatus("");
    } finally {
      setLoading(false);
      setSqlIsRunning(false);
    }
  };

  const companyCodeParam = selectedCompanies.length === 0 ? "" : selectedCompanies.join(",");
  const branchParam = selectedBranches.length === 0 ? "" : selectedBranches.join(",");
  const countryParam = selectedCountries.length === 0 ? "" : selectedCountries.join(",");
  const originCityParam = selectedOriginCities.length === 0 ? "" : selectedOriginCities.join(",");
  const destinationCountryParam = selectedDestCountries.length === 0 ? "" : selectedDestCountries.join(",");
  const destinationCityParam = selectedDestCities.length === 0 ? "" : selectedDestCities.join(",");
  const airlineParam = selectedAirlines.length === 0 ? "" : selectedAirlines.join(",");

  // Dynamically load options for filters
  const fetchFilterOptions = useCallback(async () => {
    if (dashboardMode !== "standard") return;
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const [cRes, aRes, ccRes, dcRes] = await Promise.all([
        fetch(`${API}/api/countries?${params}`),
        fetch(`${API}/api/airlines?${params}${countryParam ? `&country=${encodeURIComponent(countryParam)}` : ""}`),
        fetch(`${API}/api/company-codes?${params}`),
        fetch(`${API}/api/destination-countries?${params}`),
      ]);
      const [cData, aData, ccData, dcData] = await Promise.all([
        cRes.json(), aRes.json(), ccRes.json(), dcRes.json()
      ]);
      if (cData.status === "success") setCountries(cData.data);
      if (aData.status === "success") setAirlines(aData.data);
      if (ccData.status === "success") setCompanyCodes(ccData.data);
      if (dcData.status === "success") setDestinationCountries(dcData.data);
    } catch (e) {
      console.error("Dropdown options failed", e);
    }
  }, [startDate, endDate, countryParam, dashboardMode]);

  // Main dynamic database fetch
  const fetchMainAnalytics = useCallback(async () => {
    if (dashboardMode !== "standard") return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      if (countryParam) params.append("country", countryParam);
      if (airlineParam) params.append("airline", airlineParam);
      if (companyCodeParam) params.append("company_code", companyCodeParam);
      if (originCityParam) params.append("origin_city", originCityParam);
      if (destinationCountryParam) params.append("destination_country", destinationCountryParam);
      if (destinationCityParam) params.append("destination_city", destinationCityParam);
      if (branchParam) params.append("branch", branchParam);

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
    } catch (e) {
      console.error("Failed to sync database view", e);
    }
    setLoading(false);
  }, [startDate, endDate, countryParam, airlineParam, companyCodeParam, originCityParam, destinationCountryParam, destinationCityParam, branchParam, dashboardMode]);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);
  
  useEffect(() => {
    if (dashboardMode === "standard") {
      fetchMainAnalytics();
    }
  }, [dashboardMode, fetchMainAnalytics]);

  // Cascading updates only when in standard filter mode
  useEffect(() => {
    if (dashboardMode !== "standard") return;
    const updateCascadingCarriers = async () => {
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (countryParam) params.append("country", countryParam);
        const res = await fetch(`${API}/api/airlines?${params}`);
        const d = await res.json();
        if (d.status === "success") {
          setAirlines(d.data);
          setSelectedAirlines((prev) => prev.filter((a) => d.data.includes(a)));
        }
      } catch (e) {}
    };
    updateCascadingCarriers();
  }, [selectedCountries, startDate, endDate, countryParam, dashboardMode]);

  useEffect(() => {
    if (dashboardMode !== "standard") return;
    const updateCities = async () => {
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (countryParam) params.append("country", countryParam);
        const res = await fetch(`${API}/api/origin-cities?${params}`);
        const d = await res.json();
        if (d.status === "success") {
          setOriginCities(d.data);
          setSelectedOriginCities((prev) => prev.filter((c) => d.data.includes(c)));
        }
      } catch (e) {}
    };
    updateCities();
  }, [selectedCountries, startDate, endDate, countryParam, dashboardMode]);

  useEffect(() => {
    if (dashboardMode !== "standard") return;
    const updateCities = async () => {
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (destinationCountryParam) params.append("country", destinationCountryParam);
        const res = await fetch(`${API}/api/destination-cities?${params}`);
        const d = await res.json();
        if (d.status === "success") {
          setDestinationCities(d.data);
          setSelectedDestCities((prev) => prev.filter((c) => d.data.includes(c)));
        }
      } catch (e) {}
    };
    updateCities();
  }, [selectedDestCountries, startDate, endDate, destinationCountryParam, dashboardMode]);

  useEffect(() => {
    if (dashboardMode !== "standard") return;
    const updateCountries = async () => {
      try {
        const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
        if (companyCodeParam) params.append("company_code", companyCodeParam);
        const res = await fetch(`${API}/api/countries?${params}`);
        const d = await res.json();
        if (d.status === "success") {
          setCountries(d.data);
          setSelectedCountries((prev) => prev.filter((c) => d.data.includes(c)));
        }
      } catch (e) {}
    };
    updateCountries();
  }, [selectedCompanies, startDate, endDate, companyCodeParam, dashboardMode]);

  useEffect(() => {
    if (dashboardMode !== "standard") return;
    const updateBranches = async () => {
      try {
        const params = new URLSearchParams();
        if (companyCodeParam) params.append("company_code", companyCodeParam);
        const res = await fetch(`${API}/api/branches?${params}`);
        const d = await res.json();
        if (d.status === "success") {
          setBranches(d.data);
          setSelectedBranches((prev) => prev.filter((b) => d.data.some((x: any) => x.code === b)));
        }
      } catch (e) {
        console.error("Failed to load branches", e);
      }
    };
    updateBranches();
  }, [selectedCompanies, startDate, endDate, companyCodeParam, dashboardMode]);


  // Trigger Playwright + graph PDF dispatch
  const handleSendEmail = async () => {
    if (selectedEmails.length === 0) {
      setEmailStatus("Please select or add at least one recipient email.");
      setEmailSuccess(false);
      return;
    }
    setEmailLoading(true);
    setEmailStatus("Rendering report layout & transmitting A4 Landscape PDF via Microsoft Graph...");
    setEmailSuccess(null);
    try {
      const emailString = selectedEmails.join(", ");
      
      // Build request body based on dashboard mode
      const requestBody: any = {
        recipient_email: emailString,
        // Pass selected sections to reduce PDF size
        include_weekly_visual: pdfSections.weeklyVisual,
        include_weekly_ledger: pdfSections.weeklyLedger,
        include_monthly_visual: pdfSections.monthlyVisual,
        include_monthly_ledger: pdfSections.monthlyLedger,
        // Limit data rows to 100 to reduce email attachment size
        max_data_rows: 100,
      };

      // Add mode-specific fields
      if (dashboardMode === "custom-sql") {
        // Custom SQL mode - include the query
        requestBody.mode = "custom-sql";
        requestBody.custom_sql = customSqlText;
      } else {
        // Standard mode - include date range and filters
        requestBody.start_date = startDate;
        requestBody.end_date = endDate;
        requestBody.country = countryParam || null;
        requestBody.airline = airlineParam || null;
        requestBody.company_code = companyCodeParam || null;
        requestBody.origin_city = originCityParam || null;
        requestBody.destination_country = destinationCountryParam || null;
        requestBody.destination_city = destinationCityParam || null;
        requestBody.branch = branchParam || null;
      }

      const res = await fetch(`${API}/api/send-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const result = await res.json();
      setEmailStatus(result.message || "Executive stats report successfully sent.");
      setEmailSuccess(true);
    } catch {
      setEmailStatus("Could not transmit PDF dashboard.");
      setEmailSuccess(false);
    }
    setEmailLoading(false);
  };

  // Intercepting the "Send Stats" button to trigger the new verification step
  const handleSendStatsClick = () => {
    if (selectedEmails.length === 0) {
      alert("Please select or add at least one recipient email address first.");
      return;
    }
    // Show section selector so user can customize PDF before sending
    setShowSectionSelector(true);
  };

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

  // Process data for stacked trial outcomes (Converted vs Cancelled) using different weight bands
  const stackedWeightBars = weeklyData.slice(-14).map((item) => {
    const total = item.Total_Shipments ?? 0;
    const heavyClass = Math.round(total * 0.72);
    const lightClass = total - heavyClass;
    return {
      week: item.week_label || `W${item.Week}`,
      Converted: heavyClass,
      Cancelled: lightClass
    };
  });

  // Construct print-view query params for preview window
  const getPrintViewUrl = () => {
    if (dashboardMode === "custom-sql") {
      const params = new URLSearchParams({
        mode: "custom-sql",
        custom_sql: customSqlText,
        include_weekly_visual: pdfSections.weeklyVisual.toString(),
        include_weekly_ledger: pdfSections.weeklyLedger.toString(),
        include_monthly_visual: pdfSections.monthlyVisual.toString(),
        include_monthly_ledger: pdfSections.monthlyLedger.toString(),
        max_data_rows: "100",
      });
      return `/print-view?${params.toString()}`;
    }
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (countryParam) params.append("country", countryParam);
    if (airlineParam) params.append("airline", airlineParam);
    if (companyCodeParam) params.append("company_code", companyCodeParam);
    if (originCityParam) params.append("origin_city", originCityParam);
    if (destinationCountryParam) params.append("destination_country", destinationCountryParam);
    if (destinationCityParam) params.append("destination_city", destinationCityParam);
    if (branchParam) params.append("branch", branchParam);
    // Add section selections and row limit
    params.append("include_weekly_visual", pdfSections.weeklyVisual.toString());
    params.append("include_weekly_ledger", pdfSections.weeklyLedger.toString());
    params.append("include_monthly_visual", pdfSections.monthlyVisual.toString());
    params.append("include_monthly_ledger", pdfSections.monthlyLedger.toString());
    params.append("max_data_rows", "100");
    return `/print-view?${params.toString()}`;
  };

  const getSelectedCompanyNames = () => {
    if (selectedCompanies.length === 0) return "All Companies";
    const names = selectedCompanies.map(code => {
      const match = companyCodes.find(c => c.code === code);
      if (!match) return code;
      return match.name
        .replace("Dart Global Logistics", "DGL")
        .replace("DGL SUPPLY CHAIN SOLUTIONS", "DGL SCS")
        .replace(" (PVT) LTD", "")
        .replace(" PVT LTD", "")
        .replace(" LTD", "");
    });
    return names.join(", ");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-12">
      
      {/* ── CLEAN TOP HEADER BAR ── */}
      <div className="bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain shrink-0" />
            <span className="live-dot-light" />
            <h1 className="text-lg font-bold text-[#1A202C] tracking-tight">DGL Tonnage Analysis</h1>
            <span className="text-[11px] text-slate-400 font-medium px-2 py-0.5 rounded-full bg-[#EDF2F7] border border-[#E2E8F0]">
              Tonnage Dashboard
            </span>
          </div>

          {/* Clean Light-Mode Filters Section */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 border-r border-[#EDF2F7] pr-4 mr-2 relative">
              {/* Dropdown Toggle Button */}
              <div className="relative">
                <Button
                  onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                  className="h-8 px-3 bg-white hover:bg-slate-50 border border-[#CBD5E0] text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {selectedEmails.length === 0
                      ? "Select Recipients"
                      : `${selectedEmails.length} Recipient${selectedEmails.length > 1 ? "s" : ""}`}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </Button>

                {/* Dropdown Menu */}
                {showRecipientDropdown && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-white border border-[#CBD5E0] rounded-lg shadow-xl z-50 p-3 animate-in fade-in-0 slide-in-from-top-1 duration-150 text-slate-800">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Select Recipients</p>
                    
                    {/* Pre-configured Email Options */}
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {availableEmails.map((emailOption) => {
                        const isSelected = selectedEmails.includes(emailOption);
                        return (
                          <div
                            key={emailOption}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedEmails(selectedEmails.filter((x) => x !== emailOption));
                              } else {
                                setSelectedEmails([...selectedEmails, emailOption]);
                              }
                            }}
                            className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                              isSelected ? "bg-[#EBF8FF] text-[#2B6CB0] font-semibold" : "hover:bg-slate-50 text-slate-700"
                            }`}
                          >
                            <span className="truncate">{emailOption}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#3182CE]" />}
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-[#F1F5F9] my-2 pt-2" />

                    {/* Add Custom Email Input */}
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Add Custom Email</p>
                    <div className="flex gap-1">
                      <Input
                        placeholder="user@example.com"
                        value={customEmailInput}
                        onChange={(e) => setCustomEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (customEmailInput.trim() && !selectedEmails.includes(customEmailInput.trim())) {
                              setSelectedEmails([...selectedEmails, customEmailInput.trim()]);
                              if (!availableEmails.includes(customEmailInput.trim())) {
                                setAvailableEmails([...availableEmails, customEmailInput.trim()]);
                              }
                              setCustomEmailInput("");
                            }
                          }
                        }}
                        className="h-7 text-xs bg-white border-[#CBD5E0] focus:border-[#4299E1] rounded-md text-slate-700 w-full"
                      />
                      <Button
                        size="icon"
                        onClick={() => {
                          if (customEmailInput.trim() && !selectedEmails.includes(customEmailInput.trim())) {
                            setSelectedEmails([...selectedEmails, customEmailInput.trim()]);
                            if (!availableEmails.includes(customEmailInput.trim())) {
                              setAvailableEmails([...availableEmails, customEmailInput.trim()]);
                            }
                            setCustomEmailInput("");
                          }
                        }}
                        className="h-7 w-7 bg-[#4299E1] hover:bg-[#3182CE] text-white rounded-md shrink-0 flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSendStatsClick}
                className="h-8 px-3.5 bg-[#4299E1] hover:bg-[#3182CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all"
              >
                Send Stats
              </Button>
            </div>


            {/* Premium PDF Live Preview Trigger */}
            <Button
              onClick={() => setShowPdfPreview(true)}
              className="h-8 px-3.5 bg-white hover:bg-slate-50 border border-[#CBD5E0] text-slate-700 text-xs font-bold rounded-md flex items-center gap-1.5 transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              PDF Live Preview
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={fetchMainAnalytics}
              disabled={loading}
              className="h-8 w-8 border-[#CBD5E0] hover:bg-slate-50 text-slate-500 rounded-md"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── FILTER UTILITIES STRIP ── */}
      <div className="max-w-[1400px] mx-auto px-6 mt-6">
        <div className="bg-white rounded-xl p-5 border border-[#E2E8F0] shadow-sm space-y-4">
          
          {/* Mode Switcher */}
          <div className="flex items-center justify-between pb-3 border-b border-[#EDF2F7]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#3182CE]" />
              <span className="text-xs font-bold text-slate-700">Analysis Query Mode</span>
            </div>
            <div className="flex bg-[#EDF2F7] p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setDashboardMode("standard")}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                  dashboardMode === "standard"
                    ? "bg-white text-[#3182CE] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Standard Filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setDashboardMode("custom-sql");
                  setIsSqlConsoleOpen(true);
                  if (data.length === 0 || dashboardMode === "standard") {
                    runCustomSqlQuery();
                  }
                }}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                  dashboardMode === "custom-sql"
                    ? "bg-white text-[#2B6CB0] shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>Premium SQL Sandbox</span>
                <span className="bg-amber-100 text-amber-700 text-[8px] px-1 py-0.2 rounded font-black uppercase">Beta</span>
              </button>
            </div>
          </div>

          {dashboardMode === "standard" ? (
            <>
              {/* Row 1: Global Entity & Timeframe */}
              <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-[#F1F5F9]">
                {/* Start Date */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 w-34 text-xs bg-white border-[#E2E8F0] rounded-md text-slate-700 [color-scheme:light]"
                  />
                </div>
                
                {/* End Date */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 w-34 text-xs bg-white border-[#E2E8F0] rounded-md text-slate-700 [color-scheme:light]"
                  />
                </div>

                {/* Company Code */}
                <MultiSelect
                  label="Company Code"
                  options={companyCodes}
                  selected={selectedCompanies}
                  onChange={setSelectedCompanies}
                  placeholder="All Companies"
                  isObject={true}
                  emoji="🏢"
                />

                {/* Branch */}
                <MultiSelect
                  label="Branch"
                  options={branches}
                  selected={selectedBranches}
                  onChange={setSelectedBranches}
                  placeholder="All Branches"
                  isObject={true}
                  emoji="🏢"
                />

                {/* Airline Carrier */}
                <MultiSelect
                  label="Airline Carrier"
                  options={airlines}
                  selected={selectedAirlines}
                  onChange={setSelectedAirlines}
                  placeholder="All Carriers"
                  emoji="✈️"
                />
              </div>

              {/* Row 2: Route Hierarchy */}
              <div className="flex flex-wrap items-center gap-4">
                {/* FROM (Origin Hub) Hierarchy */}
                <div className="flex items-center gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] font-extrabold text-[#3182CE] bg-[#EBF8FF] px-2 py-1 rounded uppercase tracking-wider shrink-0">From</span>
                  
                  <MultiSelect
                    label="Country"
                    options={countries}
                    selected={selectedCountries}
                    onChange={setSelectedCountries}
                    placeholder="All Countries"
                    emoji="🌍"
                  />

                  <MultiSelect
                    label="City"
                    options={originCities}
                    selected={selectedOriginCities}
                    onChange={setSelectedOriginCities}
                    placeholder="All Cities"
                    emoji="🏙️"
                  />
                </div>

                {/* TO (Destination Hub) Hierarchy */}
                <div className="flex items-center gap-3 bg-emerald-50/30 p-2 rounded-lg border border-emerald-100/50">
                  <span className="text-[10px] font-extrabold text-[#38A169] bg-[#E6FFFA] px-2 py-1 rounded uppercase tracking-wider shrink-0">To</span>
                  
                  <MultiSelect
                    label="Country"
                    options={destinationCountries}
                    selected={selectedDestCountries}
                    onChange={setSelectedDestCountries}
                    placeholder="All Countries"
                    emoji="🌍"
                  />

                  <MultiSelect
                    label="City"
                    options={destinationCities}
                    selected={selectedDestCities}
                    onChange={setSelectedDestCities}
                    placeholder="All Cities"
                    emoji="🏙️"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💻 SQL Query Sandbox Console</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Connected directly to DartBIDW)</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    Execute arbitrary queries. Map results automatically by using fields: <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">Airline</code>, <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">Origin_Country</code>, <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">Total_Tonnage</code>, <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">Total_Revenue</code>, <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">Total_Shipments</code>, <code className="font-mono text-indigo-650 bg-slate-50 px-1 rounded">ETD</code>.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSqlConsoleOpen(!isSqlConsoleOpen)}
                  className="h-7 text-xs text-[#3182CE] hover:bg-[#EBF8FF] font-semibold"
                >
                  {isSqlConsoleOpen ? "Collapse Editor" : "Expand Editor"}
                </Button>
              </div>

              {isSqlConsoleOpen && (
                <div className="space-y-3">
                  <div className="relative border border-[#CBD5E0] rounded-lg overflow-hidden shadow-inner">
                    <textarea
                      value={customSqlText}
                      onChange={(e) => setCustomSqlText(e.target.value)}
                      rows={12}
                      className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#3182CE] resize-y"
                      placeholder="SELECT * FROM dbo.ChatData_ViewShipConsolTransport..."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => runCustomSqlQuery()}
                      disabled={sqlIsRunning}
                      className="h-8 px-4 bg-[#3182CE] hover:bg-[#2B6CB0] text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-all shadow"
                    >
                      {sqlIsRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Execute Custom SQL"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomSqlText(`-- Write your own SQL query here!
-- Pre-populated default Vietnam - Turkish Airline Air Cargo report
SELECT
    vt.ConsoleNumber AS Console_Number,
    vt.MasterBillNum AS Master_Airway_Bill,
    vt.AirlineName1 AS Airline,
    vt.ConsolTransportMode AS Transport_Mode,
    vt.ETD,
    vt.ConLoadPortCountryName AS Origin_Country,
    COALESCE(MAX(vs.OriginCity), 'N/A') AS Origin_City,
    COALESCE(MAX(vs.DestCity), 'N/A') AS Destination_City,
    COALESCE(MAX(vs.DestCountry), 'N/A') AS Destination_Country,
    COALESCE(MAX(vs.Company), 'Unlinked') AS Company_Code,
    COUNT(DISTINCT vs.ShipmentNumber) AS Total_Shipments,
    ROUND(vt.Air_ChargebleWeight, 2) AS Tonnage_Chargeable,
    ROUND(vt.Air_ActualWeight, 2) AS Tonnage_Actual,
    ROUND(vt.Revenue_USD, 2) AS Revenue_USD,
    ROUND(vt.Cost_USD, 2) AS Cost_USD,
    ROUND(vt.Profit_USD, 2) AS Profit_USD,
    ROUND((vt.Profit_USD / NULLIF(vt.Revenue_USD, 0)) * 100, 2) AS GP_Margin_Percent
FROM dbo.ChatData_ViewShipConsolTransport vt
LEFT JOIN dbo.ChatData_ViewShipConsolLink vsc
    ON vsc.Link_ConsolNumber = vt.ConsoleNumber
LEFT JOIN dbo.ChatData_ViewRevandVolume_ShipmentDate vs
    ON vs.ShipmentNumber = vsc.Link_ShipmentNum
WHERE vt.ConLoadPortCountryName = 'Viet Nam'
    AND vt.ETD >= '2025-06-01'
    AND vt.ETD <= '2026-05-21'
    AND vt.AirlineName1 LIKE '%Turkish%'
    AND vt.TransportMode = 'AIR'
GROUP BY vt.ConsoleNumber, vt.MasterBillNum, vt.AirlineName1,
         vt.ConsolTransportMode, vt.ETD, vt.ConLoadPortCountryName,
         vt.Air_ChargebleWeight, vt.Air_ActualWeight,
         vt.Revenue_USD, vt.Cost_USD, vt.Profit_USD
ORDER BY vt.ETD DESC, vt.Revenue_USD DESC`);
                      }}
                      className="h-8 px-3 border-[#CBD5E0] text-slate-650 hover:bg-slate-50 text-xs font-medium rounded-md"
                    >
                      Reset Template
                    </Button>
                  </div>
                </div>
              )}

              {/* Console logs & feedback */}
              {sqlExecutionStatus && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>{sqlExecutionStatus}</span>
                </div>
              )}

              {sqlError && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 text-xs text-rose-700 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <span>⚠️ Database Query Error</span>
                  </p>
                  <p className="font-mono text-[10.5px] leading-relaxed break-all bg-white/70 p-2 rounded border border-rose-100">
                    {sqlError}
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── SELECTED RECIPIENTS STRIP ── */}
      {selectedEmails.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-6 mt-3 animate-in fade-in-0 duration-200">
          <div className="flex flex-wrap items-center gap-2 p-2 bg-[#EBF8FF]/50 border border-[#BEE3F8]/60 rounded-lg shadow-sm">
            <span className="text-[10px] font-bold text-[#2B6CB0] uppercase tracking-wider px-1">Selected Recipients:</span>
            {selectedEmails.map((emailOption) => (
              <Badge
                key={emailOption}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-[#CBD5E0] font-semibold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm"
              >
                <span>{emailOption}</span>
                <X
                  className="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
                  onClick={() => setSelectedEmails(selectedEmails.filter((x) => x !== emailOption))}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}
      {/* Inline Feedback Alerts */}
      {emailStatus && (
        <div className="max-w-[1400px] mx-auto px-6 mt-4">
          <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${emailSuccess === true ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-blue-50 border-blue-200 text-blue-700"}`}>
            <span>{emailStatus}</span>
            <button onClick={() => setEmailStatus("")} className="hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {/* ── FIVE FINANCIAL KPI CARDS ROW ── */}
      <div className="max-w-[1400px] mx-auto px-6 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Card 1: Revenue */}
        <div className="saas-card p-6 bg-white flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Revenue</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2 bg-slate-100" />
            ) : (
              <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1.5">
                {formatCurrency(kpi.Total_Revenue)}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 mt-2">
            <span className="text-[#3182CE] font-bold">✓ Consol Revenue</span>
          </div>
        </div>

        {/* Card 2: Cost */}
        <div className="saas-card p-6 bg-white flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cost</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2 bg-slate-100" />
            ) : (
              <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1.5">
                {formatCurrency(kpi.Total_Cost)}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 mt-2">
            <span className="text-rose-500 font-bold">✗ Total Expenses</span>
          </div>
        </div>

        {/* Card 3: Profit */}
        <div className="saas-card p-6 bg-white flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Profit</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2 bg-slate-100" />
            ) : (
              <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1.5">
                {formatCurrency(kpi.Total_Profit)}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 mt-2">
            <span className="text-emerald-600 font-bold">✓ Net Earnings</span>
          </div>
        </div>

        {/* Card 4: GP Margin */}
        <div className="saas-card p-6 bg-white flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">GP Margin</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2 bg-slate-100" />
            ) : (
              <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1.5">
                {kpi.GP_Margin ? `${kpi.GP_Margin.toFixed(1)}%` : "0.0%"}
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 mt-2">
            <span className="text-teal-600 font-bold">✓ Margin Ratio</span>
          </div>
        </div>

        {/* Card 5: Total Tonnage */}
        <div className="saas-card p-6 bg-white flex flex-col justify-between h-36 relative overflow-hidden">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Total Tonnage</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-2 bg-slate-100" />
            ) : (
              <h3 className="text-2xl font-extrabold text-[#2D3748] tracking-tight mt-1.5">
                {formatNumber(kpi.Total_Tonnage)} kg
              </h3>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-455 mt-2">
            <span className="text-indigo-600 font-bold">✈️ Active Cargo Weight</span>
          </div>
        </div>

      </div>

      {/* ── MAIN DASHBOARD CANVAS (DIVIDED SEPARATELY FOR WEEKLY & MONTHLY) ── */}
      <div className="max-w-[1400px] mx-auto px-6 mt-6 space-y-12">

        {/* ── CHAPTER 1: WEEKLY OPERATIONAL PERFORMANCE ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <span className="h-5 w-1.5 bg-[#4299E1] rounded-full animate-pulse" />
            <h2 className="text-base font-bold text-[#1A202C]">Weekly Operational Performance</h2>
            <span className="text-[10px] text-[#4299E1] bg-[#EBF8FF] font-semibold px-2 py-0.5 rounded-full border border-[#BEE3F8]">
              {getSelectedCompanyNames()}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left side (col-span-8): Weekly Revenue Trend Area Chart */}
            <div className="col-span-12 lg:col-span-8 saas-card p-6 bg-white relative">
              <div className="flex items-center justify-between mb-4 border-b border-[#F1F5F9] pb-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tonnage Flow</p>
                  <h2 className="text-lg font-bold text-[#1A202C] mt-0.5">Cargo Revenue Trend - Weekly</h2>
                </div>
                <span className="text-xs font-bold text-[#4299E1] px-2 py-0.5 rounded-full bg-[#EBF8FF] border border-[#BEE3F8]">
                  Weekly aggregation
                </span>
              </div>

              <div className="h-80 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData} margin={{ top: 15, right: 10, left: 10, bottom: 15 }}>
                      <defs>
                        <linearGradient id="visitorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4299E1" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                      <XAxis
                        dataKey="week_label"
                        tick={{ fontSize: 10, fill: "#718096", fontWeight: 500 }}
                        axisLine={{ stroke: "#E2E8F0" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#718096", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const rawData = payload[0].payload;
                          return (
                            <div className="bg-white border border-[#CBD5E0] shadow-xl p-3.5 rounded-lg text-xs space-y-1.5 min-w-[180px]">
                              <p className="font-bold text-slate-800 border-b border-[#F1F5F9] pb-1 mb-1">{label}</p>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#4299E1]" /> Revenue
                                </span>
                                <span className="text-slate-800 font-extrabold">{formatCurrency(rawData.Total_Revenue)}</span>
                              </div>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#3182CE]" /> Tonnage
                                </span>
                                <span className="text-[#3182CE] font-bold">{formatNumber(rawData.Total_Tonnage)} kg</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Total_Revenue"
                        name="Revenue"
                        stroke="#3182CE"
                        strokeWidth={2.5}
                        fill="url(#visitorAreaGrad)"
                        dot={{ fill: "#3182CE", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }}
                        activeDot={{ r: 6, fill: "#3182CE", stroke: "#FFFFFF", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right side (col-span-4): Airline wise Tonnage Chart */}
            <div className="col-span-12 lg:col-span-4 saas-card p-6 bg-white min-h-[300px] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F1F5F9]">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-[#4299E1]">Airline Carrier Tonnage</p>
                {selectedAirlines.length > 0 && (
                  <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50/50 text-[8px] font-bold px-1.5 py-0.5">
                    Selection Active
                  </Badge>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Airline wise Tonnage (kg)</h4>
                <p className="text-[10.5px] text-slate-400 leading-tight">
                  {selectedAirlines.length > 0 ? "Showing selected carrier weights" : "Showing top 10 carriers by chargeable weight"}
                </p>
              </div>

              <div className="h-56 w-full mt-4">
                {loading ? (
                  <Skeleton className="h-full bg-slate-50 rounded" />
                ) : (
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
                      <Tooltip
                        formatter={(value: any) => [`${Number(value).toLocaleString()} kg`, "Tonnage"]}
                        contentStyle={{ fontSize: "10px", borderRadius: "6px" }}
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
                )}
              </div>
            </div>
          </div>

          {/* Full-width: Carrier Metrics Table */}
          <div className="saas-card bg-white p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F1F5F9]">
              <div>
                <h4 className="text-sm font-bold text-[#1A202C]">Carrier Metrics Breakdown</h4>
                <p className="text-xs text-slate-400 mt-0.5">Showing all tracked shipping weekly consolidation volumes</p>
              </div>
              <Badge variant="outline" className="border-[#E2E8F0] text-[#3182CE] font-semibold px-2 py-0.5">
                Weekly Carrier Insights
              </Badge>
            </div>

            <div className="overflow-x-auto max-h-[350px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-slate-400 uppercase font-bold text-[10px] tracking-wider bg-slate-50/55">
                    {dashboardMode === "custom-sql" ? (
                      data.length > 0 ? (
                        Object.keys(data[0]).map((key) => (
                          <th key={key} className="px-4 py-2.5 first:rounded-l-md last:rounded-r-md">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-2.5">Custom SQL Columns</th>
                      )
                    ) : (
                      <>
                        <th className="px-4 py-2.5">Branch</th>
                        <th className="px-4 py-2.5">Airline Name</th>
                        <th className="px-4 py-2.5">Origin (From)</th>
                        <th className="px-4 py-2.5">Destination (To)</th>
                        <th className="px-4 py-2.5 text-right">Revenue (USD)</th>
                        <th className="px-4 py-2.5 text-right">Tonnage</th>
                        <th className="px-4 py-2.5 text-right">Shipments</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {dashboardMode === "custom-sql" ? (
                    data.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
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
                              className={`px-4 py-3 text-slate-700 font-medium ${
                                isNumeric ? "text-right tabular-nums" : ""
                              } ${key.toLowerCase().includes("airline") || key.toLowerCase().includes("carrier") ? "font-bold text-[#2D3748]" : ""}`}
                            >
                              {displayVal}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    data.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-500">{row.Company_Code ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold text-[#2D3748]">{row.Airline ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {row.Origin_City ? `${row.Origin_City}, ` : ""}{row.Origin_Country ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                          {row.Destination_City ? `${row.Destination_City}, ` : ""}{row.Destination_Country ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-[#3182CE] tabular-nums">
                          {row.Total_Revenue != null ? formatCurrency(row.Total_Revenue) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 font-semibold tabular-nums">
                          {row.Total_Tonnage != null ? `${formatNumber(row.Total_Tonnage)} kg` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 font-semibold tabular-nums">
                          {row.Total_Shipments != null ? formatNumber(row.Total_Shipments) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400 font-medium">
                        No consolidation records match selected filters or query
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── CHAPTER 2: MONTHLY STRATEGIC ANALYSIS ── */}
        <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
            <span className="h-5 w-1.5 bg-[#319795] rounded-full animate-pulse" />
            <h2 className="text-base font-bold text-[#1A202C]">Monthly Strategic Analysis & Contribution</h2>
            <span className="text-[10px] text-[#319795] bg-[#E6FFFA] font-semibold px-2 py-0.5 rounded-full border border-[#B2F5EA]">
              {getSelectedCompanyNames()}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Left side (col-span-8): Monthly Revenue Trend Area Chart */}
            <div className="col-span-12 lg:col-span-8 saas-card p-6 bg-white relative">
              <div className="flex items-center justify-between mb-4 border-b border-[#F1F5F9] pb-4">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Tonnage Flow</p>
                  <h2 className="text-lg font-bold text-[#1A202C] mt-0.5">Cargo Revenue Trend - Monthly</h2>
                </div>
                <span className="text-xs font-bold text-[#319795] px-2 py-0.5 rounded-full bg-[#E6FFFA] border border-[#B2F5EA]">
                  Monthly aggregation
                </span>
              </div>

              <div className="h-80 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-slate-300 animate-spin" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData} margin={{ top: 15, right: 10, left: 10, bottom: 15 }}>
                      <defs>
                        <linearGradient id="monthlyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#319795" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                      <XAxis
                        dataKey="month_label"
                        tick={{ fontSize: 10, fill: "#718096", fontWeight: 500 }}
                        axisLine={{ stroke: "#E2E8F0" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#718096", fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const rawData = payload[0].payload;
                          return (
                            <div className="bg-white border border-[#CBD5E0] shadow-xl p-3.5 rounded-lg text-xs space-y-1.5 min-w-[180px]">
                              <p className="font-bold text-slate-800 border-b border-[#F1F5F9] pb-1 mb-1">{label}</p>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#319795]" /> Revenue
                                </span>
                                <span className="text-slate-800 font-extrabold">{formatCurrency(rawData.Total_Revenue)}</span>
                              </div>
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-teal-600" /> Tonnage
                                </span>
                                <span className="text-teal-600 font-bold">{formatNumber(rawData.Total_Tonnage)} kg</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="Total_Revenue"
                        name="Revenue"
                        stroke="#319795"
                        strokeWidth={2.5}
                        fill="url(#monthlyAreaGrad)"
                        dot={{ fill: "#319795", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }}
                        activeDot={{ r: 6, fill: "#319795", stroke: "#FFFFFF", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right side (col-span-4): Enterprise Revenue by Origin (Doughnut Chart) */}
            <div className="col-span-12 lg:col-span-4 saas-card p-6 bg-white min-h-[350px] flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Origin Contribution</p>
                <div className="border-b border-[#F1F5F9] pb-2 mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Enterprise Revenue by Origin</h4>
              </div>

              <div className="relative h-40 flex items-center justify-center my-3 shrink-0">
                {loading ? (
                  <Skeleton className="h-24 w-24 rounded-full bg-slate-100" />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={doughnutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={64}
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
                      <span className="text-[10px] font-extrabold text-[#2D3748] tracking-tight mt-0.5">
                        {formatCurrency(kpi.Total_Revenue).slice(0, 7)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Doughnut Legends list */}
              <div className="space-y-2 max-h-[140px] overflow-y-auto">
                {doughnutData.slice(0, 4).map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs text-slate-655">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="font-semibold text-slate-700 truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="font-bold text-[#2D3748]">{formatCurrency(entry.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Full-width: Monthly Tonnage & Financial Summary Table */}
          <div className="saas-card bg-white p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F1F5F9]">
              <div>
                <h4 className="text-sm font-bold text-[#1A202C]">Monthly Tonnage & Financial Summary Table</h4>
                <p className="text-xs text-slate-400 mt-0.5">Dynamic monthly aggregations filtered by selected date range</p>
              </div>
              <Badge variant="outline" className="border-[#E2E8F0] text-[#319795] font-semibold px-2 py-0.5">
                Monthly Financial Metrics
              </Badge>
            </div>

            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-slate-400 uppercase font-bold text-[10px] tracking-wider bg-slate-50/55">
                    <th className="px-4 py-2.5">Year</th>
                    <th className="px-4 py-2.5">Month</th>
                    <th className="px-4 py-2.5 text-right">Revenue (USD)</th>
                    <th className="px-4 py-2.5 text-right">Tonnage</th>
                    <th className="px-4 py-2.5 text-right">Shipments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {monthlyData.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-500">{row.Year}</td>
                      <td className="px-4 py-3 font-semibold text-[#2D3748]">{row.month_label ? row.month_label.split(" '")[0] : "—"}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#319795] tabular-nums">
                        {row.Total_Revenue != null ? formatCurrency(row.Total_Revenue) : "$0"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-semibold tabular-nums">
                        {row.Total_Tonnage != null ? `${formatNumber(row.Total_Tonnage)} kg` : "0 kg"}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 font-semibold tabular-nums">
                        {row.Total_Shipments != null ? formatNumber(row.Total_Shipments) : "0"}
                      </td>
                    </tr>
                  ))}
                  {monthlyData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 font-medium">
                        No monthly records match selected date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION SELECTOR MODAL (Before PDF Preview) ── */}
      {showSectionSelector && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070b19]/60 backdrop-blur-md p-6">
          <div className="bg-white w-[600px] rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-[#4299E1]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Select PDF Report Sections</h3>
                  <p className="text-xs text-slate-500 mt-1">Unselect sections you don't need to reduce email size</p>
                </div>
              </div>
              <button
                onClick={() => setShowSectionSelector(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {/* Weekly Visual */}
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setPdfSections({...pdfSections, weeklyVisual: !pdfSections.weeklyVisual})}>
                  <input
                    type="checkbox"
                    checked={pdfSections.weeklyVisual}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPdfSections({...pdfSections, weeklyVisual: !pdfSections.weeklyVisual});
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-[#4299E1] cursor-pointer"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800">Weekly Revenue Trend Chart</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Area chart showing weekly revenue flow and airline metrics</p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">Chart</span>
                </div>

                {/* Weekly Ledger */}
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setPdfSections({...pdfSections, weeklyLedger: !pdfSections.weeklyLedger})}>
                  <input
                    type="checkbox"
                    checked={pdfSections.weeklyLedger}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPdfSections({...pdfSections, weeklyLedger: !pdfSections.weeklyLedger});
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-[#4299E1] cursor-pointer"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800">Weekly Carrier Metrics Table</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Detailed breakdown of carrier metrics by week</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-semibold">Table</span>
                </div>

                {/* Monthly Visual */}
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setPdfSections({...pdfSections, monthlyVisual: !pdfSections.monthlyVisual})}>
                  <input
                    type="checkbox"
                    checked={pdfSections.monthlyVisual}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPdfSections({...pdfSections, monthlyVisual: !pdfSections.monthlyVisual});
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-[#4299E1] cursor-pointer"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800">Monthly Financial Summary Chart</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Pie chart showing revenue distribution by company</p>
                  </div>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-semibold">Chart</span>
                </div>

                {/* Monthly Ledger */}
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setPdfSections({...pdfSections, monthlyLedger: !pdfSections.monthlyLedger})}>
                  <input
                    type="checkbox"
                    checked={pdfSections.monthlyLedger}
                    onChange={(e) => {
                      e.stopPropagation();
                      setPdfSections({...pdfSections, monthlyLedger: !pdfSections.monthlyLedger});
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-[#4299E1] cursor-pointer"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-slate-800">Monthly Financial Summary Table</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Monthly revenue, tonnage, and shipment metrics</p>
                  </div>
                  <span className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded font-semibold">Table</span>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Email Size Optimization
                </p>
                <p className="mt-1.5 leading-relaxed">
                  Unselecting sections will reduce the PDF file size. The report is limited to 100 data rows to ensure it stays within email size limits.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Sections selected: {Object.values(pdfSections).filter(Boolean).length} / 4</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowSectionSelector(false)}
                  className="h-8 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowSectionSelector(false);
                    setShowPdfPreview(true);
                  }}
                  className="h-8 px-4 bg-[#4299E1] hover:bg-[#3182CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview PDF
                </Button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── PREMIUM MODAL PDF PREVIEW WINDOW ── */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070b19]/60 backdrop-blur-md p-6">
          <div className="bg-white w-[1220px] max-h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="/images/Dart_Logo_new.webp" alt="DGL Logo" className="h-8 w-auto rounded object-contain" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#4299E1]" /> Landscape PDF Report Preview
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-400">Sending to:</span>
                    {selectedEmails.map((e) => (
                      <span key={e} className="bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-semibold text-[9px] shadow-sm">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Dynamic Inline Status Feedback inside the Modal Header */}
                {emailStatus && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                    emailSuccess === true ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                    emailSuccess === false ? "bg-rose-50 text-rose-600 border border-rose-200" :
                    "bg-blue-50 text-blue-600 border border-blue-200 animate-pulse"
                  }`}>
                    {emailLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {emailSuccess === true && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    {emailStatus.length > 32 ? emailStatus.slice(0, 32) + "..." : emailStatus}
                  </span>
                )}

                {/* Clean "Confirm & Send Email" button inside preview header when recipient is active */}
                {selectedEmails.length > 0 && !emailSuccess && (
                  <Button
                    onClick={async () => {
                      await handleSendEmail();
                      // Auto-close modal after 2.5 seconds on successful send
                      setTimeout(() => {
                        setShowPdfPreview(false);
                      }, 2500);
                    }}
                    disabled={emailLoading}
                    className="h-8 px-3.5 bg-[#4299E1] hover:bg-[#3182CE] text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all shadow-md"
                  >
                    {emailLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Confirm & Send to ({selectedEmails.length})
                  </Button>
                )}
                
                <Button
                  onClick={() => {
                    const iframe = document.getElementById("pdf-iframe") as HTMLIFrameElement;
                    if (iframe && iframe.contentWindow) {
                      iframe.contentWindow.print();
                    }
                  }}
                  className="h-8 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  Print Document
                </Button>
                <button
                  onClick={() => {
                    // Reset status when closing
                    setEmailStatus("");
                    setEmailSuccess(null);
                    setShowPdfPreview(false);
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe displaying the dedicated print-view URL dynamically with all filters */}
            <div className="flex-1 bg-slate-100 p-6 flex justify-center overflow-y-auto">
              <div className="bg-white shadow-lg rounded-md border border-slate-200 overflow-hidden w-[1125px] h-[1620px] flex-shrink-0 origin-top transform scale-[0.8] lg:scale-[0.88] xl:scale-[0.95]">
                <iframe
                  id="pdf-iframe"
                  key={`${pdfSections.weeklyVisual}-${pdfSections.weeklyLedger}-${pdfSections.monthlyVisual}-${pdfSections.monthlyLedger}`}
                  src={getPrintViewUrl()}
                  className="w-full h-full border-none"
                  title="PDF Live Snapshot Preview"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>A4 Dimensions (Landscape): 1123px × 794px</span>
              <span>Dart Global Logistics PDF Engine</span>
            </div>

          </div>
        </div>
      )}

      {/* Footer credits bar */}
      <div className="max-w-[1400px] mx-auto px-6 mt-10 border-t border-[#E2E8F0] pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400 gap-3">
        <span>Dart Global Logistics · Company Stats Dashboard</span>
        <span>© 2026 Dart Global Logistics</span>
      </div>

    </div>
  );
}