'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { formatHrAnswersAsPolicyText, type HrPolicyAnswers } from '@/lib/hrPolicyTemplate';
import type { PolicyChangeRequest } from '@/lib/types';

export interface PolicyAccessState {
  loaded: boolean;
  hrCanEdit: boolean;
  canReview: boolean;
  isHr: boolean;
}

const STATUS: Record<PolicyChangeRequest['status'], { label: string; cls: string }> = {
  pending: { label: 'Waiting for approval', cls: 'bg-amber-50 text-amber-900 border-amber-200' },
  approved: { label: 'Approved', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  rejected: { label: 'Not approved', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function proposedText(r: PolicyChangeRequest): string {
  if (r.kind === 'structured') return formatHrAnswersAsPolicyText((r.payload.answers ?? {}) as HrPolicyAnswers);
  if (r.kind === 'document_delete') return '';
  return String(r.payload.content ?? '');
}

/**
 * The school admin's switch for letting HR propose policy changes, the list of
 * proposals waiting for a decision, and (for HR) their own proposals and what
 * became of them. Nothing HR sends changes what candidates see until the admin
 * approves it.
 */
export default function PolicyChangesPanel({
  schoolId,
  refreshKey,
  onState,
  onApplied,
}: {
  schoolId: string;
  /** Changes when the page has sent a new proposal, so this list reloads. */
  refreshKey: number;
  onState: (s: PolicyAccessState) => void;
  /** Called after an approval, so the page reloads the policies it shows. */
  onApplied: () => void;
}) {
  const [hrCanEdit, setHrCanEdit] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [isHr, setIsHr] = useState(false);
  const [requests, setRequests] = useState<PolicyChangeRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/policy-changes?school_id=${encodeURIComponent(schoolId)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'Could not load policy changes.'); return; }
      setHrCanEdit(d.hr_can_edit === true);
      setCanReview(d.can_review === true);
      setIsHr(d.is_hr === true);
      setRequests(d.requests || []);
      onState({ loaded: true, hrCanEdit: d.hr_can_edit === true, canReview: d.can_review === true, isHr: d.is_hr === true });
    } finally {
      setLoaded(true);
    }
  }, [schoolId, onState]);

  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load, refreshKey]);

  const post = async (body: Record<string, unknown>, doing: string) => {
    setBusy(doing);
    setError('');
    try {
      const res = await fetch('/api/policy-changes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, ...body }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'That did not work. Try again.'); return false; }
      await load();
      return true;
    } finally {
      setBusy('');
    }
  };

  if (!loaded) return null;
  const pending = requests.filter((r) => r.status === 'pending');
  const decided = requests.filter((r) => r.status !== 'pending').slice(0, 8);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      {canReview && (
        <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-indigo-600" checked={hrCanEdit} disabled={busy === 'access'} onChange={(e) => post({ action: 'set_access', enabled: e.target.checked }, 'access')} />
            <span>
              <strong className="text-sm text-slate-900 block">Let HR edit the school policies</strong>
              <span className="text-xs text-slate-600 leading-relaxed">HR gets this whole page and can add, change or remove policies. Every change waits for your approval, and candidates see nothing new until you approve it. The policy video stays with you.</span>
            </span>
          </label>
        </section>
      )}

      {canReview && pending.length > 0 && (
        <section className="bg-amber-50/60 border border-amber-200 rounded-3xl p-5 space-y-3" aria-label="Changes waiting for your approval">
          <h2 className="text-sm font-black text-amber-950 flex items-center gap-2"><Clock className="w-4 h-4" /> Waiting for your approval ({pending.length})</h2>
          {pending.map((r) => (
            <article key={r.id} className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3 text-xs">
              <div>
                <p className="text-sm font-bold text-slate-900">{r.summary}</p>
                <p className="text-[11px] text-slate-500">Proposed by {r.requested_by.name}, {new Date(r.requested_at).toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {r.before && (
                  <div className="space-y-1"><p className="font-extrabold uppercase text-[10px] text-slate-500">Now</p><pre className="whitespace-pre-wrap font-sans text-slate-700 p-3 rounded-xl bg-slate-50 border border-slate-100 max-h-48 overflow-y-auto">{r.before.title}{'\n\n'}{r.before.content}</pre></div>
                )}
                {r.kind !== 'document_delete' ? (
                  <div className="space-y-1"><p className="font-extrabold uppercase text-[10px] text-emerald-700">{r.before ? 'Proposed' : 'Proposed text'}</p><pre className="whitespace-pre-wrap font-sans text-slate-800 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 max-h-48 overflow-y-auto">{typeof r.payload.title === 'string' ? `${r.payload.title}\n\n` : ''}{proposedText(r)}</pre></div>
                ) : (
                  <p className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-900">This policy would be removed. Candidates would no longer see it or need to accept it.</p>
                )}
              </div>
              <input value={notes[r.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} placeholder="A note for HR (optional)" maxLength={300} className="w-full p-2.5 rounded-xl border border-slate-200 text-xs" />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} onClick={async () => { if (await post({ action: 'decide', id: r.id, decision: 'approve', note: notes[r.id] }, r.id)) onApplied(); }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Approve and apply
                </button>
                <button type="button" disabled={!!busy} onClick={() => post({ action: 'decide', id: r.id, decision: 'reject', note: notes[r.id] }, r.id)} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {isHr && (
        <section className={`rounded-3xl p-5 space-y-3 border ${hrCanEdit ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-600" /> {hrCanEdit ? 'You can edit the policies, with approval' : 'Policies are managed by your school admin'}</h2>
          <p className="text-xs text-slate-700 leading-relaxed">
            {hrCanEdit
              ? 'Make your changes below and save. They are sent to the school admin, and candidates only see them once the admin approves. The policy video is managed by the admin.'
              : 'Your school admin has not turned on policy editing for HR. Ask them to switch on "Let HR edit the school policies" on this page.'}
          </p>
          {requests.length > 0 && (
            <ul className="space-y-2">
              {requests.slice(0, 10).map((r) => (
                <li key={r.id} className="bg-white border border-slate-200 rounded-2xl p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0"><strong className="text-slate-900 block truncate">{r.summary}</strong>{r.note && <span className="text-slate-600">Admin: {r.note}</span>}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full border font-bold text-[10px] ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                    {r.status === 'pending' && <button type="button" disabled={!!busy} onClick={() => post({ action: 'withdraw', id: r.id }, r.id)} className="text-[11px] font-bold text-slate-600 underline cursor-pointer">Withdraw</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canReview && decided.length > 0 && (
        <details className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs">
          <summary className="font-bold text-slate-700 cursor-pointer">Recent decisions ({decided.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {decided.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-slate-800">{r.summary} <span className="text-slate-500">({r.requested_by.name})</span></span><span className={`px-2 py-0.5 rounded-full border font-bold text-[10px] ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
