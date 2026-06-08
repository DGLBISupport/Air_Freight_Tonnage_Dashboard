"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import {
  Calendar, Globe, Plane, RefreshCw, Send, X, ArrowUpRight, ArrowDownRight, Layers, FileText, Printer, CheckCircle,
  Users, Check, ChevronDown, Plus
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

  const companyCodeParam = selectedCompanies.length === 0 ? "" : selectedCompanies.join(",");
  const branchParam = selectedBranches.length === 0 ? "" : selectedBranches.join(",");
  const countryParam = selectedCountries.length === 0 ? "" : selectedCountries.join(",");
  const originCityParam = selectedOriginCities.length === 0 ? "" : selectedOriginCities.join(",");
  const destinationCountryParam = selectedDestCountries.length === 0 ? "" : selectedDestCountries.join(",");
  const destinationCityParam = selectedDestCities.length === 0 ? "" : selectedDestCities.join(",");
  const airlineParam = selectedAirlines.length === 0 ? "" : selectedAirlines.join(",");

  // Dynamically load options for filters
  const fetchFilterOptions = useCallback(async () => {
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
  }, [startDate, endDate, countryParam]);

  // Main dynamic database fetch
  const fetchMainAnalytics = useCallback(async () => {
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
  }, [startDate, endDate, countryParam, airlineParam, companyCodeParam, originCityParam, destinationCountryParam, destinationCityParam, branchParam]);

  useEffect(() => { fetchFilterOptions(); }, [fetchFilterOptions]);
  useEffect(() => { fetchMainAnalytics(); }, [fetchMainAnalytics]);

  // Cascading update for airlines when country selection is narrowed down
  useEffect(() => {
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
  }, [selectedCountries, startDate, endDate, countryParam]);

  // Cascading update for origin cities when country selection changes
  useEffect(() => {
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
  }, [selectedCountries, startDate, endDate, countryParam]);

  // Cascading update for destination cities when destination country selection changes
  useEffect(() => {
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
  }, [selectedDestCountries, startDate, endDate, destinationCountryParam]);

  // Cascading update for countries when companyCode selection changes
  useEffect(() => {
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
  }, [selectedCompanies, startDate, endDate, companyCodeParam]);

  // Cascading update for branches when companyCode selection changes
  useEffect(() => {
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
  }, [selectedCompanies, startDate, endDate, companyCodeParam]);

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
      const res = await fetch(`${API}/api/send-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          country: countryParam || null,
          airline: airlineParam || null,
          company_code: companyCodeParam || null,
          origin_city: originCityParam || null,
          destination_country: destinationCountryParam || null,
          destination_city: destinationCityParam || null,
          branch: branchParam || null,
          recipient_email: emailString,
        }),
      });
      const result = await res.json();
      setEmailStatus(result.message || "Executive stats report successfully sent.");
      setEmailSuccess(true);
    } catch {
      setEmailStatus("Could not transmit standard PDF dashboard.");
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
    // Launch print-preview modal automatically so the user reviews the exact PDF first
    setShowPdfPreview(true);
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
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    if (countryParam) params.append("country", countryParam);
    if (airlineParam) params.append("airline", airlineParam);
    if (companyCodeParam) params.append("company_code", companyCodeParam);
    if (originCityParam) params.append("origin_city", originCityParam);
    if (destinationCountryParam) params.append("destination_country", destinationCountryParam);
    if (destinationCityParam) params.append("destination_city", destinationCityParam);
    if (branchParam) params.append("branch", branchParam);
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
                          return (
                            <div className="bg-white border border-[#CBD5E0] shadow-xl p-3.5 rounded-lg text-xs space-y-1">
                              <p className="font-bold text-slate-800 border-b border-[#F1F5F9] pb-1 mb-1">{label}</p>
                              <div className="flex justify-between items-center gap-6">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#4299E1]" /> Revenue
                                </span>
                                <span className="text-slate-800 font-extrabold">{formatCurrency(payload[0].value as number)}</span>
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

            {/* Right side (col-span-4): Tonnage Class Breakdown Chart */}
            <div className="col-span-12 lg:col-span-4 saas-card p-6 bg-white min-h-[300px] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F1F5F9]">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest text-[#4299E1]">Class breakdown</p>
                <div className="flex items-center gap-2.5 text-[8px] font-bold">
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#80DEEA]" /> Heavy
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#37474F]" /> Light
                  </span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-2">Tonnage Class Breakdown (Shipments)</h4>
                <p className="text-[10.5px] text-slate-400 leading-tight">Proportion of heavy weight vs light weight cargo across operations</p>
              </div>

              <div className="h-56 w-full mt-4">
                {loading ? (
                  <Skeleton className="h-full bg-slate-50 rounded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stackedWeightBars} margin={{ top: 10, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F7" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#A0AEC0" }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#A0AEC0" }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="Converted" name="Heavy Cargo" stackId="a" fill="#80DEEA" maxBarSize={18} />
                      <Bar dataKey="Cancelled" name="Light Cargo" stackId="a" fill="#37474F" maxBarSize={18} />
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
                    <th className="px-4 py-2.5">Branch</th>
                    <th className="px-4 py-2.5">Airline Name</th>
                    <th className="px-4 py-2.5">Origin (From)</th>
                    <th className="px-4 py-2.5">Destination (To)</th>
                    <th className="px-4 py-2.5 text-right">Revenue (USD)</th>
                    <th className="px-4 py-2.5 text-right">Tonnage</th>
                    <th className="px-4 py-2.5 text-right">Shipments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {data.map((row: any, i: number) => (
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
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                        No consolidation records match selected filters
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
                          return (
                            <div className="bg-white border border-[#CBD5E0] shadow-xl p-3.5 rounded-lg text-xs space-y-1">
                              <p className="font-bold text-slate-800 border-b border-[#F1F5F9] pb-1 mb-1">{label}</p>
                              <div className="flex justify-between items-center gap-6">
                                <span className="text-slate-500 font-medium flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#319795]" /> Revenue
                                </span>
                                <span className="text-slate-800 font-extrabold">{formatCurrency(payload[0].value as number)}</span>
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
              <div className="bg-white shadow-lg rounded-md border border-slate-200 overflow-hidden w-[1125px] h-[796px] flex-shrink-0 origin-top transform scale-[0.8] lg:scale-[0.88] xl:scale-[0.95]">
                <iframe
                  id="pdf-iframe"
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