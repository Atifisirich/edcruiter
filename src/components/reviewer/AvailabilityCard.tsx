'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import { Badge, Card, CardHeader, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import { cutIntoSlots } from '@/lib/availability';
import type { AvailabilitySlot } from '@/lib/types';

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
function pad(n: number) { return String(n).padStart(2, '0'); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Where a reviewer says when they are free for interviews. HR sees these times
 * when booking, so a candidate is only ever put into a time the reviewer chose.
 */
export default function AvailabilityCard({ schoolId }: { schoolId: string }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState(today());
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('12:00');
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/availability?school_id=${encodeURIComponent(schoolId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSlots(data.slots || []);
    } finally {
      setLoaded(true);
    }
  }, [schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
    void load();
  }, [load]);

  const add = async () => {
    setError('');
    setNotice('');
    const start = new Date(`${date}T${from}`);
    const end = new Date(`${date}T${to}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('Choose a date, and a finishing time after the starting time.');
      return;
    }
    const pieces = cutIntoSlots(start, end, minutes);
    if (pieces.length === 0) {
      setError(`That stretch is shorter than one ${minutes}-minute interview.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, slots: pieces }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save your free times.'); return; }
      setNotice(`Added ${pieces.length} free ${pieces.length === 1 ? 'time' : 'times'}. HR can now book you into ${pieces.length === 1 ? 'it' : 'them'}.`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setError('');
    const res = await fetch(`/api/availability?school_id=${encodeURIComponent(schoolId)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error || 'Could not remove that time.'); return; }
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Grouped by day, earliest first.
  const days: { day: string; items: AvailabilitySlot[] }[] = [];
  for (const s of slots) {
    const d = dayLabel(s.start);
    const last = days[days.length - 1];
    if (last && last.day === d) last.items.push(s); else days.push({ day: d, items: [s] });
  }

  return (
    <Card>
      <CardHeader
        title="Your free times for interviews"
        description="Tell HR when you are free. They book a candidate into one of these times, and you are told here in the app."
      />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
        <label className="block text-sm font-medium text-slate-700 col-span-2 sm:col-span-1">Day
          <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">From
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">To
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Each interview
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={`${selectClass} mt-1 w-full`}>
            {[20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void add()} disabled={busy} className={`${buttonClass('primary')} col-span-2 sm:col-span-1`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add times
        </button>
      </div>
      <p className="text-sm text-slate-500 mt-2">For example 10:00 to 12:00 with 30 minutes gives four times HR can book.</p>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}

      <div className="mt-5">
        {!loaded ? (
          <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ) : days.length === 0 ? (
          <p className="text-sm text-slate-500 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-slate-400" /> No free times added yet.</p>
        ) : (
          <div className="space-y-4">
            {days.map((d) => (
              <div key={d.day}>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">{d.day}</p>
                <ul className="flex flex-wrap gap-2">
                  {d.items.map((s) => (
                    <li key={s.id} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${s.status === 'booked' ? 'border-indigo-200 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-800'}`}>
                      {timeLabel(s.start)} to {timeLabel(s.end)}
                      {s.status === 'booked' ? (
                        <Badge tone="indigo">Booked</Badge>
                      ) : (
                        <button type="button" onClick={() => void remove(s.id)} aria-label={`Remove ${timeLabel(s.start)} on ${d.day}`} className="text-slate-400 hover:text-rose-600 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
