'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Video, CheckCircle2, Clock, Sparkles, Calendar, ExternalLink, Loader2, ClipboardCheck, History } from 'lucide-react';
import { Candidate, ScheduledInterview } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { canDecideRound, currentRound } from '@/lib/reviewRounds';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';
import { useReviewAccess } from '@/components/reviewer/useReviewAccess';

/**
 * A reviewer's home. The rounds they review are set by the school admin in
 * Settings, so this shows the teachers waiting for this person's yes or no,
 * the interviews HR has scheduled with them, and what they have already
 * decided. The old /reviewer/rm, /ih and /coo addresses all land here.
 */
export default function ReviewerHomePage() {
  const access = useReviewAccess();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);

  // HR-scheduled interviews assigned to whoever is signed in right now.
  const [myInterviews, setMyInterviews] = useState<ScheduledInterview[]>([]);
  const [opinions, setOpinions] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [interviewError, setInterviewError] = useState('');

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const load = async () => {
    try {
      const [candRes, intvRes] = await Promise.all([
        fetch(`/api/candidates?school_id=${schoolId}`),
        fetch(`/api/interviews?mine=1&school_id=${schoolId}`),
      ]);
      const candData = await candRes.json();
      const intvData = await intvRes.json().catch(() => ({}));
      if (candData.candidates) setCandidates(candData.candidates);
      setMyInterviews((intvData.interviews || []).filter((i: ScheduledInterview) => i.status === 'scheduled'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const me = access?.me;
  const rounds = useMemo(() => access?.rounds ?? [], [access]);
  const myRounds = me ? rounds.filter((r) => canDecideRound(me, r)) : [];

  const waiting = useMemo(() => {
    if (!me) return [];
    return candidates
      .filter((c) => c.status !== 'rejected' && !c.rejected_by_school_at && !c.selected_at && (c.shortlist_status === 'shortlisted' || c.status === 'passed'))
      .map((c) => ({ c, round: currentRound(c, rounds) }))
      .filter((x) => x.round && canDecideRound(me, x.round));
  }, [candidates, rounds, me]);

  const decidedByMe = useMemo(() => {
    if (!me) return [];
    return candidates
      .flatMap((c) => (c.interview_decisions || []).filter((d) => d.reviewer_id === me.id).map((d) => ({ c, d })))
      .sort((a, b) => b.d.decided_at.localeCompare(a.d.decided_at))
      .slice(0, 15);
  }, [candidates, me]);

  const candidateFor = (id: string) => candidates.find((c) => c.id === id);
  const roundName = (id: string) => rounds.find((r) => r.id === id)?.name ?? id;

  const recordInterview = async (interview: ScheduledInterview, decision: 'accepted' | 'rejected') => {
    const reason = (opinions[interview.id] || '').trim();
    if (!reason) {
      setInterviewError('Write your opinion of this teacher before giving your yes or no.');
      return;
    }
    setDecidingId(interview.id);
    setInterviewError('');
    try {
      const res = await fetch(`/api/interviews/${interview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record the decision.');
      setMyInterviews((prev) => prev.filter((i) => i.id !== interview.id));
      setOpinions((prev) => { const next = { ...prev }; delete next[interview.id]; return next; });
      if (data.candidate) setCandidates((prev) => prev.map((c) => (c.id === data.candidate.id ? data.candidate : c)));
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : 'Could not record the decision.');
    } finally {
      setDecidingId(null);
    }
  };

  if (loading || !access) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const card = 'glass-card p-6 rounded-3xl border border-zinc-800 bg-[#121216] shadow-2xl space-y-3';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className={card}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-xs font-black bg-[#ea580c] text-white shadow-md">{me?.role_name}</span>
          <h1 className="text-xl font-black">{me?.name}</h1>
        </div>
        <p className="text-xs text-zinc-400">
          {myRounds.length
            ? `You give the yes or no in: ${myRounds.map((r) => r.name).join(', ')}. Read each teacher’s report, write your opinion, then decide.`
            : 'You are not assigned to a review round yet. The school admin chooses who reviews each round in Settings.'}
        </p>
      </div>

      {/* Waiting for this reviewer */}
      <div className={card}>
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-[#ea580c]" /> Waiting for your yes or no ({waiting.length})
        </h2>
        {waiting.length === 0 ? (
          <p className="text-xs text-zinc-400">No teachers are waiting for you right now.</p>
        ) : (
          <ul className="space-y-2">
            {waiting.map(({ c, round }) => (
              <li key={c.id} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-[11px] text-zinc-400">{c.applied_subject} · {c.applied_segment} · {round?.name} round</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReportId(c.id)}
                  className="px-3 py-1.5 rounded-xl bg-[#ea580c] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Open report and decide
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* My scheduled interviews */}
      <div className={card}>
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#ea580c]" /> My scheduled interviews ({myInterviews.length})
        </h2>
        {myInterviews.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Nothing scheduled for you right now. When HR books an interview with you, it shows here with the meeting link.
          </p>
        ) : (
          <div className="space-y-3">
            {myInterviews.map((intv) => {
              const c = candidateFor(intv.candidate_id);
              return (
                <div key={intv.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{c?.name || 'Candidate'} · {roundName(intv.round)}</p>
                      <p className="text-[11px] text-zinc-400">{c?.applied_subject} · {c?.applied_segment}</p>
                      <p className="text-[11px] text-zinc-400 inline-flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(intv.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {' '}· {intv.duration_minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c && (
                        <button
                          type="button"
                          onClick={() => setReportId(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Report
                        </button>
                      )}
                      <a href={intv.meeting_link} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl bg-[#ea580c] text-white text-[11px] font-bold inline-flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> Join meeting <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  {intv.notes && <p className="text-[11px] text-zinc-400">Note from HR: {intv.notes}</p>}
                  <textarea
                    value={opinions[intv.id] || ''}
                    onChange={(e) => setOpinions((prev) => ({ ...prev, [intv.id]: e.target.value }))}
                    rows={2}
                    placeholder="After the interview: your opinion of this teacher (required)"
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decidingId === intv.id}
                      onClick={() => recordInterview(intv, 'accepted')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {decidingId === intv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Yes
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === intv.id}
                      onClick={() => recordInterview(intv, 'rejected')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-200 disabled:opacity-50 cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                </div>
              );
            })}
            {interviewError && <p className="text-xs text-rose-400 font-semibold">{interviewError}</p>}
          </div>
        )}
      </div>

      {/* What this reviewer has decided */}
      <div className={card}>
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <History className="w-4 h-4 text-[#ea580c]" /> Your recent decisions
        </h2>
        {decidedByMe.length === 0 ? (
          <p className="text-xs text-zinc-400">You have not decided on anyone yet.</p>
        ) : (
          <ul className="space-y-2">
            {decidedByMe.map(({ c, d }) => (
              <li key={`${c.id}-${d.decided_at}`} className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-white">{c.name} · {d.round_label}</span>
                  <span className={`font-bold ${d.decision === 'accepted' ? 'text-emerald-400' : 'text-rose-400'}`}>{d.decision === 'accepted' ? 'Yes' : 'No'}</span>
                </div>
                <p className="text-zinc-400 mt-1">{d.reason}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{new Date(d.decided_at).toLocaleString('en-IN')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

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
    </div>
  );
}
