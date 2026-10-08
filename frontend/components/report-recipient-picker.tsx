"use client";

import { useId, useState } from "react";
import { Mail, Search, Send, X, RefreshCw } from "lucide-react";

export type ReportRecipient = {email: string; name: string};
export const isReportEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function ReportRecipientPicker({people, recipient, onChange, onSend, loading, directoryError, canSend, sending, reportLabel}: {
  people: ReportRecipient[]; recipient: string; onChange: (email: string) => void; onSend: () => void;
  loading: boolean; directoryError?: string; canSend: boolean; sending: boolean; reportLabel: string;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const term = search.trim().toLowerCase();
  const matches = people.filter(person => `${person.name} ${person.email}`.toLowerCase().includes(term)).slice(0, 8);
  const selected = people.find(person => person.email.toLowerCase() === recipient.toLowerCase());
  const select = (email: string) => {
    onChange(email.trim().toLowerCase());
    setSearch(""); setError(""); setOpen(false);
  };
  const selectInput = () => {
    if (isReportEmail(search.trim())) select(search);
    else if (term && matches.length === 1) select(matches[0].email);
    else setError("Select a user from the results or enter a valid email address.");
  };
  return <div data-report-recipient className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#3182CE]" /><h4 className="text-xs font-bold text-slate-800">Email this {reportLabel} report</h4></div>
    <div className="flex flex-col lg:flex-row items-start gap-3">
      <div className="w-full lg:flex-1">
        <label htmlFor={id} className="block text-[11px] font-semibold text-slate-600 mb-1.5">Recipient name or email</label>
        <div className="relative" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);}}>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input id={id} type="text" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`}
                aria-describedby={error ? `${id}-error` : undefined} aria-invalid={Boolean(error)} value={search}
                onChange={event => {setSearch(event.target.value); setError(""); setOpen(true);}}
                onFocus={() => setOpen(true)} disabled={sending}
                onKeyDown={event => {
                  if (event.key === "Enter") {event.preventDefault(); selectInput();}
                  if (event.key === "Escape") setOpen(false);
                  if (event.key === "ArrowDown") {event.preventDefault(); setOpen(true); document.getElementById(`${id}-option-0`)?.focus();}
                }}
                placeholder="Search a name or enter an email address" className="w-full h-9 pl-9 pr-3 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <button type="button" onClick={selectInput} disabled={!term || sending} className="h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap">Select recipient</button>
          </div>
          {open && <div id={`${id}-results`} role="listbox" aria-label="Matching report recipients" className="absolute z-30 top-full mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-lg max-h-64 overflow-y-auto">
            {matches.map((person, index) => <button id={`${id}-option-${index}`} type="button" role="option" aria-selected={person.email.toLowerCase() === recipient.toLowerCase()} key={person.email}
              onMouseDown={event => event.preventDefault()} onClick={() => select(person.email)} disabled={sending}
              onKeyDown={event => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault(); document.getElementById(`${id}-option-${(index + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length}`)?.focus();
                }
                if (event.key === "Escape") {document.getElementById(id)?.focus(); setOpen(false);}
              }}
              className="block w-full text-left px-3 py-2 hover:bg-[#EBF8FF] focus:bg-[#EBF8FF] focus:outline-none border-b border-slate-100 last:border-b-0">
              <span className="block text-xs font-semibold text-slate-800">{person.name}</span><span className="block text-[11px] text-slate-500">{person.email}</span>
            </button>)}
            {loading && <p role="status" className="px-3 py-2 text-xs text-slate-500">Loading users…</p>}
            {!matches.length && !loading && <p className="px-3 py-2 text-xs text-slate-500">No matching users. Enter an email address and select it.</p>}
          </div>}
        </div>
        {error && <p id={`${id}-error`} role="alert" className="text-xs text-rose-600 mt-1.5">{error}</p>}
        {directoryError && <p className="text-xs text-slate-500 mt-1.5">{directoryError}</p>}
      </div>
      <button type="button" onClick={onSend} disabled={!recipient || !isReportEmail(recipient) || !canSend || sending}
        className="lg:mt-5 h-9 px-4 bg-[#3182CE] hover:bg-[#2B6CB0] text-white text-xs font-bold rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
        {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Preview & Send Report
      </button>
    </div>
    {recipient && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><span className="font-semibold">Send to:</span>
      <span className="inline-flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5"><span>{selected?.name && selected.name !== recipient && <strong className="mr-1.5 text-slate-800">{selected.name}</strong>}<span>{recipient}</span></span>
        <button type="button" aria-label="Remove report recipient" disabled={sending} onClick={() => onChange("")} className="text-slate-400 hover:text-rose-600"><X className="w-3.5 h-3.5" /></button></span>
    </div>}
    <p className="text-[11px] text-slate-500">{canSend ? "Review the PDF and confirm sending to the selected recipient." : "Execute the current SQL query before previewing and sending this report."}</p>
  </div>;
}
