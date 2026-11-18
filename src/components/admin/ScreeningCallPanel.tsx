'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Clock, Flag, Loader2, Mail, PauseCircle, PhoneCall, PhoneForwarded, PhoneOff, UserX, XCircle } from 'lucide-react';
import { groupName } from '@/lib/screeningFlow';
import type { ScreeningCall } from '@/lib/types';
import { buttonClass } from './ui';
import { useAdmin } from './adminContext';
import { isHiringTeam } from '@/lib/permissions';

const STATUS: Record<ScreeningCall['status'], { label: string; cls: string }> = {
  scheduled: { label: 'Planned', cls: 'bg-slate-50 text-slate-700 border-slate-300' },
  skipped: { label: 'Not called', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  calling: { label: 'Calling…', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  no_answer: { label: 'No answer', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  busy: { label: 'Line busy', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const RECOMMEND: Record<NonNullable<ScreeningCall['recommendation']>, { label: string; cls: string }> = {
  proceed: { label: 'Recommend: move forward', cls: 'bg-emerald-600 text-white' },
  maybe: { label: 'Recommend: review', cls: 'bg-amber-500 text-white' },
  not_suitable: { label: 'Recommend: not suitable', cls: 'bg-rose-600 text-white' },
};

function minutes(sec?: number) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const DECISION: Record<NonNullable<ScreeningCall['decision']>['action'], { cls: string; Icon: typeof Mail; title: string }> = {
  link_sent: { cls: 'bg-emerald-50 border-emerald-200 text-emerald-900', Icon: Mail, title: 'Test link sent' },
  would_send_link: { cls: 'bg-slate-50 border-slate-200 text-slate-800', Icon: Mail, title: 'Test link (demo)' },
  held: { cls: 'bg-amber-50 border-amber-200 text-amber-900', Icon: PauseCircle, title: 'Waiting for HR' },
  flagged: { cls: 'bg-rose-50 border-rose-200 text-rose-900', Icon: Flag, title: 'Flagged for HR' },
  retry_scheduled: { cls: 'bg-indigo-50 border-indigo-200 text-indigo-900', Icon: Clock, title: 'Will try again' },
  callback_scheduled: { cls: 'bg-indigo-50 border-indigo-200 text-indigo-900', Icon: PhoneForwarded, title: 'Will call back' },
  decline_suggested: { cls: 'bg-rose-50 border-rose-200 text-rose-900', Icon: UserX, title: 'Decline waiting for HR' },
  declined: { cls: 'bg-slate-50 border-slate-200 text-slate-800', Icon: UserX, title: 'Declined' },
  withdrawn: { cls: 'bg-slate-50 border-slate-200 text-slate-800', Icon: UserX, title: 'Withdrawn' },
  none: { cls: 'bg-slate-50 border-slate-200 text-slate-700', Icon: CheckCircle2, title: 'No action' },
};

const CHECK_ICON = { met: CheckCircle2, not_met: XCircle, unclear: Clock } as const;
const CHECK_CLS = { met: 'text-emerald-700', not_met: 'text-rose-700', unclear: 'text-amber-700' } as const;

type HrAction = 'send_link' | 'decline' | 'dismiss';
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function CallCard({ call, canRelease, onAct }: { call: ScreeningCall; canRelease: boolean; onAct: (id: string, action: HrAction) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState<HrAction | null>(null);
  const st = STATUS[call.status];
  const d = call.decision ? DECISION[call.decision.action] : null;
  const waiting = call.decision?.action === 'held' || call.decision?.action === 'flagged' || call.decision?.action === 'decline_suggested';
  const canSend = canRelease && call.mode === 'live' && waiting;
  const canDecline = canRelease && (call.decision?.action === 'decline_suggested' || (call.decision?.action === 'flagged' && call.status === 'completed'));
  const act = async (a: HrAction) => {
    if (a === 'decline' && !window.confirm('Send the polite decline? The candidate is marked as not moving forward and told once, without your reason.')) return;
    setWorking(a);
    try { await onAct(call.id, a); } finally { setWorking(null); }
  };
  return (
    <li className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`px-2.5 py-1 rounded-full border font-bold ${st.cls}`}>
          {call.status === 'calling' && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
          {st.label}
        </span>
        {call.mode === 'demo' && (
          <span className="px-2.5 py-1 rounded-full border border-slate-300 bg-slate-100 text-slate-700 font-bold">Demo, no real call</span>
        )}
        {call.recommendation && call.status === 'completed' && (
          <span className={`px-2.5 py-1 rounded-full font-bold ${RECOMMEND[call.recommendation].cls}`}>{RECOMMEND[call.recommendation].label}</span>
        )}
        <span className="text-slate-500">
          {new Date(call.started_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          {call.duration_sec ? ` · ${minutes(call.duration_sec)} min` : ''}
          {` · ${call.trigger === 'auto' ? 'automatic' : call.trigger === 'manual' ? `by ${call.requested_by}` : call.requested_by.toLowerCase()}`}
          {call.language && call.language !== 'English' ? ` · in ${call.language}` : ''}
          {call.group ? ` · ${groupName(call.group)} questions` : ''}
          {call.mode === 'live' && call.status === 'completed' && typeof call.price_inr === 'number' ? ` · ₹${call.price_inr}` : ''}
        </span>
      </div>

      {call.status === 'scheduled' && call.scheduled_for && (
        <p className="text-sm text-slate-700 flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-indigo-600" /> The AI will call on {when(call.scheduled_for)}, inside your calling hours.</p>
      )}
      {call.failure_reason && <p className={`text-xs ${call.status === 'skipped' ? 'text-slate-600' : 'text-rose-700'}`}>{call.failure_reason}</p>}
      {call.interest === 'not_interested' && call.status === 'completed' && <p className="text-xs font-semibold text-rose-700">Said they are no longer interested.</p>}

      {call.decision && d && (
        <div className={`p-3 rounded-xl border text-sm flex flex-wrap items-center gap-x-3 gap-y-2 ${d.cls}`}>
          <d.Icon className="w-4 h-4 shrink-0" />
          <p className="flex-1 min-w-0">
            <strong>{d.title}.</strong> {call.decision.detail}
            {call.decision.retry_at && ` Next call: ${when(call.decision.retry_at)}.`}
          </p>
          {(canSend || canDecline) && (
            <div className="flex flex-wrap gap-2">
              {canDecline && (
                <button type="button" disabled={!!working} onClick={() => void act('decline')} className={buttonClass(call.decision?.action === 'decline_suggested' ? 'danger' : 'secondary', 'sm')}>
                  {working === 'decline' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />} Send the decline
                </button>
              )}
              {canSend && (
                <button type="button" disabled={!!working} onClick={() => void act('send_link')} className={buttonClass(call.decision?.action === 'decline_suggested' ? 'secondary' : 'primary', 'sm')}>
                  {working === 'send_link' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} {call.decision?.action === 'decline_suggested' ? 'Send the test link instead' : 'Send the test link'}
                </button>
              )}
              <button type="button" disabled={!!working} onClick={() => void act('dismiss')} className={buttonClass('ghost', 'sm')}>
                {working === 'dismiss' && <Loader2 className="w-4 h-4 animate-spin" />} Leave it
              </button>
            </div>
          )}
        </div>
      )}
      {call.summary && <p className="text-sm text-slate-800 leading-relaxed">{call.summary}</p>}

      {call.checks?.length ? (
        <ul className="space-y-1">
          {call.checks.map((c) => {
            const Icon = CHECK_ICON[c.result];
            return (
              <li key={c.requirement} className={`text-xs flex items-start gap-1.5 ${CHECK_CLS[c.result]}`}>
                <Icon className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span><strong>{c.importance === 'prefer' ? 'Preference' : 'Must-have'} {c.result === 'met' ? 'met' : c.result === 'not_met' ? 'not met' : 'not confirmed'}:</strong> {c.requirement}{c.note ? ` (${c.note})` : ''}</span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {call.answers?.length ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {call.answers.map((a) => (
            <div key={a.question} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <dt className="text-[11px] font-semibold text-slate-500">{a.question}</dt>
              <dd className={`text-sm mt-0.5 ${a.answer === 'Not answered' ? 'text-slate-400 italic' : 'text-slate-900 font-medium'}`}>{a.answer}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {call.transcript?.length ? (
        <div>
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1 cursor-pointer">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} /> {open ? 'Hide' : 'Show'} the conversation ({call.transcript.length} turns)
          </button>
          {open && (
            <ol className="mt-2 space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {call.transcript.map((t, i) => (
                <li key={i} className={`text-xs p-2.5 rounded-xl max-w-[85%] ${t.role === 'agent' ? 'bg-indigo-50 text-indigo-950' : 'bg-slate-100 text-slate-900 ml-auto'}`}>
                  <span className="block text-[10px] font-bold uppercase tracking-wide opacity-60">{t.role === 'agent' ? 'AI caller' : 'Candidate'}</span>
                  {t.text}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** A candidate's AI screening calls, and the button to make one. */
export default function ScreeningCallPanel({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const { schoolId, user, toast } = useAdmin();
  const [calls, setCalls] = useState<ScreeningCall[] | null>(null);
  const [mode, setMode] = useState<'live' | 'demo'>('demo');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false);
  const canCall = isHiringTeam(user?.role);

  const load = useCallback(async () => {
    const r = await fetch(`/api/screening-calls?school_id=${encodeURIComponent(schoolId)}&candidate_id=${encodeURIComponent(candidateId)}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const list: ScreeningCall[] = d.calls || [];
      setCalls(list);
      // Still going on: ringing, or just finished and the school's rules have not acted yet.
      const now = Date.now();
      setBusy(list.some((c) => c.status === 'calling' || (!c.decision && !['failed', 'scheduled', 'skipped'].includes(c.status) && now - Date.parse(c.started_at) < 120_000)));
    }
  }, [schoolId, candidateId]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    fetch(`/api/screening-calls/settings?school_id=${encodeURIComponent(schoolId)}`)
      .then((r) => r.json()).then((d) => { if (d.mode) setMode(d.mode); }).catch(() => {});
    return () => window.clearTimeout(t);
  }, [load, schoolId]);

  // While a call is going on, check every few seconds for the result.
  const ringing = busy;
  useEffect(() => {
    if (!ringing) return;
    const t = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(t);
  }, [ringing, load]);

  const act = async (callId: string, action: HrAction) => {
    const r = await fetch('/api/screening-calls/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, call_id: callId, action }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) toast(d.error || 'Could not do that.', 'error');
    else toast(d.call?.decision?.detail || 'Done.', ['link_sent', 'declined'].includes(d.call?.decision?.action) ? 'success' : 'info');
    await load();
  };

  const call = async () => {
    setStarting(true);
    try {
      const r = await fetch('/api/screening-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, candidate_ids: [candidateId] }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.problems?.[0]?.error || d.error || 'Could not start the call.');
      toast(mode === 'demo' ? `Demo call started for ${candidateName}.` : `Calling ${candidateName} now.`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start the call.', 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4" aria-labelledby="screening-call-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="screening-call-heading" className="text-base font-black text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-indigo-600" /> AI screening call
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            An AI voice agent rings {candidateName}, asks your screening questions, and writes up the answers here.
            {mode === 'demo' && ' Real calls are not switched on yet, so this runs a demo: no phone call is made.'}
          </p>
        </div>
        {canCall && (
          <button type="button" onClick={() => void call()} disabled={starting || ringing} className={buttonClass('primary', 'sm')}>
            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
            {ringing ? 'Call in progress' : mode === 'demo' ? 'Run a demo call' : 'Call now'}
          </button>
        )}
      </div>

      {calls === null ? (
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
      ) : calls.length === 0 ? (
        <p className="text-sm text-slate-500 flex items-center gap-2"><PhoneOff className="w-4 h-4" /> No screening calls yet.</p>
      ) : (
        <ul className="space-y-3">
          {calls.map((c) => <CallCard key={c.id} call={c} canRelease={canCall} onAct={act} />)}
        </ul>
      )}
    </section>
  );
}
