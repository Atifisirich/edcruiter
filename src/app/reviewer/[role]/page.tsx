'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Video, CheckCircle2, Clock, Sparkles, Award, Calendar, ExternalLink, Loader2
} from 'lucide-react';
import { Candidate, School, ScheduledInterview } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import OfferLetterModal from '@/components/reviewer/OfferLetterModal';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';

interface PageProps {
  params: Promise<{ role: string }>;
}

export default function ReviewerStudioPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const rawRole = resolvedParams.role.toLowerCase();
  const currentRole = (rawRole === 'ih' ? 'ih' : rawRole === 'coo' ? 'coo' : 'rm') as 'rm' | 'ih' | 'coo';

  const [school, setSchool] = useState<School | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dossierCandidateId, setDossierCandidateId] = useState<string | null>(null);

  // HR-scheduled interviews assigned to whoever is signed in right now.
  // This is deliberately the ONLY way to record a round outcome — this
  // page used to also offer a free "pick any candidate from the full
  // school roster, drag some 1-5 sliders, type a note, click Approve"
  // panel with a fabricated https://meet.google.com/edcruiter-<id> link
  // that led nowhere real. That panel recorded to the exact same
  // {role}_clearance field this one does, so it was a fully working
  // bypass of the entire "HR schedules, both sides are notified, the
  // meeting actually happens" design — a reviewer could silently
  // rubber-stamp or reject anyone, for any round, without a real
  // interview ever taking place.
  const [myInterviews, setMyInterviews] = useState<ScheduledInterview[]>([]);
  const [interviewReasons, setInterviewReasons] = useState<Record<string, string>>({});
  const [decidingInterviewId, setDecidingInterviewId] = useState<string | null>(null);
  const [interviewError, setInterviewError] = useState('');

  // Offer dispatch (COO round only) — collected explicitly rather than
  // falling back to invented values. The previous version always passed
  // joiningDate="15 June 2026" and targetBranchName="Manneguda Main
  // Campus" to every offer letter, for every candidate, at every school.
  const [offerCandidateId, setOfferCandidateId] = useState<string | null>(null);
  const [offerSalary, setOfferSalary] = useState('');
  const [offerBranchId, setOfferBranchId] = useState('');
  const [offerJoiningDate, setOfferJoiningDate] = useState('');

  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCurrentUser(d))
      .catch(() => setCurrentUser(null));
  }, []);

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const fetchReviewerData = async () => {
    try {
      const [schRes, candRes, intvRes] = await Promise.all([
        fetch(`/api/schools?school_id=${schoolId}`),
        fetch(`/api/candidates?school_id=${schoolId}`),
        fetch(`/api/interviews?mine=1&school_id=${schoolId}`)
      ]);
      const schData = await schRes.json();
      const candData = await candRes.json();
      const intvData = await intvRes.json().catch(() => ({}));
      if (schData.school) setSchool(schData.school);
      if (candData.candidates) setCandidates(candData.candidates);
      setMyInterviews((intvData.interviews || []).filter((i: ScheduledInterview) => i.status === 'scheduled'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewerData();
  }, [currentRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const candidateFor = (candidateId: string) => candidates.find((c) => c.id === candidateId);

  const recordInterviewDecision = async (interview: ScheduledInterview, decision: 'accepted' | 'rejected') => {
    const reason = (interviewReasons[interview.id] || '').trim();
    if (!reason) {
      setInterviewError('Write why you are accepting or declining this teacher.');
      return;
    }
    setDecidingInterviewId(interview.id);
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
      setInterviewReasons((prev) => { const next = { ...prev }; delete next[interview.id]; return next; });
      if (data.candidate) {
        setCandidates((prev) => prev.map((c) => (c.id === data.candidate.id ? data.candidate : c)));
        // A COO acceptance is the trigger for the offer letter, not a
        // separate button sitting next to any candidate regardless of
        // whether they were actually approved — open the dispatch flow
        // for exactly the candidate who just cleared this round.
        if (currentRole === 'coo' && decision === 'accepted') {
          setOfferCandidateId(data.candidate.id);
          setOfferSalary(data.candidate.expected_salary || '');
          setOfferBranchId(data.candidate.target_branch_id || '');
          setOfferJoiningDate('');
        }
      }
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : 'Could not record the decision.');
    } finally {
      setDecidingInterviewId(null);
    }
  };

  // Approved at COO but the offer letter itself hasn't been dispatched yet
  // (coo_clearance.decision is set the moment the interview decision is
  // recorded; status only flips to 'hired' once OfferLetterModal actually
  // dispatches). Lets a COO come back to this later rather than losing the
  // candidate if they close the dispatch panel without sending it.
  const readyForOffer = currentRole === 'coo'
    ? candidates.filter((c) => c.coo_clearance?.decision === 'offer_issued' && c.status !== 'hired')
    : [];

  const openOfferDispatch = (c: Candidate) => {
    setOfferCandidateId(c.id);
    setOfferSalary(c.expected_salary || '');
    setOfferBranchId(c.target_branch_id || '');
    setOfferJoiningDate('');
  };

  const offerCandidate = offerCandidateId ? candidateFor(offerCandidateId) || null : null;
  const offerBranchName = school?.branches?.find((b) => b.id === offerBranchId)?.name || '';

  const roleTitles = {
    rm: { name: 'Reporting Manager (HOD)', desc: 'Subject-lead interview: pedagogical mastery & lesson scaffold review', badge: 'RM Panel' },
    ih: { name: 'Institute Head (Principal)', desc: 'Leadership interview: culture, curriculum vision & safeguarding', badge: 'IH Panel' },
    coo: { name: 'COO / Management Board', desc: 'Final review: compensation fitment & offer dispatch', badge: 'COO Board' }
  };

  const currentRoleInfo = roleTitles[currentRole];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* TOP SEQUENTIAL ROUND SWITCHER */}
      <div className="glass-card p-6 rounded-3xl border border-zinc-800 bg-[#121216] shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-[#ea580c] text-white shadow-md">
              {currentRoleInfo.badge}
            </span>
            <h1 className="text-xl font-black">{currentRoleInfo.name}</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">{currentRoleInfo.desc}</p>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 text-xs font-bold">
          {([
            { key: 'rm', label: '1. RM Round' },
            { key: 'ih', label: '2. Institute Head' },
            { key: 'coo', label: '3. COO Final & Offer' },
          ] as const).map((r) => (
            <button
              key={r.key}
              onClick={() => router.push(`/reviewer/${r.key}`)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                currentRole === r.key ? 'bg-[#ea580c] text-white shadow-md' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* My scheduled interviews — the only path to a decision */}
      <div className="glass-card p-6 rounded-3xl border border-zinc-800 bg-[#121216] shadow-2xl space-y-3">
        <h2 className="text-sm font-black text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#ea580c]" /> My scheduled interviews ({myInterviews.length})
        </h2>
        {myInterviews.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Nothing scheduled for you right now. HR allots a time, a real meeting link, and notifies you and the
            candidate — it will show up here.
          </p>
        ) : (
          <div className="space-y-3">
            {myInterviews.map((intv) => {
              const c = candidateFor(intv.candidate_id);
              return (
                <div key={intv.id} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-white">{c?.name || 'Candidate'}</p>
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
                          onClick={() => setDossierCandidateId(c.id)}
                          className="px-3 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> AI dossier
                        </button>
                      )}
                      <a href={intv.meeting_link} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl bg-[#ea580c] text-white text-[11px] font-bold inline-flex items-center gap-1.5">
                        <Video className="w-3.5 h-3.5" /> Join meeting <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  {intv.notes && <p className="text-[11px] text-zinc-400">Note from HR: {intv.notes}</p>}
                  <textarea
                    value={interviewReasons[intv.id] || ''}
                    onChange={(e) => setInterviewReasons((prev) => ({ ...prev, [intv.id]: e.target.value }))}
                    rows={2}
                    placeholder="After the interview: why are you accepting or declining? (required to record an outcome)"
                    className="w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decidingInterviewId === intv.id}
                      onClick={() => recordInterviewDecision(intv, 'accepted')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white disabled:opacity-50 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {decidingInterviewId === intv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={decidingInterviewId === intv.id}
                      onClick={() => recordInterviewDecision(intv, 'rejected')}
                      className="flex-1 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-200 disabled:opacity-50 cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
            {interviewError && <p className="text-xs text-rose-400 font-semibold">{interviewError}</p>}
          </div>
        )}
      </div>

      {/* Approved at this round, offer letter not yet sent (COO only) */}
      {currentRole === 'coo' && readyForOffer.length > 0 && (
        <div className="glass-card p-6 rounded-3xl border border-zinc-800 bg-[#121216] shadow-2xl space-y-3">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-[#ea580c]" /> Approved — offer letter not yet sent ({readyForOffer.length})
          </h2>
          <div className="space-y-2">
            {readyForOffer.map((c) => (
              <div key={c.id} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{c.name}</p>
                  <p className="text-[11px] text-zinc-400">{c.applied_subject} · {c.applied_segment}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openOfferDispatch(c)}
                  className="burgundy-gradient-btn px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Prepare offer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offer dispatch — collects real salary/branch/joining date before
          the letter can be opened, rather than letting the modal fall back
          to invented ones. */}
      {offerCandidate && (
        <div className="glass-card p-6 rounded-3xl border border-orange-500/40 bg-[#121216] shadow-2xl space-y-3">
          <h2 className="text-sm font-black text-white">Offer details for {offerCandidate.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-xs font-bold text-zinc-300">
              Offered salary
              <input
                value={offerSalary}
                onChange={(e) => setOfferSalary(e.target.value)}
                placeholder="e.g. 7.5 LPA"
                className="mt-1 w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100"
              />
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Campus / branch
              <select
                value={offerBranchId}
                onChange={(e) => setOfferBranchId(e.target.value)}
                className="mt-1 w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100"
              >
                <option value="">Select…</option>
                {(school?.branches || []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold text-zinc-300">
              Joining date
              <input
                type="date"
                value={offerJoiningDate}
                onChange={(e) => setOfferJoiningDate(e.target.value)}
                className="mt-1 w-full p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-100"
              />
            </label>
          </div>
          <p className="text-[11px] text-zinc-500">Fill in all three to preview and dispatch the offer letter below.</p>
          {offerSalary.trim() && offerBranchId && offerJoiningDate && (
            <OfferLetterModal
              school={school}
              candidate={offerCandidate}
              offeredSalary={offerSalary.trim()}
              joiningDate={new Date(offerJoiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              targetBranchName={offerBranchName}
              onClose={() => setOfferCandidateId(null)}
              onDispatched={() => {
                setOfferCandidateId(null);
                fetchReviewerData();
              }}
            />
          )}
        </div>
      )}

      {/* Candidate Full AI Dossier Modal */}
      {dossierCandidateId && (
        <CandidateProfileModal
          isOpen={!!dossierCandidateId}
          candidateId={dossierCandidateId}
          onClose={() => setDossierCandidateId(null)}
          onCandidateUpdated={(updated: Candidate) => {
            setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}

    </div>
  );
}
