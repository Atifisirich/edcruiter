'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, ChevronDown, Download, Loader2, Merge, Pause, PhoneCall, Play, RotateCcw, Save, Settings2, Upload, UserCheck, UserX,
} from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import ScreeningSetup from '@/components/admin/leads/ScreeningSetup';
import LeadUploadDialog from '@/components/admin/leads/LeadUploadDialog';
import type { LeadList, LeadStatus } from '@/lib/types';

type Row = { id: string; name: string; phone: string; email: string; subject: string; status: LeadStatus; status_label: string; reason?: string; invited?: boolean; summary?: string; called_at?: string; calls: number };
type Report = { total: number; waiting: number; calling: number; good_fit: number; moved: number; invited: number; needs_look: number; set_aside: number; answered: number; called: number; reasons: { key: string; text: string; count: number; status: 'set_aside' | 'needs_look' }[]; spent_inr: number; minutes: number; progress: number };
type View = { list: LeadList; rows: Row[]; report: Report; estimate: { calls: number; cost_inr: number; hours: number; days: number }; price_per_min_inr: number; mode: 'live' | 'demo' };

type Tab = 'good' | 'look' | 'aside' | 'queue' | 'all';
const TABS: { key: Tab; label: string; match: (s: LeadStatus) => boolean }[] = [
  { key: 'good', label: 'Good fits', match: (s) => s === 'moved' || s === 'good_fit' },
  { key: 'look', label: 'Need a look', match: (s) => s === 'needs_look' },
  { key: 'aside', label: 'Set aside', match: (s) => s === 'set_aside' },
  { key: 'queue', label: 'Still to call', match: (s) => s === 'waiting' || s === 'calling' },
  { key: 'all', label: 'Everyone', match: () => true },
];
const PILL: Record<LeadStatus, string> = {
  moved: 'bg-emerald-100 text-emerald-800', good_fit: 'bg-emerald-100 text-emerald-800', needs_look: 'bg-amber-100 text-amber-900',
  set_aside: 'bg-slate-200 text-slate-700', waiting: 'bg-slate-100 text-slate-600', calling: 'bg-indigo-100 text-indigo-800',
};

function Metric({ value, label, tone, hint }: { value: string | number; label: string; tone: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className={`text-3xl font-black tracking-tight ${tone}`}>{value}</p>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

/** One lead list: set up the screening, then watch the results come in and act on them. */
export default function LeadListPage() {
  const { id } = useParams<{ id: string }>();
  const { schoolId, toast } = useAdmin();
  const [view, setView] = useState<View | null>(null);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [others, setOthers] = useState<{ id: string; name: string; status: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('good');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState(false);
  const [upload, setUpload] = useState<{ added: number; skipped: { name: string; phone: string; why: string }[] } | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [more, setMore] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/lead-lists/${encodeURIComponent(id)}?school_id=${encodeURIComponent(schoolId)}`);
    if (r.ok) setView(await r.json());
  }, [id, schoolId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
      fetch(`/api/lead-lists?school_id=${encodeURIComponent(schoolId)}`).then((r) => r.json()).then((d) => {
        setTemplates(d.templates ?? []);
        setOthers((d.lists ?? []).filter((l: { id: string }) => l.id !== id));
      }).catch(() => {});
      try {
        const saved = sessionStorage.getItem(`lead-upload-${id}`);
        if (saved) { setUpload(JSON.parse(saved)); sessionStorage.removeItem(`lead-upload-${id}`); }
      } catch { /* not needed */ }
    }, 0);
    return () => clearTimeout(t);
  }, [load, id, schoolId]);

  // While calling, the numbers update every few seconds.
  const running = view?.list.status === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const rows = useMemo(() => (view ? view.rows.filter((r) => TABS.find((t) => t.key === tab)!.match(r.status)) : []), [view, tab]);

  const act = async (action: string, body: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const r = await fetch(`/api/lead-lists/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, action, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Could not do that.', 'error'); return; }
      setView(d);
      if (action === 'save_template') toast('Saved. Pick it next time under “Who are you looking for?”.', 'success');
      if (action === 'merge') toast('Lists merged.', 'success');
    } finally { setBusy(''); setMore(false); }
  };

  const bulk = async (action: 'move' | 'set_aside' | 'recall' | 'decline') => {
    const ids = [...picked];
    if (!ids.length) return;
    if (action === 'decline' && !window.confirm(`Send a polite “not this time” message to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}? Each is told once.`)) return;
    setBusy(action);
    try {
      const r = await fetch(`/api/lead-lists/${id}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, action, lead_ids: ids }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Could not do that.', 'error'); return; }
      toast(d.message, 'success');
      setView(d.view);
      setPicked(new Set());
    } finally { setBusy(''); }
  };

  if (!view) return <div className="space-y-4"><div className="h-10 w-64 rounded-xl bg-slate-100 animate-pulse" /><div className="h-64 rounded-3xl bg-slate-100 animate-pulse" /></div>;
  const { list, report } = view;
  const waiting = report.waiting + report.calling;
  const showSetup = !list.setup || editing || (list.status === 'setup' && !list.started_at);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/leads" className="text-xs font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Lead screening</Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{list.name}</h1>
          <p className="text-sm text-slate-500">{report.total} {report.total === 1 ? 'lead' : 'leads'}{list.setup ? <> · Good fit: <span className="text-slate-800 font-medium">{list.setup.good_fit}</span></> : ''}</p>
        </div>
        {!showSetup && (
          <div className="flex flex-wrap items-center gap-2">
            {list.status === 'running' ? (
              <button type="button" onClick={() => void act('pause')} disabled={!!busy} className={buttonClass('secondary')}><Pause className="w-4 h-4" /> Pause calls</button>
            ) : waiting > 0 && (
              <button type="button" onClick={() => void act('resume')} disabled={!!busy} className={buttonClass('primary')}><Play className="w-4 h-4" /> {list.started_at ? 'Resume calls' : 'Start calls'}</button>
            )}
            <button type="button" onClick={() => setAdding(true)} className={buttonClass('secondary')}><Upload className="w-4 h-4" /> Add people</button>
            <div className="relative">
              <button type="button" onClick={() => setMore((m) => !m)} className={buttonClass('ghost')} aria-expanded={more}>More <ChevronDown className="w-4 h-4" /></button>
              {more && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-20 text-sm">
                  {list.status !== 'running' && <button type="button" onClick={() => { setEditing(true); setMore(false); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"><Settings2 className="w-4 h-4" /> Change the screening</button>}
                  <button type="button" onClick={() => { const n = window.prompt('Name for this saved screening', list.setup?.good_fit.slice(0, 60)); if (n) void act('save_template', { name: n }); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"><Save className="w-4 h-4" /> Save screening to reuse</button>
                  <a href={`/api/lead-lists/${id}/export?school_id=${encodeURIComponent(schoolId)}`} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" /> Download as Excel (CSV)</a>
                  {others.filter((o) => o.status !== 'running').map((o) => (
                    <button key={o.id} type="button" onClick={() => { if (window.confirm(`Bring everyone from “${o.name}” into this list? That list is then removed; nobody is deleted.`)) void act('merge', { from_id: o.id }); }} className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2"><Merge className="w-4 h-4" /> Merge in “{o.name}”</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {upload && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-950">
          <p className="font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {upload.added} {upload.added === 1 ? 'person' : 'people'} added.{upload.skipped.length ? ` ${upload.skipped.length} skipped.` : ''}</p>
          {upload.skipped.length > 0 && (
            <>
              <button type="button" onClick={() => setShowSkipped((s) => !s)} className="text-xs font-bold underline mt-1 cursor-pointer">{showSkipped ? 'Hide' : 'See'} who was skipped and why</button>
              {showSkipped && (
                <ul className="mt-2 max-h-48 overflow-y-auto text-xs space-y-0.5">
                  {upload.skipped.map((s, i) => <li key={i}>{s.name} {s.phone && `(${s.phone})`}: {s.why}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {showSetup ? (
        <ScreeningSetup
          schoolId={schoolId}
          list={list}
          waiting={waiting}
          estimate={view.estimate}
          templates={templates}
          mode={view.mode}
          onSaved={(v, started) => { setView(v as View); setEditing(false); setTab(started ? 'queue' : 'good'); if (started) toast('Screening started. Results appear here as calls finish.', 'success'); }}
          onCancel={list.setup ? () => setEditing(false) : undefined}
        />
      ) : (
        <>
          {list.status === 'running' && (
            <div className="rounded-2xl bg-indigo-600 text-white px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-2 font-bold"><PhoneCall className="w-4 h-4 animate-pulse" /> Calling now</span>
              <span>{report.calling} on a call · {report.waiting} waiting</span>
              {view.mode === 'demo' && <span className="text-indigo-100">Demo mode: no real calls</span>}
            </div>
          )}
          {list.note && <p className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-950">{list.note}</p>}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Metric value={`${report.progress}%`} label="Screened" tone="text-indigo-600" hint={`${report.called} called · ${report.answered} picked up`} />
            <Metric value={report.good_fit} label="Good fits" tone="text-emerald-600" hint={`${report.moved} in Candidates${report.invited ? ` · ${report.invited} sent the test` : ''}`} />
            <Metric value={report.needs_look} label="Need a look" tone="text-amber-600" hint="Waiting for you" />
            <Metric value={report.set_aside} label="Set aside" tone="text-slate-500" hint="Kept, with the reason" />
            <Metric value={view.mode === 'demo' ? '₹0' : `₹${report.spent_inr.toLocaleString('en-IN')}`} label="Spent" tone="text-slate-900" hint={`${report.minutes} call minutes`} />
          </div>

          {report.reasons.length > 0 && (
            <section className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3">
              <h2 className="text-base font-black text-slate-900">Why people did not pass</h2>
              <ul className="space-y-2">
                {report.reasons.slice(0, 8).map((r) => {
                  const top = report.reasons[0].count || 1;
                  return (
                    <li key={`${r.status}|${r.key}`} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[16rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                      <span className="text-slate-700 truncate">{r.text}</span>
                      <span className="hidden sm:block h-2.5 rounded-full bg-slate-100 overflow-hidden"><span className={`block h-full ${r.status === 'set_aside' ? 'bg-slate-400' : 'bg-amber-400'}`} style={{ width: `${Math.max(4, (r.count / top) * 100)}%` }} /></span>
                      <span className="font-black text-slate-900 tabular-nums">{r.count}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="flex gap-1 overflow-x-auto px-3 pt-3 border-b border-slate-200" role="tablist">
              {TABS.map((t) => {
                const n = view.rows.filter((r) => t.match(r.status)).length;
                return (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setPicked(new Set()); }}
                    className={`shrink-0 px-3 py-2 text-sm font-semibold border-b-2 -mb-px cursor-pointer ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                    {t.label} <span className="ml-1 text-xs text-slate-400">{n}</span>
                  </button>
                );
              })}
            </div>

            {tab !== 'good' && rows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-sm">
                <button type="button" onClick={() => setPicked(picked.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))} className="font-semibold text-slate-700 cursor-pointer">
                  {picked.size === rows.length ? 'Clear' : `Select all ${rows.length}`}
                </button>
                {picked.size > 0 && <span className="text-slate-500">{picked.size} selected:</span>}
                {picked.size > 0 && (tab === 'look' || tab === 'aside') && (
                  <button type="button" onClick={() => void bulk('move')} disabled={!!busy} className={buttonClass('primary', 'sm')}><UserCheck className="w-4 h-4" /> Move to Candidates</button>
                )}
                {picked.size > 0 && (tab === 'look' || tab === 'queue') && (
                  <button type="button" onClick={() => void bulk('set_aside')} disabled={!!busy} className={buttonClass('secondary', 'sm')}><UserX className="w-4 h-4" /> Set aside</button>
                )}
                {picked.size > 0 && tab === 'aside' && (
                  <>
                    <button type="button" onClick={() => void bulk('recall')} disabled={!!busy} className={buttonClass('secondary', 'sm')}><RotateCcw className="w-4 h-4" /> Call again</button>
                    <button type="button" onClick={() => void bulk('decline')} disabled={!!busy} className={buttonClass('ghost', 'sm')}>Send polite decline</button>
                  </>
                )}
                {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
              </div>
            )}

            {rows.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                {tab === 'good' ? 'Good fits appear here as calls finish. They also go straight into Candidates.' : tab === 'look' ? 'Nobody needs a look right now.' : tab === 'aside' ? 'Nobody set aside yet.' : 'Nobody left to call.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.slice(0, 300).map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    {tab !== 'good' && (
                      <input type="checkbox" checked={picked.has(r.id)} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })}
                        className="mt-1.5 w-4 h-4 accent-indigo-600" aria-label={`Select ${r.name}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link href={`/admin/candidates/${r.id}`} className="font-bold text-slate-900 hover:text-indigo-700">{r.name}</Link>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${PILL[r.status]}`}>{r.status === 'moved' && r.invited ? 'In Candidates · test sent' : r.status_label}</span>
                        <span className="text-xs text-slate-500">{[r.phone, r.subject].filter(Boolean).join(' · ')}</span>
                      </div>
                      {r.reason && <p className="text-sm text-slate-700 mt-0.5">{r.reason}</p>}
                      {r.summary && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.summary}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {rows.length > 300 && <p className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">Showing 300 of {rows.length}. Download the list for everyone.</p>}
          </section>
        </>
      )}

      {adding && (
        <LeadUploadDialog
          schoolId={schoolId}
          listId={id}
          onClose={() => setAdding(false)}
          onDone={(r) => { setAdding(false); setUpload({ added: r.added, skipped: r.skipped }); void load(); }}
        />
      )}
    </div>
  );
}
