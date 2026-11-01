'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Loader2, Pause, RotateCcw, ThumbsUp, X, XCircle, CalendarClock } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { currentRound, ROUNDS, type DecisionAction } from '@/lib/hiringDecision';

type Panel = 'reject' | 'stop' | 'declined' | null;

/**
 * What the school does after reading a candidate's report: shortlist, hold or
 * turn down; then record each interview round; then the offer. Each button says
 * what it will do, asks for a reason where one is needed, and shows the result on
 * the page rather than in a pop-up.
 */
export default function HiringDecision({
  candidate,
  onChanged,
}: {
  candidate: Candidate;
  onChanged: (next: Candidate) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);

  const closed = candidate.status === 'rejected' || !!candidate.rejected_by_school_at || !!candidate.rejected_by_candidate_at;
  const selected = !!candidate.selected_at || candidate.status === 'hired';
  const shortlisted = !closed && (candidate.shortlist_status === 'shortlisted' || candidate.status === 'passed');
  const onHold = !closed && !shortlisted && candidate.shortlist_status === 'hold';
  const round = currentRound(candidate);
  const offerSent = !!candidate.offer_letter_sent_at;

  const send = async (action: DecisionAction, extra: { round?: string; note?: string } = {}) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notify_candidate: notify, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'That could not be saved. Please try again.');
        return;
      }
      onChanged(data.candidate);
      const told = data.candidate_notified && (data.candidate_notified.whatsapp || data.candidate_notified.email)
        ? ' The candidate has been told.'
        : '';
      setMessage(`${data.message}${told}`);
      setPanel(null);
      setNote('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = closed
    ? candidate.rejected_by_candidate_at ? 'The teacher declined' : 'Not moving forward'
    : offerSent ? 'Offer sent'
    : selected ? 'Selected'
    : shortlisted ? (round ? `Shortlisted · ${ROUNDS.find((r) => r.round === round)?.label} interview next` : 'Shortlisted')
    : onHold ? 'On hold'
    : 'Waiting for your decision';
  const statusTone = closed ? 'bg-rose-50 text-rose-800 border-rose-200'
    : selected ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : shortlisted ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
    : 'bg-amber-50 text-amber-900 border-amber-200';

  const reasonBox = (placeholder: string, confirmLabel: string, action: DecisionAction, extra: { round?: string } = {}, tellsCandidate = false) => (
    <div className="space-y-2 p-3.5 rounded-2xl border border-slate-200 bg-slate-50">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:outline-none"
      />
      {tellsCandidate && (
        <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 accent-indigo-600" />
          <span>Tell the candidate kindly that we will not be moving ahead. They do not see your reason.</span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => send(action, { ...extra, note })} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
          {confirmLabel}
        </button>
        <button type="button" disabled={busy} onClick={() => { setPanel(null); setNote(''); setError(''); }} className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Your decision</h2>
          <p className="text-xs text-slate-500 mt-0.5">Read the report, then choose what happens to this teacher next.</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full border text-xs font-black ${statusTone}`}>{statusLabel}</span>
      </div>

      {/* Where they are */}
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[11px] font-bold">
        {[
          { label: 'Review', done: shortlisted || selected || closed, active: !shortlisted && !selected && !closed },
          ...ROUNDS.map((r) => ({ label: r.label, done: candidate[r.field]?.status === 'cleared', active: shortlisted && !selected && round === r.round })),
          { label: 'Selected', done: selected, active: false },
        ].map((s, i, all) => (
          <React.Fragment key={s.label}>
            <li className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border ${s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : s.active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              {s.done && <Check className="w-3 h-3" />} {s.label}
            </li>
            {i < all.length - 1 && <span className="text-slate-300" aria-hidden="true">›</span>}
          </React.Fragment>
        ))}
      </ol>

      {message && <p role="status" className="flex items-start gap-2 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-2xl p-3"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> {message}</p>}
      {error && <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-2xl p-3"><XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> {error}</p>}

      {/* Not decided yet, or on hold */}
      {!closed && !shortlisted && !selected && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => send('shortlist')} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />} Shortlist for interviews
            </button>
            {!onHold && (
              <button type="button" disabled={busy} onClick={() => send('hold')} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
                <Pause className="w-4 h-4" /> Put on hold
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => { setPanel('reject'); setError(''); }} className="px-4 py-2.5 rounded-xl bg-white border border-rose-300 text-rose-800 text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
              <X className="w-4 h-4" /> Not moving forward
            </button>
          </div>
          {panel === 'reject' && reasonBox('Why? For example: subject depth was weak in the demo. Only your school sees this.', 'Confirm: not moving forward', 'reject', {}, true)}
        </div>
      )}

      {/* Interview rounds */}
      {shortlisted && (
        <div className="space-y-3">
          {ROUNDS.map((r, i) => {
            const clearance = candidate[r.field];
            const cleared = clearance?.status === 'cleared';
            const isCurrent = !selected && round === r.round;
            const last = i === ROUNDS.length - 1;
            return (
              <div key={r.round} className={`p-4 rounded-2xl border space-y-2.5 ${cleared ? 'border-emerald-200 bg-emerald-50/40' : isCurrent ? 'border-indigo-300 bg-white ring-2 ring-indigo-100' : 'border-slate-200 bg-slate-50/60'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-900">{i + 1}. {r.label} interview</p>
                  <span className={`text-[11px] font-black ${cleared ? 'text-emerald-700' : isCurrent ? 'text-indigo-700' : 'text-slate-400'}`}>{cleared ? 'Cleared' : isCurrent ? 'Up next' : 'Waiting'}</span>
                </div>
                {cleared && (
                  <p className="text-xs text-slate-600">
                    {clearance?.reviewer_name ? <strong>{clearance.reviewer_name}: </strong> : null}
                    {clearance?.notes}
                  </p>
                )}
                {isCurrent && (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={panel === 'stop' ? '' : note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={panel === 'stop'}
                      placeholder="Notes from the interview (optional)"
                      className="w-full text-sm p-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:outline-none disabled:opacity-50"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => send('round_pass', { round: r.round, note })} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {last ? 'Approve and select this teacher' : `Pass to ${ROUNDS[i + 1].label.toLowerCase()} interview`}
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setPanel('stop'); setNote(''); setError(''); }} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-bold cursor-pointer disabled:opacity-50">
                        Stop here
                      </button>
                    </div>
                    {panel === 'stop' && reasonBox('Why are you stopping here? Only your school sees this.', 'Confirm: stop here', 'round_reject', { round: r.round }, true)}
                  </div>
                )}
              </div>
            );
          })}
          <Link href="/admin/interviews" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline">
            <CalendarClock className="w-3.5 h-3.5" /> Schedule an interview
          </Link>
        </div>
      )}

      {/* Selected */}
      {(selected || offerSent) && !closed && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            {offerSent
              ? `The offer letter was sent on ${new Date(candidate.offer_letter_sent_at as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.`
              : 'This teacher is approved. Send the offer letter, then mark it here.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {!offerSent && (
              <button type="button" disabled={busy} onClick={() => send('offer_sent')} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                Offer letter sent
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => { setPanel('declined'); setError(''); }} className="px-4 py-2.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-sm font-bold cursor-pointer disabled:opacity-50">
              The teacher declined
            </button>
          </div>
          {panel === 'declined' && reasonBox('Why did they decline? For example: accepted another offer, salary, location.', 'Save', 'candidate_declined')}
        </div>
      )}

      {/* Closed */}
      {closed && (
        <div className="space-y-3">
          {(candidate.rejected_by_school_reason || candidate.rejected_by_candidate_reason) && (
            <p className="text-sm text-slate-700"><strong>Reason noted:</strong> {candidate.rejected_by_school_reason || candidate.rejected_by_candidate_reason}</p>
          )}
          <button type="button" disabled={busy} onClick={() => send('reopen')} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
            <RotateCcw className="w-4 h-4" /> Reopen and review again
          </button>
        </div>
      )}
    </section>
  );
}
