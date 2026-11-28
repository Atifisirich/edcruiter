'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, CheckCircle2, ClipboardCheck, Copy, Loader2, MessageCircleQuestion, RefreshCw, Send, Star, ThumbsDown, ThumbsUp, UserCheck, XCircle,
} from 'lucide-react';
import type { Candidate, ReviewRound, RoundQuestions, RoundReview, UserRole } from '@/lib/types';
import { currentRound, roundResultOf, roundsForCandidate } from '@/lib/reviewRounds';
import { MAX_STARS, MIN_OPINION, roundStage, rubricFor } from '@/lib/roundReview';
import { canDecideRound, reviewsRound } from '@/lib/reviewRounds';
import { isHiringTeam } from '@/lib/permissions';
import { useReviewAccess } from './useReviewAccess';
import type { PayInfo } from '@/lib/payFlow';

type Staff = { id: string; name: string; role: string; role_id: string; also_management?: boolean };

const starTone = (score: number) => (score >= 4 ? 'text-emerald-600' : score === 3 ? 'text-amber-500' : 'text-rose-600');
const barTone = (score: number) => (score >= 4 ? 'bg-emerald-500' : score === 3 ? 'bg-amber-400' : 'bg-rose-500');
const percentTone = (n: number) => (n >= 80 ? 'text-emerald-700' : n >= 50 ? 'text-amber-700' : 'text-rose-700');

function when(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** A reviewer's finished report card: approve or not, the score, each rating and their words. */
export function ReviewReportCard({ review, roundName }: { review: RoundReview; roundName: string }) {
  const approved = review.recommendation === 'approve';
  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${approved ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{roundName} · {review.reviewer_name}</p>
          <p className="text-xs text-slate-500">{when(review.submitted_at)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-extrabold tabular-nums ${percentTone(review.average)}`}>{review.average}<span className="text-xs font-medium text-slate-400"> / 100</span></span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${approved ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-rose-100 text-rose-900 border-rose-300'}`}>
            {approved ? <ThumbsUp className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />} {approved ? 'Approved' : 'Did not approve'}
          </span>
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {review.ratings.map((r) => (
          <li key={r.key} className="flex items-center gap-3">
            <span className="flex-1 min-w-0 text-sm text-slate-700 truncate" title={r.label}>{r.label}</span>
            <span className="w-16 h-2 rounded-full bg-white/80 border border-slate-200 overflow-hidden" aria-hidden="true"><span className={`block h-full ${barTone(r.score)}`} style={{ width: `${(r.score / MAX_STARS) * 100}%` }} /></span>
            <span className={`w-8 text-right text-sm font-bold tabular-nums ${starTone(r.score)}`}>{r.score}/{MAX_STARS}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-800 leading-relaxed border-l-2 border-slate-300 pl-3 whitespace-pre-line">{review.opinion}</p>
    </div>
  );
}

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of ${MAX_STARS}`}
          onClick={() => onChange(n)}
          className="p-1 rounded-md hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Star className={`w-6 h-6 ${n <= value ? `fill-current ${starTone(value)}` : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

function Questions({ candidateId, round }: { candidateId: string; round: ReviewRound }) {
  const [data, setData] = useState<RoundQuestions | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'subject' | 'other'>('subject');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/questions?round=${encodeURIComponent(round.id)}${refresh ? '&refresh=1' : ''}`);
      const body = await res.json().catch(() => ({}));
      if (body.questions) setData(body.questions);
      else setError(body.error || 'Could not make the questions.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }, [candidateId, round.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
    void load(false);
  }, [load]);

  const list = data ? data[tab] : [];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(list.map((q, i) => `${i + 1}. ${q}`).join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* the list can still be read on the page */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
          {([['subject', 'Subject questions'], ['other', 'Other questions']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${tab === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {data && <span className="text-[11px] text-slate-400 mr-1">{data.source === 'ai' ? 'Written for this teacher' : 'Standard questions'}</span>}
          <button type="button" onClick={() => void copy()} disabled={!list.length} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer" aria-label="Copy these questions">{copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}</button>
          <button type="button" onClick={() => void load(true)} disabled={busy} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer" aria-label="Write new questions"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>
      {busy && !data ? (
        <p className="flex items-center gap-2 text-sm text-slate-500 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Writing questions for this teacher…</p>
      ) : error && !data ? (
        <p className="text-sm text-rose-700">{error}</p>
      ) : (
        <ol className="space-y-2">
          {list.map((q, i) => (
            <li key={q} className="flex gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800">
              <span className="w-5 shrink-0 text-indigo-600 font-bold tabular-nums">{i + 1}</span>
              <span>{q}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The highlighted card at the top of a candidate's report.
 *
 *  - For the reviewer HR gave this teacher to: suggested questions, a rating on
 *    the round's rubric, approve or do not approve, and their opinion. They
 *    never pass or stop anyone.
 *  - For HR and the admin: where the teacher is in the school's pipeline, the
 *    report card from each round, and the buttons to allocate a reviewer, pass
 *    the teacher to the next round, or stop here.
 */
export default function RoundReviewCard({ candidate, onChanged, payInfo = null }: { candidate: Candidate; onChanged: (next: Candidate) => void; /** From the Pay card at the top of the page. */ payInfo?: PayInfo | null }) {
  const access = useReviewAccess();
  const me = access?.me;
  const rounds = useMemo(() => roundsForCandidate(access?.rounds ?? [], access?.branch_rounds, candidate), [access, candidate]);
  const round = currentRound(candidate, rounds);
  const closed = candidate.status === 'rejected' || !!candidate.rejected_by_school_at || !!candidate.rejected_by_candidate_at;
  const shortlisted = !closed && (candidate.shortlist_status === 'shortlisted' || candidate.status === 'passed');
  const hr = !!me && isHiringTeam(me.role);

  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => {
    if (!hr) return;
    const schoolId = localStorage.getItem('edcruiter_school_id') || '';
    fetch(`/api/staff${schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStaff(d?.staff ?? []))
      .catch(() => {});
  }, [hr]);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<'approve' | 'not_approve' | ''>('');
  const [opinion, setOpinion] = useState('');
  const [pickedUser, setPickedUser] = useState('');
  const [nextUser, setNextUser] = useState('');
  const [note, setNote] = useState('');
  const [stopping, setStopping] = useState(false);
  const [tellCandidate, setTellCandidate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // What the Pay Guide says about this teacher, once the pay panel has loaded it.

  if (!access || !me || !shortlisted || !round) return null;

  const rubric = rubricFor(round);
  const assignment = candidate.round_assignments?.[round.id];
  const review = candidate.round_reviews?.[round.id];
  // An admin who also acts as management gives their own review when HR gave them the teacher, then decides as HR.
  const iAmReviewer = assignment?.user_id === me.id && canDecideRound(me, round) && (!hr || (!!me.also_management && !review));
  const stage = roundStage(candidate, round.id, roundResultOf(candidate, round.id));
  const earlier = rounds.filter((r) => r.id !== round.id && candidate.round_reviews?.[r.id] && rounds.indexOf(r) < rounds.indexOf(round));
  const reviewersFor = (r: ReviewRound) => staff.filter((s) => reviewsRound({ roles: access.roles }, { role: s.role as UserRole, role_id: s.role_id, also_management: s.also_management }, r));
  const index = rounds.indexOf(round);
  const next = rounds[index + 1] ?? null;

  const call = async (url: string, body: unknown): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'That could not be saved. Try again.'); return null; }
      return data;
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    const data = await call(`/api/candidates/${candidate.id}/review`, {
      round: round.id,
      recommendation,
      ratings: rubric.map((r) => ({ key: r.key, score: ratings[r.key] ?? 0 })),
      opinion,
    });
    if (data?.candidate) { onChanged(data.candidate as Candidate); setMessage('Your review is saved. HR will take it from here.'); }
  };

  const allocate = async (userId: string) => {
    const schoolId = localStorage.getItem('edcruiter_school_id') || '';
    const data = await call('/api/review-assignments', { school_id: schoolId, candidate_ids: [candidate.id], round: round.id, user_id: userId });
    if (!data) return;
    const skipped = (data.skipped as { reason: string }[] | undefined) ?? [];
    if (skipped.length) { setError(skipped[0].reason); return; }
    const who = staff.find((s) => s.id === userId)?.name ?? 'the reviewer';
    onChanged({ ...candidate, round_assignments: { ...(candidate.round_assignments ?? {}), [round.id]: { user_id: userId, user_name: who, assigned_at: new Date().toISOString(), assigned_by_name: me.name } } });
    setMessage(`Allocated to ${who}. They are told in the app.`);
    setPickedUser('');
  };

  const decide = async (action: 'round_pass' | 'round_reject') => {
    const data = await call(`/api/candidates/${candidate.id}/decision`, {
      action,
      round: round.id,
      note: note.trim() || (action === 'round_pass' ? (review ? `Passed on ${review.reviewer_name}'s review.` : `Passed by ${me.name}.`) : ''),
      notify_candidate: tellCandidate,
      ...(action === 'round_pass' && next && nextUser ? { next_user_id: nextUser } : {}),
    });
    if (data?.candidate) {
      onChanged(data.candidate as Candidate);
      setMessage(String(data.message ?? 'Saved.'));
      setNote('');
      setStopping(false);
      setNextUser('');
    }
  };

  const canSubmit = recommendation !== '' && rubric.every((r) => (ratings[r.key] ?? 0) >= 1) && opinion.trim().length >= MIN_OPINION;
  const rated = rubric.filter((r) => (ratings[r.key] ?? 0) >= 1).length;

  const pipeline = (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs font-semibold" aria-label="Where this teacher is in the pipeline">
      <li className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-800"><Check className="w-3 h-3" /> Shortlisted</li>
      {rounds.map((r) => {
        const st = roundStage(candidate, r.id, roundResultOf(candidate, r.id));
        const here = r.id === round.id;
        const label = st === 'passed' ? 'Passed' : st === 'stopped' ? 'Stopped' : st === 'reviewed' ? 'Review in' : st === 'waiting_review' ? 'With reviewer' : here ? 'Allocate' : 'Waiting';
        const cls = st === 'passed' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : st === 'stopped' ? 'bg-rose-50 border-rose-200 text-rose-800'
          : here ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white border-slate-200 text-slate-500';
        return (
          <React.Fragment key={r.id}>
            <span className="text-slate-300" aria-hidden="true">›</span>
            <li className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${cls}`}>{r.name} <span className="font-normal opacity-80">· {label}</span></li>
          </React.Fragment>
        );
      })}
      <span className="text-slate-300" aria-hidden="true">›</span>
      <li className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white border-slate-200 text-slate-500">Selected</li>
    </ol>
  );

  const feedback = (
    <>
      {message && <p role="status" className="flex items-start gap-2 text-sm font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> {message}</p>}
      {error && <p role="alert" className="flex items-start gap-2 text-sm font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3"><XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" /> {error}</p>}
    </>
  );

  // ---------- The reviewer HR gave this teacher to ----------
  if (iAmReviewer) {
    return (
      <section id="review-card" aria-label={`Your review for the ${round.name} round`} className="rounded-3xl border-2 border-indigo-400 bg-white shadow-lg ring-4 ring-indigo-100 overflow-hidden">
        <div className="bg-indigo-600 text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Your review · {round.name} round</p>
            <h2 className="text-lg font-bold">{review ? 'Your review is in' : `Interview ${candidate.name}, then rate them`}</h2>
          </div>
          {review && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-sm font-semibold"><CheckCircle2 className="w-4 h-4" /> Sent to HR</span>}
        </div>
        <div className="p-5 sm:p-6 space-y-6">
          {feedback}
          {earlier.length > 0 && (
            <details className="rounded-2xl border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">What the earlier rounds said ({earlier.length})</summary>
              <div className="px-4 pb-4 space-y-3">{earlier.map((r) => <ReviewReportCard key={r.id} review={candidate.round_reviews![r.id]} roundName={r.name} />)}</div>
            </details>
          )}

          {review ? (
            <>
              <ReviewReportCard review={review} roundName={round.name} />
              <p className="text-sm text-slate-600">HR reads your review and decides whether to pass {candidate.name} to the next round. You do not need to do anything else.</p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><MessageCircleQuestion className="w-4 h-4 text-indigo-600" /> 1. Questions you can ask</h3>
                <Questions candidateId={candidate.id} round={round} />
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Star className="w-4 h-4 text-indigo-600" /> 2. Rate {candidate.name.split(' ')[0]} <span className="font-normal text-slate-500">({rated} of {rubric.length} rated)</span></h3>
                <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                  {rubric.map((r) => (
                    <li key={r.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                      <span className="text-sm text-slate-800">{r.label}</span>
                      <StarInput value={ratings[r.key] ?? 0} onChange={(n) => setRatings((prev) => ({ ...prev, [r.key]: n }))} label={r.label} />
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">1 star is weak, 3 is fine, 5 is excellent.</p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">3. Your opinion</h3>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Approve or do not approve">
                  <button type="button" role="radio" aria-checked={recommendation === 'approve'} onClick={() => setRecommendation('approve')} className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-sm font-bold cursor-pointer ${recommendation === 'approve' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700 hover:border-emerald-300'}`}>
                    <ThumbsUp className="w-4 h-4" /> I approve
                  </button>
                  <button type="button" role="radio" aria-checked={recommendation === 'not_approve'} onClick={() => setRecommendation('not_approve')} className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 text-sm font-bold cursor-pointer ${recommendation === 'not_approve' ? 'border-rose-500 bg-rose-50 text-rose-900' : 'border-slate-200 text-slate-700 hover:border-rose-300'}`}>
                    <ThumbsDown className="w-4 h-4" /> I do not approve
                  </button>
                </div>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  rows={3}
                  aria-label="Your opinion of this teacher"
                  placeholder="In a sentence or two: what you saw in the interview, and why you approve or not. Only your school sees this."
                  className="w-full text-sm p-3 rounded-xl border border-slate-300 bg-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">This does not pass or stop {candidate.name.split(' ')[0]}. HR reads it and decides.</p>
                <button type="button" onClick={() => void submitReview()} disabled={busy || !canSubmit} className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send my review to HR
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  // ---------- Reviewers who are not on this teacher's current round see nothing here ----------
  if (!hr) return null;

  // ---------- HR and the admin ----------
  // At the final round, when a decision-maker is named for the teacher's pay role, only they (or the admin) can be given the teacher.
  const finalDecider = !next && payInfo?.matched ? payInfo.role?.decider_user_id : undefined;
  const optionsHere = reviewersFor(round).filter((s) => !finalDecider || s.id === finalDecider);
  const awaitingOffer = !next && !!payInfo?.matched && payInfo.final_round && payInfo.offer?.status !== 'approved';
  const optionsNext = next ? reviewersFor(next) : [];
  return (
    <section id="review-card" aria-label={`${round.name} round`} className="rounded-3xl border-2 border-indigo-400 bg-white shadow-lg ring-4 ring-indigo-100 overflow-hidden">
      <div className="bg-indigo-600 text-white px-5 sm:px-6 py-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Pipeline · {round.name} round</p>
        <h2 className="text-lg font-bold">
          {stage === 'not_allocated' ? `Give ${candidate.name} to a ${round.name} reviewer`
            : stage === 'waiting_review' ? `With ${assignment?.user_name}, waiting for their review`
            : `${review?.reviewer_name}'s review is in. Your turn.`}
        </h2>
      </div>
      <div className="p-5 sm:p-6 space-y-5">
        {pipeline}
        {feedback}

        {earlier.length > 0 && (
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">Earlier rounds ({earlier.length})</summary>
            <div className="px-4 pb-4 space-y-3">{earlier.map((r) => <ReviewReportCard key={r.id} review={candidate.round_reviews![r.id]} roundName={r.name} />)}</div>
          </details>
        )}

        {(stage === 'not_allocated' || stage === 'waiting_review') && (
          <div className="space-y-3">
            {stage === 'waiting_review' && assignment && (
              <p className="flex items-center gap-2 text-sm text-slate-700"><UserCheck className="w-4 h-4 text-indigo-600" /> Allocated to <strong>{assignment.user_name}</strong> on {when(assignment.assigned_at)}. They give a rating and opinion after the interview.</p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-slate-700">{stage === 'waiting_review' ? 'Give to someone else' : `${round.name} reviewer`}
                <select value={pickedUser} onChange={(e) => setPickedUser(e.target.value)} className="mt-1 block min-w-[14rem] px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm">
                  <option value="">Choose a person…</option>
                  {optionsHere.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy || !pickedUser} onClick={() => void allocate(pickedUser)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />} {stage === 'waiting_review' ? 'Change reviewer' : 'Allocate'}
              </button>
              <Link href={`/admin/interviews?round=${encodeURIComponent(round.id)}&candidate=${encodeURIComponent(candidate.id)}`} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50">
                Book the interview <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {optionsHere.length === 0 && staff.length > 0 && <p className="text-xs text-amber-700">Nobody on your team reviews this round yet. Add them in Team, or change who reviews it in Settings.</p>}
            {stage === 'not_allocated' && (
              <p className="text-xs text-slate-500">
                Already met them outside the app?{' '}
                <button type="button" disabled={busy || awaitingOffer} onClick={() => void decide('round_pass')} className="font-semibold text-indigo-700 hover:underline cursor-pointer disabled:opacity-50">
                  {next ? `Pass to ${next.name} without a review` : 'Select without a review'}
                </button>
              </p>
            )}
            {stage === 'not_allocated' && <p className="text-xs text-slate-500">After you allocate, they add their free times, you book the meeting, and they rate {candidate.name.split(' ')[0]} on their report. You pass them on from here.</p>}
          </div>
        )}

        {stage === 'reviewed' && review && (
          <div className="space-y-4">
            <ReviewReportCard review={review} roundName={round.name} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              {!stopping ? (
                <>
                  {next && (
                    <label className="block text-sm font-medium text-slate-700">Give to a {next.name} reviewer now (you can also do it later)
                      <select value={nextUser} onChange={(e) => setNextUser(e.target.value)} className="mt-1 block w-full sm:w-72 px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm">
                        <option value="">Choose later</option>
                        {optionsNext.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="block text-sm font-medium text-slate-700">Your note (optional)
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Passed on ${review.reviewer_name}'s review.`} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || awaitingOffer} onClick={() => void decide('round_pass')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {next ? `Pass to ${next.name}` : 'Select this teacher'}
                    </button>
                    {awaitingOffer && <p className="w-full text-xs text-amber-800">You can select this teacher once the salary offer above is set and approved.</p>}
                    <button type="button" disabled={busy} onClick={() => { setStopping(true); setNote(''); setError(''); }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-rose-300 text-rose-800 text-sm font-bold cursor-pointer">
                      Stop here
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-700">Why are you stopping here? (required, only your school sees it)
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm" />
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={tellCandidate} onChange={(e) => setTellCandidate(e.target.checked)} className="mt-1 accent-indigo-600" />
                    <span>Tell the candidate kindly that we will not be moving ahead. They do not see your reason.</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || note.trim().length < 3} onClick={() => void decide('round_reject')} className="px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">Confirm: stop here</button>
                    <button type="button" disabled={busy} onClick={() => { setStopping(false); setNote(''); }} className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer">Cancel</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
