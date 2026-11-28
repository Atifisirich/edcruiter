'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowDown, Check, CheckCircle2, Hourglass, Loader2, Wallet, XCircle } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import type { PayInfo } from '@/lib/payFlow';
import { askPosition, checkOffer, suggestedOffer, type AskPosition } from '@/lib/payGuide';
import SalaryInput from '@/components/SalaryInput';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

interface PayResponse {
  info: PayInfo;
  can_decide: boolean;
  can_approve: boolean;
  can_note: boolean;
  final_review?: 'approve' | 'not_approve' | null;
}

/** The colour and words for where the ask sits. */
const SIGNAL: Record<AskPosition['where'], { chip: string; border: string; label: (a: AskPosition) => string }> = {
  within: { chip: 'bg-emerald-100 text-emerald-900 border-emerald-300', border: 'border-emerald-300', label: () => 'Within range' },
  above: { chip: 'bg-rose-100 text-rose-900 border-rose-300', border: 'border-rose-300', label: (a) => `Above range by ${inr(a.by)} (${a.percent}%)` },
  below: { chip: 'bg-sky-100 text-sky-900 border-sky-300', border: 'border-sky-300', label: (a) => `Below range by ${inr(a.by)} (${a.percent}%)` },
  unknown: { chip: 'bg-slate-100 text-slate-700 border-slate-300', border: 'border-slate-200', label: () => 'Expected salary not given' },
};

/** Where the figures sit: the range, its ideal, what the teacher asked for, and the offer. */
function RangeBar({ min, ideal, max, ask, offer }: { min: number; ideal: number; max: number; ask?: number | null; offer?: number | null }) {
  const values = [min, max, ask || min, offer || min];
  const low = Math.min(...values) * 0.9;
  const high = Math.max(...values) * 1.08;
  const at = (n: number) => `${Math.max(0, Math.min(100, ((n - low) / (high - low)) * 100))}%`;
  return (
    <div className="relative h-12" aria-hidden="true">
      <div className="absolute top-5 h-2.5 rounded-full bg-slate-100 left-0 right-0" />
      <div className="absolute top-5 h-2.5 rounded-full bg-emerald-200" style={{ left: at(min), width: `calc(${at(max)} - ${at(min)})` }} />
      <div className="absolute top-4 w-0.5 bg-emerald-700" style={{ left: at(ideal), height: '1.1rem' }} />
      {ask ? <div className="absolute top-0 -translate-x-1/2 text-[10px] font-bold text-amber-700 flex flex-col items-center" style={{ left: at(ask) }}>Asks<span className="w-0.5 h-3 bg-amber-500" /></div> : null}
      {offer ? <div className="absolute bottom-0 -translate-x-1/2 text-[10px] font-bold text-indigo-700 flex flex-col-reverse items-center" style={{ left: at(offer) }}>Offer<span className="w-0.5 h-3 bg-indigo-600" /></div> : null}
    </div>
  );
}

function Stat({ label, value, note, strong }: { label: string; value: React.ReactNode; note?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-xl font-extrabold text-indigo-700' : 'text-lg font-bold text-slate-900'}`}>{value}</p>
      {note && <p className="text-xs text-slate-500">{note}</p>}
    </div>
  );
}

/**
 * The pay card, the first thing on a candidate's page for the decision-maker,
 * HR and the school admin: what the teacher asks and earns, the Pay Guide's
 * range for their job, campus and experience, whether the ask is within,
 * above or below it, and a suggested offer. At the final round the
 * decision-maker makes the offer from here; one above the range or the pot
 * waits for the school admin, who answers here.
 */
export default function PayPanel({
  candidate,
  onChanged,
  onInfo,
}: {
  candidate: Candidate;
  onChanged: (next: Candidate) => void;
  onInfo?: (info: PayInfo | null) => void;
}) {
  const [data, setData] = useState<PayResponse | null>(null);
  const [denied, setDenied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads when the candidate's offer, reviews or salary change; state is set after the fetch resolves
    void load();
  }, [load, candidate.final_offer?.status, candidate.final_offer?.monthly, candidate.round_reviews, candidate.expected_salary_monthly, candidate.current_salary_monthly]);

  if (denied || !data || !data.info.matched || !data.info.range || !data.info.role) return null;
  const { info } = data;
  const range = info.range!;
  const role = info.role!;
  const offer = info.offer;
  const pot = info.pot ?? null;
  const asked = info.expected?.monthly ?? null;
  const earns = info.current?.monthly ?? null;
  const position = askPosition(asked, range);
  const signal = SIGNAL[position.where];
  const suggestion = suggestedOffer(asked, range);
  const typed = Number(amount);
  const typedOk = Number.isFinite(typed) && typed >= 1000;
  const check = typedOk ? checkOffer(typed, range, pot) : null;
  const outside = !!check && (check.over_range || check.over_pot);
  const live = offer?.status === 'approved' || offer?.status === 'pending_approval';
  const reviewOk = data.final_review === 'approve' || (data.can_approve && data.final_review !== 'not_approve');
  const canOffer = info.final_round && data.can_decide && reviewOk && !live;

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

  const fromText = (r?: PayInfo['expected']) => (r?.from_text ? <>from “{r.text}”{r.note ? `, ${r.note}` : ''}</> : null);
  const jump = asked && earns ? Math.round(((asked - earns) / earns) * 100) : null;
  const extras = [
    range.topup > 0 ? `includes ${inr(range.topup)} for ${[range.topups.bed && 'B.Ed', range.topups.masters && 'master’s'].filter(Boolean).join(' and ')}` : '',
    range.campus_specific ? 'campus pay' : '',
  ].filter(Boolean).join(' · ');

  return (
    <section id="pay-card" aria-label="Pay" className={`rounded-2xl border-2 ${signal.border} bg-white overflow-hidden print:hidden`}>
      <div className="px-4 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Wallet className="w-4 h-4 text-indigo-600" /> Pay · {role.name}</p>
          <p className="text-xs text-slate-500">
            {[info.campus_name, `${info.years?.value ?? 0} years’ experience (${info.years?.source === 'cv' ? 'from the CV' : 'from the application'})`, range.tier_label].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-bold ${signal.chip}`}>
          {position.where === 'within' ? <CheckCircle2 className="w-4 h-4" /> : position.where === 'above' ? <AlertTriangle className="w-4 h-4" /> : position.where === 'below' ? <ArrowDown className="w-4 h-4" /> : null}
          {signal.label(position)}
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Stat label="Asks" value={asked ? inr(asked) : '—'} note={fromText(info.expected) ?? (asked ? 'a month' : 'not stated')} />
          <Stat
            label="Earns now"
            value={earns === 0 ? 'Not working' : earns ? inr(earns) : '—'}
            note={fromText(info.current) ?? (earns === 0 ? 'no current salary' : earns ? (jump !== null ? `a month · asks ${jump >= 0 ? '+' : ''}${jump}%` : 'a month') : 'not stated')}
          />
          <Stat label="Guide range" value={<>{inr(range.min)} – {inr(range.max)}</>} note={<>ideal {inr(range.ideal)}{extras ? ` · ${extras}` : ''}</>} />
          <Stat label="Suggested offer" value={inr(suggestion.monthly)} note={suggestion.why} strong />
        </div>

        <RangeBar min={range.min} ideal={range.ideal} max={range.max} ask={asked} offer={offer?.monthly ?? (formOpen && typedOk ? typed : null)} />

        {pot && (
          <p className="text-xs text-slate-600">
            <strong className="text-slate-800">Budget for {role.name}:</strong> {pot.filled} of {pot.positions} posts filled · {inr(pot.left_monthly)} of {inr(pot.monthly_budget)} a month left
            {pot.left_monthly < 0 || pot.posts_left < 1 ? <span className="text-rose-700 font-semibold"> · nothing left</span> : null}
          </p>
        )}

        {offer && (
          <div className={`rounded-xl border p-3.5 space-y-2 ${offer.status === 'approved' ? 'border-emerald-200 bg-emerald-50' : offer.status === 'pending_approval' ? 'border-amber-300 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
              {offer.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : offer.status === 'pending_approval' ? <Hourglass className="w-4 h-4 text-amber-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
              Offer: <span className="tabular-nums">{inr(offer.monthly)}</span> a month
              <span className="font-normal text-slate-600">
                {offer.status === 'approved' ? (offer.approved_by ? `· approved by ${offer.approved_by}` : '· inside the Pay Guide')
                  : offer.status === 'pending_approval' ? '· waiting for the school admin'
                  : `· not approved by ${offer.approved_by ?? 'the school admin'}`}
              </span>
            </p>
            <p className="text-xs text-slate-600">Set by {offer.decided_by}. {offer.status === 'approved' ? 'HR can now send the offer letter.' : ''}</p>
            {offer.reason && <p className="text-sm text-slate-800 border-l-2 border-slate-300 pl-3">{offer.reason}</p>}
            {offer.approval_note && <p className="text-sm text-slate-800 border-l-2 border-slate-300 pl-3">{offer.approved_by}: {offer.approval_note}</p>}

            {offer.status === 'pending_approval' && data.can_approve && (
              <div className="space-y-2 pt-1">
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

        {canOffer && !formOpen && (
          <button type="button" onClick={() => { setFormOpen(true); setAmount(String(suggestion.monthly)); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer">
            <Wallet className="w-4 h-4" /> {offer?.status === 'refused' ? 'Make a new offer' : 'Make the offer'}
          </button>
        )}

        {canOffer && formOpen && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <SalaryInput label="Offer" value={amount} onChange={setAmount} className="w-56" hint={null} compact />
              {[['Lowest', range.min], ['Ideal', range.ideal], ['Highest', range.max]].map(([label, v]) => (
                <button key={label as string} type="button" onClick={() => setAmount(String(v))} className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-indigo-400 cursor-pointer">{label} {inr(v as number)}</button>
              ))}
              {asked ? <button type="button" onClick={() => setAmount(String(asked))} className="px-3 py-2 rounded-xl border border-amber-300 bg-white text-xs font-semibold text-amber-800 hover:border-amber-500 cursor-pointer">What they asked {inr(asked)}</button> : null}
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
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy || !typedOk || (outside && reason.trim().length < 5)} onClick={async () => { if (await call({ action: 'offer', monthly: typed, reason })) setFormOpen(false); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {outside ? 'Ask the admin to approve this offer' : 'Make this offer'}
              </button>
              <button type="button" onClick={() => setFormOpen(false)} className="text-sm font-semibold text-slate-600 hover:underline cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        {!offer && !canOffer && (
          <p className="text-xs text-slate-500">
            {!info.final_round ? `The offer is made at the final round, by ${role.decider_name}.`
              : data.can_decide ? (data.final_review === 'not_approve' ? 'The final review did not approve this teacher, so there is no offer to make.' : 'Give your review first. If you approve, you can make the offer here.')
              : `${role.decider_name} makes the offer after the final interview.`}
          </p>
        )}

        {offer && data.can_note && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">What the teacher said back{(offer.counters ?? []).length ? ` (${offer.counters!.length})` : ''}</summary>
            <div className="mt-2 space-y-2">
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
          </details>
        )}

        {error && <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3"><XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> {error}</p>}
      </div>
    </section>
  );
}
