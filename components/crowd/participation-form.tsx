"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { setCrowdParticipation } from "@/app/students/[id]/crowd-actions";
import type { ParticipationStatus } from "@/lib/crowd/data";

export default function ParticipationForm({ timetables, initialStatus }: {
  timetables: { id: string; name: string }[]; initialStatus: ParticipationStatus;
}) {
  const timetableId = useId();
  const [status, setStatus] = useState(initialStatus);
  const [selected, setSelected] = useState(initialStatus.timetableId ?? timetables[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date(initialStatus.checkedAt ?? "1970-01-01T00:00:00Z").getTime());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const active = status.expiresAt && new Date(status.expiresAt).getTime() > now;
  const submit = (stop: boolean) => {
    setMessage("");
    startTransition(async () => {
      const result = await setCrowdParticipation(stop ? { action: "stop" } : { action: "join", timetableId: selected, confirmed });
      setMessage(result.message);
      if (result.success && result.status) { setStatus(result.status); setConfirmed(false); }
    });
  };
  return <section className="space-y-4 rounded-lg border-2 border-primary/20 bg-white p-5" aria-label="Voluntary crowd participation">
    <h2 className="text-lg font-semibold text-primary">Optional crowd estimation</h2>
    <p className="text-sm text-slate-700">Share one selected timetable with our server-side crowd estimation model for the next seven days (168 hours). It contributes to aggregated building activity levels, not individual tracking. No location history is collected. Simulation uses separate fictional timetables.</p>
    <p className="text-sm text-slate-800" role="status">{!status.available ? status.message : active ? `Participating until ${new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", dateStyle: "medium", timeStyle: "short" }).format(new Date(status.expiresAt!))} Melbourne time.` : status.expiresAt ? "Participation expired. Renew only if this timetable still applies to the coming week." : "Not participating. Uploading a timetable does not automatically opt you in."}</p>
    <div className="text-sm font-medium text-slate-800"><label htmlFor={timetableId}>Timetable to share</label>
      <select id={timetableId} value={selected} disabled={!status.available || pending} onChange={e => { setSelected(e.target.value); setConfirmed(false); }} className="mt-1 w-full rounded border border-slate-300 bg-white p-2">
        {timetables.length === 0 && <option value="">Save a timetable first</option>}
        {timetables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirmed} disabled={!status.available || pending || !selected} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />I confirm this timetable applies to the coming week and voluntarily agree to use it for aggregated crowd estimates for seven days.</label>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={!status.available || !selected || !confirmed || pending} onClick={() => submit(false)} className="rounded bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">{pending ? "Saving…" : "Confirm seven-day participation"}</button>
      <button type="button" disabled={!status.available || !status.timetableId || pending} onClick={() => submit(true)} className="rounded border border-slate-400 px-4 py-2 text-sm text-slate-800 disabled:opacity-50">Stop participation</button>
    </div>
    {message && <p role="status" className="text-sm text-slate-800">{message}</p>}
    <p className="text-xs text-slate-600">Changing the selection takes effect only after confirmation. Switching replaces your previous participating timetable. Stopping or expiry does not delete your saved classes.</p>
    <Link href="/map" className="text-sm text-blue-800 underline">View estimated crowd activity on the map</Link>
  </section>;
}
