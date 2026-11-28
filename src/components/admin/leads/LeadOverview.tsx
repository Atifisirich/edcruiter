'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export type LeadListRow = {
  id: string; name: string; status: 'setup' | 'running' | 'paused' | 'done'; total: number; good_fit: number; needs_look: number;
  set_aside: number; waiting: number; progress: number; created_at: string; has_setup: boolean; good_fit_text?: string; note?: string;
  called: number; answered: number; calls_made: number; created_by: string;
};

const STATUS: Record<LeadListRow['status'], { label: string; cls: string }> = {
  setup: { label: 'Not started', cls: 'bg-amber-100 text-amber-900' },
  running: { label: 'Calling now', cls: 'bg-indigo-100 text-indigo-800' },
  paused: { label: 'Paused', cls: 'bg-slate-200 text-slate-700' },
  done: { label: 'Finished', cls: 'bg-emerald-100 text-emerald-800' },
};

type Filter = 'all' | LeadListRow['status'];

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/**
 * Lead screening at a glance: one set of totals across every upload, then each
 * upload as a line under the day it was added, so it is clear what was done
 * when, and which lists still need doing.
 */
export default function LeadOverview({ lists }: { lists: LeadListRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const sum = (key: 'total' | 'good_fit' | 'needs_look' | 'set_aside' | 'waiting' | 'called' | 'answered' | 'calls_made') => lists.reduce((n, l) => n + l[key], 0);
  const totals = [
    { label: 'Leads uploaded', value: sum('total'), note: `in ${lists.length} ${lists.length === 1 ? 'upload' : 'uploads'}`, cls: 'text-slate-900' },
    { label: 'Calls made', value: sum('calls_made'), note: `${sum('called')} people called, ${sum('answered')} answered`, cls: 'text-indigo-700' },
    { label: 'Good fit', value: sum('good_fit'), note: 'moved or ready to move', cls: 'text-emerald-700' },
    { label: 'Need a look', value: sum('needs_look'), note: 'waiting for you', cls: 'text-amber-700' },
    { label: 'Set aside', value: sum('set_aside'), note: 'not a fit', cls: 'text-slate-500' },
    { label: 'Still to call', value: sum('waiting'), note: 'no result yet', cls: 'text-slate-900' },
  ];

  const shown = [...lists].filter((l) => filter === 'all' || l.status === filter).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const days = shown.reduce<[string, LeadListRow[]][]>((out, l) => {
    const d = day(l.created_at);
    const last = out[out.length - 1];
    if (last && last[0] === d) last[1].push(l);
    else out.push([d, [l]]);
    return out;
  }, []);
  const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'All' }, ...(Object.keys(STATUS) as LeadListRow['status'][]).map((k) => ({ key: k, label: STATUS[k].label }))];

  return (
    <div className="space-y-5">
      <section aria-label="All uploads together" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {totals.map((t) => (
          <div key={t.label} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.label}</p>
            <p className={`mt-1 text-3xl font-bold tabular-nums ${t.cls}`}>{t.value}</p>
            <p className="text-[11px] text-slate-500 leading-snug">{t.note}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show uploads">
        {filters.map((f) => {
          const n = f.key === 'all' ? lists.length : lists.filter((l) => l.status === f.key).length;
          return (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${filter === f.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-700'}`}>
              {f.label} ({n})
            </button>
          );
        })}
      </div>

      {days.length === 0 && <p className="text-sm text-slate-500">No uploads here.</p>}

      {days.map(([d, group]) => (
        <section key={d} aria-label={`Uploaded ${d}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Uploaded {d}</h2>
          <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
            {group.map((l) => (
              <li key={l.id}>
                <Link href={`/admin/leads/${l.id}`} className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_auto] md:items-center px-4 py-3.5 hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 truncate">{l.name}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS[l.status].cls}`}>{l.status === 'setup' && l.has_setup ? 'Ready to start' : STATUS[l.status].label}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">{time(l.created_at)} by {l.created_by} · {l.good_fit_text || 'screening not set up yet'}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${l.progress}%` }} /></div>
                    <p className="mt-1 text-[11px] text-slate-500">{l.note || `${l.progress}% screened`}</p>
                  </div>
                  <dl className="grid grid-cols-5 gap-2 text-center">
                    {[
                      ['Leads', l.total, 'text-slate-900'],
                      ['Called', l.called, 'text-indigo-700'],
                      ['Good fit', l.good_fit, 'text-emerald-700'],
                      ['Need a look', l.needs_look, 'text-amber-700'],
                      ['Set aside', l.set_aside, 'text-slate-500'],
                    ].map(([label, n, cls]) => (
                      <div key={label as string}>
                        <dd className={`text-lg font-bold tabular-nums ${cls}`}>{n}</dd>
                        <dt className="text-[10px] text-slate-500 leading-tight">{label}</dt>
                      </div>
                    ))}
                  </dl>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 justify-self-end">Open <ArrowRight className="w-3.5 h-3.5" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
