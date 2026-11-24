'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Hourglass, Loader2, Wallet, XCircle } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import type { PayInfo } from '@/lib/payFlow';
import { checkOffer } from '@/lib/payGuide';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface PayResponse { info: PayInfo; can_decide: boolean; can_approve: boolean; can_note: boolean }

/** Where a figure sits on the range, as a bar: the range itself, the ideal, what the teacher asked for, and the offer. */
function RangeBar({ min, ideal, max, ask, offer }: { min: number; ideal: number; max: number; ask?: number | null; offer?: number | null }) {
  const values = [min, max, ask ?? min, offer ?? min];
  const low = Math.min(...values) * 0.9;
  const high = Math.max(...values) * 1.08;
  const at = (n: number) => `${Math.max(0, Math.min(100, ((n - low) / (high - low)) * 100))}%`;
  return (
    <div className="relative h-12" aria-hidden="true">
      <div className="absolute top-5 h-2.5 rounded-full bg-slate-100 left-0 right-0" />
      <div className="absolute top-5 h-2.5 rounded-full bg-emerald-200" style={{ left: at(min), width: `calc(${at(max)} - ${at(min)})` }} />
      <div className="absolute top-4 w-0.5 h-4.5 bg-emerald-700" style={{ left: at(ideal), height: '1.1rem' }} />
      {ask ? <div className="absolute top-0 -translate-x-1/2 text-[10px] font-bold text-amber-700 flex flex-col items-center" style={{ left: at(ask) }}>Asked<span className="w-0.5 h-3 bg-amber-500" /></div> : null}
      {offer ? <div className="absolute bottom-0 -translate-x-1/2 text-[10px] font-bold text-indigo-700 flex flex-col-reverse items-center" style={{ left: at(offer) }}>Offer<span className="w-0.5 h-3 bg-indigo-600" /></div> : null}
    </div>
  );
}

/**
 * The final call for one teacher: the range management set for their role and
 * experience, what they asked for and earn now, what is left in the pot, and the
 * salary offer. The decision-maker offers a figure; an offer above the range or
 * over the pot is sent to the school admin, who answers here.
 */
export default function PayPanel({
  candidate,
  reviewApproved,
  onChanged,
  onInfo,
}: {
  candidate: Candidate;
  /** The decision-maker has approved this teacher, so a salary can be offered. */
  reviewApproved: boolean;
  onChanged: (next: Candidate) => void;
  onInfo?: (info: PayInfo | null) => void;
}) {
  const [data, setData] = useState<PayResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/pay`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setDenied(true); onInfo?.(null); return; }
      setData(body);
      onInfo?.(body.info);
    } catch {
      setDenied(true);
    }
  }, [candidate.id, onInfo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads when the candidate's offer changes; state is set after the fetch resolves
    void load();
  }, [load, candidate.final_offer?.status, candidate.final_offer?.monthly, candidate.round_reviews]);

  if (denied || !data || !data.info.matched || !data.info.final_round || !data.info.range || !data.info.role) return null;
  const { info } = data;
  const range = info.range!;
  const role = info.role!;
  const offer = info.offer;
  const pot = info.pot ?? null;
  const asked = info.expected?.monthly ?? null;
  const earns = info.current?.monthly ?? null;
  const typed = Math.round(Number(amount));
  const typedOk = Number.isFinite(typed) && typed >= 1000;
  const check = typedOk ? checkOffer(typed, range, pot) : null;
  const outside = !!check && (check.over_range || check.over_pot);

  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setError(out.error || 'That could not be saved. Try again.'); return false; }
      if (out.candidate) onChanged(out.candidate as Candidate);
      if (out.info) { setData((d) => (d ? { ...d, info: out.info } : d)); onInfo?.(out.info); }
      return true;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const askFlag = asked === null ? null : asked > range.max ? 'above' : asked < range.min ? 'below' : 'inside';
  const canOffer = data.can_decide && (reviewApproved || data.can_approve) && offer?.status !== 'approved' && offer?.status !== 'pending_approval';

  return (
    <section aria-label="Final call and salary" className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Wallet className="w-4 h-4 text-indigo-600" /> Final call · {role.name}</p>
        <p className="text-xs text-slate-500">Final call by {role.decider_name}</p>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Experience</p>
            <p className="text-lg font-bold text-slate-900">{info.years?.value ?? 0} years</p>
            <p className="text-xs text-slate-500">{info.years?.source === 'cv' ? 'Counted from the CV' : 'From the application'} · {range.tier_label}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">You may offer</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{inr(range.min)} to {inr(range.max)}</p>
            <p className="text-xs text-slate-500">Ideal {inr(range.ideal)} a month{range.topup > 0 ? ` · includes ${inr(range.topup)} for ${[range.topups.bed && 'B.Ed', range.topups.masters && 'master’s'].filter(Boolean).join(' and ')}` : ''}{range.campus_specific ? ' · campus pay' : ''}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">The teacher</p>
            <p className="text-sm text-slate-800">Asks <strong className="tabular-nums">{asked ? inr(asked) : info.expected?.text || 'not stated'}</strong>{info.expected?.note ? <span className="text-slate-400"> ({info.expected.note})</span> : null}</p>
            <p className="text-sm text-slate-800">Earns now <strong className="tabular-nums">{earns ? inr(earns) : info.current?.text || 'not stated'}</strong></p>
          </div>
        </div>

        <RangeBar min={range.min} ideal={range.ideal} max={range.max} ask={asked} offer={offer?.monthly ?? (typedOk ? typed : null)} />

        {askFlag === 'above' && asked && (
          <p className="flex items-start gap-2 text-sm font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> The teacher asks {inr(asked - range.max)} more a month than the highest pay for this tier.</p>
        )}
        {askFlag === 'inside' && <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="w-4 h-4" /> What the teacher asks is inside your range.</p>}
        {askFlag === 'below' && <p className="text-sm text-slate-600">The teacher asks less than the lowest pay for this tier.</p>}

        {pot && (
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">Budget for {role.name}:</strong> {pot.filled} of {pot.positions} posts filled · {inr(pot.left_monthly)} of {inr(pot.monthly_budget)} a month left
            {pot.left_monthly < 0 || pot.posts_left < 1 ? <span className="text-rose-700 font-semibold"> · nothing left</span> : null}
          </p>
        )}

        {offer && (
          <div className={`rounded-xl border p-4 space-y-2 ${offer.status === 'approved' ? 'border-emerald-200 bg-emerald-50' : offer.status === 'pending_approval' ? 'border-amber-300 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              {offer.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : offer.status === 'pending_approval' ? <Hourglass className="w-4 h-4 text-amber-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
              Offer: <span className="tabular-nums">{inr(offer.monthly)}</span> a month
              <span className="font-normal text-slate-600">
                {offer.status === 'approved' ? (offer.approved_by ? ` · approved by ${offer.approved_by}` : ' · inside the Pay Guide')
                  : offer.status === 'pending_approval' ? ' · waiting for the school admin'
                  : ` · not approved by ${offer.approved_by ?? 'the school admin'}`}
              </span>
            </p>
            <p className="text-xs text-slate-600">Set by {offer.decided_by}. {offer.status === 'approved' ? 'HR can now select the teacher and send the offer letter.' : ''}</p>
            {offer.reason && <p className="text-sm text-slate-800 border-l-2 border-slate-300 pl-3">{offer.reason}</p>}
            {offer.approval_note && <p className="text-sm text-slate-800 border-l-2 border-slate-300 pl-3">{offer.approved_by}: {offer.approval_note}</p>}

            {offer.status === 'pending_approval' && data.can_approve && (
              <div className="space-y-2 pt-2">
                <input value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="A note for the decision-maker (optional)" className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => void call({ action: 'approve', note: adminNote })} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve this offer</button>
                  <button type="button" disabled={busy} onClick={() => void call({ action: 'refuse', note: adminNote })} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 text-sm font-bold disabled:opacity-50 cursor-pointer">Do not approve</button>
                </div>
              </div>
            )}
            {offer.status === 'pending_approval' && !data.can_approve && <p className="text-xs text-amber-900">The school admin has been told in the app.</p>}

            {offer.history && offer.history.length > 0 && (
              <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Earlier figures ({offer.history.length})</summary>
                <ul className="mt-1 space-y-0.5">{offer.history.map((h, i) => <li key={i}>{inr(h.monthly)} · {h.by} · {h.status.replace('_', ' ')}</li>)}</ul>
              </details>
            )}
          </div>
        )}

        {canOffer && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <p className="text-sm font-bold text-slate-900">{offer?.status === 'refused' ? 'Make a new offer' : 'Set the salary offer'}</p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-slate-700">₹ a month
                <input type="number" min={1000} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 block w-44 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm tabular-nums" />
              </label>
              {[['Lowest', range.min], ['Ideal', range.ideal], ['Highest', range.max]].map(([label, v]) => (
                <button key={label as string} type="button" onClick={() => setAmount(String(v))} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-indigo-400 cursor-pointer">{label} {inr(v as number)}</button>
              ))}
              {asked && <button type="button" onClick={() => setAmount(String(asked))} className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:border-amber-500 cursor-pointer">What they asked {inr(asked)}</button>}
            </div>
            {check && (
              <p className={`text-sm font-medium ${outside ? 'text-amber-900' : check.below_min ? 'text-slate-600' : 'text-emerald-800'}`}>
                {outside ? `Outside the Pay Guide. ${check.needs_approval.join(' ')} The school admin has to approve it.` : check.below_min ? 'Below the lowest pay for this tier. That is allowed.' : 'Inside the Pay Guide. It goes ahead straight away.'}
              </p>
            )}
            {outside && (
              <label className="block text-sm font-medium text-slate-700">Why this much? (required)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="For example: strong demo lesson, ten years of Physics, the only candidate for this post." className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm" />
              </label>
            )}
            <button type="button" disabled={busy || !typedOk || (outside && reason.trim().length < 5)} onClick={() => void call({ action: 'offer', monthly: typed, reason })} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {outside ? 'Ask the admin to approve this offer' : 'Make this offer'}
            </button>
          </div>
        )}

        {!offer && !canOffer && (
          <p className="text-sm text-slate-600">
            {data.can_decide ? 'Give your review first. If you approve, you can set the salary offer here.' : `${role.decider_name} sets the salary offer after the final interview.`}
          </p>
        )}

        {offer && data.can_note && (
          <div className="space-y-2 pt-1">
            {(offer.counters ?? []).length > 0 && (
              <ul className="space-y-1.5">
                {offer.counters!.map((c, i) => <li key={i} className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"><strong>{c.by}</strong>{c.amount ? ` · ${inr(c.amount)}` : ''}: {c.note}</li>)}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the teacher said back, for the record" className="flex-1 min-w-[12rem] px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm" />
              <button type="button" disabled={busy || note.trim().length < 3} onClick={async () => { if (await call({ action: 'counter', note })) setNote(''); }} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 disabled:opacity-50 cursor-pointer">Add note</button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3"><XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> {error}</p>}
      </div>
    </section>
  );
}
