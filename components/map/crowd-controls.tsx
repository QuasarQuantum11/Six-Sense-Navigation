"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import Link from "next/link";
import L from "leaflet";
import type { CrowdLevel, CrowdMode, CrowdResponse } from "@/lib/crowd/types";

const labels: Record<CrowdLevel, string> = { low: "Low estimate", medium: "Medium estimate", high: "High estimate", unknown: "Unable to estimate" };
const colors: Record<CrowdLevel, string> = { low: "#0f766e", medium: "#a16207", high: "#b91c1c", unknown: "#64748b" };

function localDateTime() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const value = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, time: `${value("hour")}:${value("minute")}` };
}

export default function CrowdControls({ mapRef, canView }: { mapRef: RefObject<L.Map | null>; canView: boolean }) {
  const sourceId = useId();
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<CrowdMode>("real");
  const [current, setCurrent] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CrowdResponse | null>(null);
  const [error, setError] = useState("");
  const clear = () => { setResult(null); setError(""); };

  useEffect(() => {
    if (!enabled || !canView) return;
    const controller = new AbortController();
    const body = mode === "real" && current ? { mode } : { mode, date, time };
    fetch("/api/crowd-estimates", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(body), signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load estimates.");
        if (!controller.signal.aborted) setResult(data);
      }).catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load estimates.");
      });
    return () => controller.abort();
  }, [enabled, canView, mode, current, date, time, revision]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled || !result) return;
    const group = L.layerGroup().addTo(map);
    result.buildings.forEach(building => {
      const tooltip = document.createElement("span");
      tooltip.textContent = `${building.name}: ${labels[building.level]}${result.mode === "demo" ? " (simulated)" : ""}`;
      L.circle([building.latitude, building.longitude], { radius: building.radiusMeters, color: colors[building.level], fillOpacity: 0.16, weight: 2, bubblingMouseEvents: false }).bindTooltip(tooltip).addTo(group);
    });
    return () => { group.remove(); };
  }, [enabled, result, mapRef]);

  return (
    <section className="mt-4 space-y-3 rounded-lg border border-slate-200 p-3" aria-label="Estimated crowd controls">
      <h3 className="font-semibold text-slate-900">Estimated crowd activity</h3>
      <p className="text-xs text-slate-600">Timetable-based estimates around outdoor buildings. These are not live counts. Routes stay unchanged.</p>
      {!canView ? <Link href="/login" className="text-sm text-blue-800 underline">Sign in to view estimates</Link> : <>
        <label className="flex items-center gap-2 text-sm text-slate-800"><input type="checkbox" checked={enabled} onChange={e => { clear(); setEnabled(e.target.checked); }} />Show estimated crowd activity</label>
        {enabled && <>
          <div className="text-sm text-slate-800"><label htmlFor={sourceId}>Data source</label>
            <select id={sourceId} value={mode} onChange={e => {
              const next = e.target.value as CrowdMode;
              const local = localDateTime(); clear(); setMode(next); setCurrent(next === "real");
              setDate(next === "demo" ? "2026-10-07" : local.date); setTime(next === "demo" ? "10:00" : local.time);
            }} className="mt-1 w-full rounded border border-slate-300 bg-white p-2">
              <option value="real">Real voluntary timetable samples</option>
              <option value="demo">Simulated AI-assisted timetables</option>
            </select>
          </div>
          <p className={`sticky top-0 z-10 rounded p-2 text-sm font-semibold ${mode === "demo" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`} role="note">
            {mode === "demo" ? "SIMULATED DATA — fictional students. This tests our model, not actual campus crowd predictions." : "REAL SAMPLES — voluntarily shared timetables. Estimated activity, not live measurements."}
          </p>
          {mode === "real" && <label className="flex gap-2 text-sm text-slate-800"><input type="checkbox" checked={current} onChange={e => { const local = localDateTime(); clear(); setCurrent(e.target.checked); setDate(local.date); setTime(local.time); }} />Use current Melbourne time</label>}
          {!(mode === "real" && current) && <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-800">Melbourne date<input type="date" value={date} readOnly={mode === "demo"} onChange={e => { clear(); setDate(e.target.value); }} className="mt-1 w-full rounded border border-slate-300 p-1" /></label>
            <label className="text-xs text-slate-800">Melbourne time<input type="time" value={time} onChange={e => { clear(); setTime(e.target.value); }} className="mt-1 w-full rounded border border-slate-300 p-1" /></label>
          </div>}
          <button type="button" onClick={() => { clear(); setRevision(r => r + 1); }} className="w-full rounded border border-blue-700 p-2 text-sm text-blue-800">Refresh crowd estimates</button>
          <div aria-live="polite" className="space-y-2">
            {!result && !error && <p className="text-sm text-slate-600">Loading estimates…</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {result && <>
              <p className="text-xs text-slate-700">{result.sourceLabel}<br />Estimate for {new Intl.DateTimeFormat("en-AU", { timeZone: result.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(result.at))}<br />Last requested: {new Intl.DateTimeFormat("en-AU", { timeZone: result.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(result.generatedAt))}</p>
              {result.notices.filter(notice => !notice.startsWith("SIMULATED DATA:")).map(notice => <p key={notice} className="text-xs text-slate-600">{notice}</p>)}
              <ul className="space-y-2" aria-label="Building crowd estimates">
                {result.buildings.map(building => <li key={building.id}>
                  <button type="button" onClick={() => {
                    const map = mapRef.current;
                    if (!map) return;
                    map.setView([building.latitude, building.longitude], 17, { animate: false });
                    if (window.innerWidth >= 640) map.panBy([-180, 0], { animate: false });
                    else map.panBy([0, -map.getSize().y * 0.25], { animate: false });
                  }} className="flex w-full items-start gap-2 rounded border border-slate-200 p-2 text-left text-xs text-slate-800">
                    <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[building.level] }} />
                    <span>{building.name}<br /><strong>{labels[building.level]}</strong></span>
                  </button>
                </li>)}
              </ul>
              {result.buildings.length === 0 && <p className="text-sm text-slate-600">No located campus buildings are available.</p>}
            </>}
          </div>
          <p className="text-xs text-slate-600">Updates run only when requested. Use Refresh for a new snapshot.</p>
          <Link href="/privacy" className="text-xs text-blue-800 underline">Participation and privacy details</Link>
        </>}
      </>}
    </section>
  );
}
