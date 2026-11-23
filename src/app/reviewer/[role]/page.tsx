'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Video, CheckCircle2, XCircle, Clock, Sparkles, Calendar, ExternalLink, Loader2, ClipboardCheck,
  History, RefreshCw, Search, LogOut, Globe, ChevronDown, AlertCircle, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { Candidate, ScheduledInterview } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { allRoundsOf, canDecideRound, currentRound, roundsForCandidate } from '@/lib/reviewRounds';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';
import { useReviewAccess } from '@/components/reviewer/useReviewAccess';
import BrandMark from '@/components/shared/BrandMark';
import NotificationBell from '@/components/shared/NotificationBell';
import AvailabilityCard from '@/components/reviewer/AvailabilityCard';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, buttonClass, inputClass } from '@/components/admin/ui';

/**
 * A reviewer's home. The rounds they review are set by the school admin in
 * Settings, so this shows the teachers waiting for this person's yes or no,
 * the interviews HR has scheduled with them, and what they have already
 * decided. The old /reviewer/rm, /ih and /coo addresses all land here.
 */

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "Starts in 20 min", "Today", "Tomorrow" — what a reviewer wants to know at a glance. */
function startsIn(iso: string): { text: string; tone: 'amber' | 'indigo' | 'slate' | 'rose' } {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (mins < -60) return { text: 'Time has passed', tone: 'rose' };
  if (mins <= 0) return { text: 'Happening now', tone: 'amber' };
  if (mins < 60) return { text: `Starts in ${mins} min`, tone: 'amber' };
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return { text: 'Today', tone: 'indigo' };
  if (d.toDateString() === new Date(Date.now() + 86_400_000).toDateString()) return { text: 'Tomorrow', tone: 'indigo' };
  return { text: whenLabel(iso).split(',')[0], tone: 'slate' };
}

export default function ReviewerHomePage() {
  const access = useReviewAccess();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // HR-scheduled interviews assigned to whoever is signed in right now.
  const [myInterviews, setMyInterviews] = useState<ScheduledInterview[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [interviewError, setInterviewError] = useState<{ id: string; message: string } | null>(null);

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const load = useCallback(async () => {
    try {
      const [candRes, intvRes] = await Promise.all([
        fetch(`/api/candidates?school_id=${schoolId}`),
        fetch(`/api/interviews?mine=1&school_id=${schoolId}`),
      ]);
      const candData = await candRes.json().catch(() => ({}));
      const intvData = await intvRes.json().catch(() => ({}));
      if (!candRes.ok) throw new Error(candData.error || 'Could not load the teachers.');
      setCandidates(candData.candidates || []);
      setMyInterviews((intvData.interviews || []).filter((i: ScheduledInterview) => i.status === 'scheduled'));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  const refresh = () => { setLoading(true); setLoadError(''); load(); };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).then((m) => { if (m?.email) setEmail(m.email); }).catch(() => {});
  }, []);

  // Close the account menu when clicking elsewhere.
  useEffect(() => {
    if (!accountOpen) return;
    const close = (e: MouseEvent) => { if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [accountOpen]);

  const me = access?.me;
  const rounds = useMemo(() => access?.rounds ?? [], [access]);
  const everyRound = useMemo(() => allRoundsOf(rounds, access?.branch_rounds), [rounds, access]);
  const myRounds = me ? everyRound.filter((r) => canDecideRound(me, r)) : [];

  const waiting = useMemo(() => {
    if (!me) return [];
    return candidates
      .filter((c) => c.status !== 'rejected' && !c.rejected_by_school_at && !c.selected_at && (c.shortlist_status === 'shortlisted' || c.status === 'passed'))
      .map((c) => ({ c, round: currentRound(c, roundsForCandidate(rounds, access?.branch_rounds, c)) }))
      .filter((x) => x.round && canDecideRound(me, x.round));
  }, [candidates, rounds, access, me]);

  const filteredWaiting = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return waiting;
    return waiting.filter(({ c }) => `${c.name} ${c.applied_subject} ${c.applied_segment}`.toLowerCase().includes(q));
  }, [waiting, search]);

  const decidedByMe = useMemo(() => {
    if (!me) return [];
    return candidates
      .flatMap((c) => (c.interview_decisions || []).filter((d) => d.reviewer_id === me.id).map((d) => ({ c, d })))
      .sort((a, b) => b.d.decided_at.localeCompare(a.d.decided_at));
  }, [candidates, me]);

  const sortedInterviews = useMemo(
    () => [...myInterviews].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [myInterviews]
  );

  const candidateFor = (id: string) => candidates.find((c) => c.id === id);
  const roundName = (id: string) => everyRound.find((r) => r.id === id)?.name ?? id;

  const recordInterview = async (interview: ScheduledInterview, decision: 'accepted' | 'rejected') => {
    const reason = (opinions[interview.id] || '').trim();
    if (!reason) {
      setInterviewError({ id: interview.id, message: 'Write your opinion of this teacher before giving your yes or no.' });
      return;
    }
    setDecidingId(interview.id);
    setInterviewError(null);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not record the decision.');
      setMyInterviews((prev) => prev.filter((i) => i.id !== interview.id));
      setOpinions((prev) => { const next = { ...prev }; delete next[interview.id]; return next; });
      if (data.candidate) setCandidates((prev) => prev.map((c) => (c.id === data.candidate.id ? data.candidate : c)));
    } catch (e) {
      setInterviewError({ id: interview.id, message: e instanceof Error ? e.message : 'Could not record the decision.' });
    } finally {
      setDecidingId(null);
    }
  };

  const initial = (me?.name || email || 'R').trim().charAt(0).toUpperCase();

  const topBar = (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size="md" />
          {me && <Badge tone="indigo" className="hidden sm:inline-flex">{me.role_name}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh} disabled={loading} className={buttonClass('ghost', 'sm')} aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <NotificationBell schoolId={schoolId} />
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              aria-label="Account"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((o) => !o)}
              className="flex items-center gap-1 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <span className="w-8 h-8 rounded-full bg-slate-800 text-white text-sm font-semibold flex items-center justify-center">{initial}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 z-50">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{me?.name || 'Signed in'}</p>
                  {email && <p className="text-xs text-slate-500 truncate">{email}</p>}
                </div>
                <Link href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                  <Globe className="w-4 h-4 text-slate-400" /> Visit the website
                </Link>
                <a href="/api/auth/logout" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                  <LogOut className="w-4 h-4 text-slate-400" /> Log out
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );

  const shell = (body: React.ReactNode) => (
    <div className="min-h-screen bg-slate-50">
      {topBar}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">{body}</main>
    </div>
  );

  if (loading && !access && !candidates.length) {
    return shell(<div className="h-48 flex items-center justify-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>);
  }

  if (loadError) {
    return shell(
      <Card>
        <EmptyState
          Icon={AlertCircle}
          title="We could not load your reviews"
          description={loadError}
          action={<button type="button" onClick={refresh} className={buttonClass('primary')}><RefreshCw className="w-4 h-4" /> Try again</button>}
        />
      </Card>
    );
  }

  if (!access) {
    // The sign-in details have not arrived (or the session ended).
    return shell(
      <Card>
        <EmptyState
          Icon={AlertCircle}
          title="Checking who you are…"
          description="If this stays here, your session may have ended. Log in again to continue."
          action={<a href="/login?next=/reviewer/ih" className={buttonClass('primary')}>Log in again</a>}
        />
      </Card>
    );
  }

  return shell(
    <>
      <PageHeader
        title={`Welcome, ${(me?.name || '').split(' ')[0] || 'reviewer'}`}
        description={
          myRounds.length
            ? `You give the yes or no in: ${myRounds.map((r) => r.name).join(', ')}. Read each teacher’s report, write your opinion, then decide.`
            : 'You are not assigned to a review round yet. The school admin chooses who reviews each round in Settings.'
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Waiting for you" value={waiting.length} hint="Teachers needing your yes or no" Icon={ClipboardCheck} tone="amber" />
        <StatCard label="Interviews" value={myInterviews.length} hint="Scheduled with you" Icon={Calendar} tone="indigo" />
        <StatCard label="Decided" value={decidedByMe.length} hint="Your yes and no answers" Icon={CheckCircle2} tone="emerald" />
      </div>

      {/* Waiting for this reviewer */}
      <Card>
        <CardHeader
          title={`Waiting for your yes or no (${waiting.length})`}
          description="Open a report, read it, then give your decision."
          action={waiting.length > 4 ? (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or subject"
                aria-label="Search teachers waiting for you"
                className={`${inputClass} pl-9`}
              />
            </div>
          ) : undefined}
        />
        {waiting.length === 0 ? (
          <EmptyState Icon={ClipboardCheck} title="You are all caught up" description="No teachers are waiting for you right now. New ones appear here as soon as they reach your round." />
        ) : filteredWaiting.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No one matches “{search}”.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredWaiting.map(({ c, round }) => (
              <li key={c.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{[c.applied_subject, c.applied_segment].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="amber">{round?.name} round</Badge>
                  <button type="button" onClick={() => setReportId(c.id)} className={buttonClass('primary', 'sm')}>
                    <Sparkles className="w-4 h-4" /> Open report and decide
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* My scheduled interviews */}
      <Card>
        <CardHeader
          title={`My scheduled interviews (${myInterviews.length})`}
          description="When HR books an interview with you, it shows here with the meeting link. After it, write your opinion and give your yes or no."
        />
        {sortedInterviews.length === 0 ? (
          <EmptyState Icon={Calendar} title="Nothing scheduled" description="No interviews are booked with you right now." />
        ) : (
          <div className="space-y-4">
            {sortedInterviews.map((intv) => {
              const c = candidateFor(intv.candidate_id);
              const soon = startsIn(intv.scheduled_at);
              const busy = decidingId === intv.id;
              const err = interviewError?.id === intv.id ? interviewError.message : '';
              return (
                <div key={intv.id} className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{c?.name || 'Candidate'}</p>
                        <Badge tone="slate">{roundName(intv.round)}</Badge>
                        <Badge tone={soon.tone}>{soon.text}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{[c?.applied_subject, c?.applied_segment].filter(Boolean).join(' · ')}</p>
                      <p className="text-xs text-slate-600 inline-flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {whenLabel(intv.scheduled_at)} · {intv.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c && (
                        <button type="button" onClick={() => setReportId(c.id)} className={buttonClass('secondary', 'sm')}>
                          <Sparkles className="w-4 h-4" /> Report
                        </button>
                      )}
                      <a href={intv.meeting_link} target="_blank" rel="noreferrer" className={buttonClass('primary', 'sm')}>
                        <Video className="w-4 h-4" /> Join meeting <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                  {intv.notes && <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">Note from HR: {intv.notes}</p>}
                  <textarea
                    value={opinions[intv.id] || ''}
                    onChange={(e) => {
                      setOpinions((prev) => ({ ...prev, [intv.id]: e.target.value }));
                      if (err) setInterviewError(null);
                    }}
                    rows={3}
                    aria-label={`Your opinion of ${c?.name || 'this teacher'}`}
                    placeholder="After the interview: your opinion of this teacher (required)"
                    className={inputClass}
                  />
                  {err && <p role="alert" className="text-sm font-semibold text-rose-700">{err}</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => recordInterview(intv, 'accepted')}
                      className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />} Yes, move ahead
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => recordInterview(intv, 'rejected')}
                      className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 disabled:opacity-50 cursor-pointer"
                    >
                      <ThumbsDown className="w-4 h-4" /> No
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* When this reviewer is free: HR books into these times */}
      <AvailabilityCard schoolId={schoolId} />

      {/* What this reviewer has decided */}
      <Card>
        <CardHeader title="Your recent decisions" description="Your latest yes and no answers, with your own words." />
        {decidedByMe.length === 0 ? (
          <EmptyState Icon={History} title="No decisions yet" description="Once you give a yes or no, it is kept here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {decidedByMe.slice(0, 15).map(({ c, d }) => (
              <li key={`${c.id}-${d.decided_at}`} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">{c.name} <span className="font-normal text-slate-500">· {d.round_label}</span></span>
                  {d.decision === 'accepted'
                    ? <Badge tone="emerald"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</Badge>
                    : <Badge tone="rose"><XCircle className="w-3.5 h-3.5" /> No</Badge>}
                </div>
                {d.reason && <p className="text-sm text-slate-600 mt-1">{d.reason}</p>}
                <p className="text-xs text-slate-400 mt-1">{new Date(d.decided_at).toLocaleString('en-IN')}</p>
              </li>
            ))}
          </ul>
        )}
        {decidedByMe.length > 15 && <p className="text-xs text-slate-400 mt-3">Showing your latest 15 of {decidedByMe.length}.</p>}
      </Card>

      {reportId && (
        <CandidateProfileModal
          isOpen={!!reportId}
          candidateId={reportId}
          onClose={() => setReportId(null)}
          onCandidateUpdated={(updated: Candidate) => {
            setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </>
  );
}
