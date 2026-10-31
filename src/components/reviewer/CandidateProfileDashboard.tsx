'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, Clock, Copy, Download, ExternalLink,
  FileText, Loader2, ShieldAlert, Sparkles, Video, X
} from 'lucide-react';
import { Candidate, EvaluationRecord, ProctoringEvent, StageResult } from '@/lib/types';
import { SLOKA_SCHOOL_ID, SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { isScoredStage } from '@/lib/scoredStages';
import { cleanResumeReport } from '@/lib/reportText';
import TeachingProfilePanel from './TeachingProfilePanel';

interface CandidateProfileDashboardProps {
  isOpen: boolean;
  candidateId: string;
  onClose: () => void;
  onCandidateUpdated?: (updatedCandidate: Candidate) => void;
  layout?: 'modal' | 'page';
}

function averageStageScore(result?: StageResult): number | null {
  const dims = result?.ai_scores?.scores;
  if (!dims?.length) return null;
  const avg = dims.reduce((sum, d) => sum + (Number(d.score) || 0), 0) / dims.length;
  return Math.round(avg * 10);
}

function overallFromStages(results: StageResult[], fallback?: number): number | null {
  const scores = results
    .filter((r) => isScoredStage(r.stage_key))
    .map(averageStageScore)
    .filter((n): n is number => n !== null);
  if (scores.length) {
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return typeof fallback === 'number' && fallback > 0 ? fallback : null;
}

function hasDeterministicScores(results: StageResult[]): boolean {
  return results.some((r) => r.ai_scores?.scoring_mode === 'deterministic_fallback');
}

export default function CandidateProfileDashboard({
  isOpen,
  candidateId,
  onClose,
  onCandidateUpdated,
  layout = 'modal'
}: CandidateProfileDashboardProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [rmNotes, setRmNotes] = useState('');
  const [ihNotes, setIhNotes] = useState('');
  const [cooNotes, setCooNotes] = useState('');
  const [savingClearance, setSavingClearance] = useState(false);
  const [schoolRejectReason, setSchoolRejectReason] = useState('');
  const [candidateRejectReason, setCandidateRejectReason] = useState('');
  const [outcomeBusy, setOutcomeBusy] = useState(false);

  useEffect(() => {
    if (isOpen && candidateId) loadCandidateData();
  }, [isOpen, candidateId]);

  const loadCandidateData = async () => {
    setLoading(true);
    try {
      const candRes = await fetch(`/api/candidates/${candidateId}?school_id=${SLOKA_SCHOOL_ID}`);
      const candData = await candRes.json();
      if (candData.candidate) {
        setCandidate(candData.candidate);
        setStageResults(candData.stageResults || []);
        setProctoringEvents(candData.proctoringEvents || []);
        setEvaluations(candData.evaluations || []);
        if (candData.candidate.rm_clearance?.notes) setRmNotes(candData.candidate.rm_clearance.notes);
        if (candData.candidate.ih_clearance?.notes) setIhNotes(candData.candidate.ih_clearance.notes);
        if (candData.candidate.coo_clearance?.notes) setCooNotes(candData.candidate.coo_clearance.notes);
      } else {
        setCandidate(null);
        setStageResults([]);
        setProctoringEvents([]);
        setEvaluations([]);
      }
    } catch (err) {
      console.error('Failed to load candidate profile:', err);
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && layout !== 'page') return null;

  const handleCopyTestLink = () => {
    const testUrl = `${window.location.origin}/candidate/${candidateId}`;
    const code = candidate?.invite_code || candidateId;
    navigator.clipboard.writeText(`Code: ${code}\nLink: ${testUrl}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleUpdateClearance = async (role: 'rm' | 'ih' | 'coo', status: 'cleared' | 'rejected' | 'hold') => {
    if (!candidate) return;
    const notes = role === 'rm' ? rmNotes : role === 'ih' ? ihNotes : cooNotes;
    if (status === 'rejected' && !notes.trim()) {
      alert('Please enter a rejection reason before rejecting.');
      return;
    }
    setSavingClearance(true);
    try {
      const updates: Record<string, unknown> = {
        [`${role}_clearance`]: {
          role,
          reviewer_name: role === 'rm' ? 'Head of Department' : role === 'ih' ? 'Principal' : 'Management Board',
          status,
          notes: notes || `${role.toUpperCase()} updated to ${status}.`,
          rating: 5,
          completed_at: new Date().toISOString()
        },
        status: status === 'cleared' && role === 'coo' ? 'hired' : status === 'rejected' ? 'rejected' : candidate.status
      };
      if (status === 'rejected') {
        updates.rejected_by_school_at = new Date().toISOString();
        updates.rejected_by_school_reason = notes.trim();
      }
      if (status === 'cleared' && role === 'coo') {
        updates.selected_at = new Date().toISOString();
        updates.offer_letter_sent_at = new Date().toISOString();
      }
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: SLOKA_SCHOOL_ID,
          updates
        })
      });
      const data = await res.json();
      if (data.candidate) {
        setCandidate(data.candidate);
        onCandidateUpdated?.(data.candidate);
      }
    } catch {
      alert('Failed to update clearance');
    } finally {
      setSavingClearance(false);
    }
  };

  const recordOutcome = async (kind: 'selected' | 'offer' | 'school_reject' | 'candidate_reject') => {
    if (!candidate) return;
    if (kind === 'school_reject' && !schoolRejectReason.trim()) {
      alert('Enter why the school is rejecting this teacher.');
      return;
    }
    if (kind === 'candidate_reject' && !candidateRejectReason.trim()) {
      alert('Enter why the candidate declined (required).');
      return;
    }
    setOutcomeBusy(true);
    try {
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = {};
      if (kind === 'selected') {
        updates.status = 'hired';
        updates.selected_at = now;
        updates.shortlist_status = 'shortlisted';
      }
      if (kind === 'offer') {
        updates.offer_letter_sent_at = now;
        updates.selected_at = candidate.selected_at || now;
        updates.status = 'hired';
      }
      if (kind === 'school_reject') {
        updates.status = 'rejected';
        updates.rejected_by_school_at = now;
        updates.rejected_by_school_reason = schoolRejectReason.trim();
        updates.shortlist_status = 'rejected';
      }
      if (kind === 'candidate_reject') {
        updates.rejected_by_candidate_at = now;
        updates.rejected_by_candidate_reason = candidateRejectReason.trim();
        updates.status = 'rejected';
      }
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: candidate.school_id || SLOKA_SCHOOL_ID, updates })
      });
      const data = await res.json();
      if (data.candidate) {
        setCandidate(data.candidate);
        onCandidateUpdated?.(data.candidate);
        setSchoolRejectReason('');
        setCandidateRejectReason('');
      }
    } finally {
      setOutcomeBusy(false);
    }
  };

  // Each point once: the summary, the mismatches and the red flags used to repeat one another.
  const resumeReport = candidate?.resume_analysis ? cleanResumeReport(candidate.resume_analysis, { crossList: true }) : undefined;
  const overallScore = overallFromStages(stageResults, candidate?.total_ai_score);
  const identityResult = stageResults.find(r => r.stage_key === 'identity_verification');
  const scoredWithoutAi = stageResults.filter(
    (r) => isScoredStage(r.stage_key) && !r.ai_scores?.scores?.length
  );
  const usedDeterministic = hasDeterministicScores(stageResults);
  const completedScored = stageResults.filter((r) => isScoredStage(r.stage_key)).length;

  return (
    <div className={layout === 'page' ? 'w-full' : 'fixed inset-0 z-50 bg-[#f8fafc] overflow-y-auto'}>
      <div className={layout === 'page' ? 'space-y-6' : 'max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6'}>
        <header className="bg-white border border-slate-200 rounded-3xl px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              {layout === 'page' ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shrink-0">
              {candidate?.name?.[0] || 'C'}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black text-slate-900 truncate">{candidate?.name || 'Candidate profile'}</h1>
              <p className="text-xs text-slate-500">
                {candidate?.applied_subject || 'Subject pending'} · {candidate?.applied_segment || 'Segment pending'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
              {candidate?.status?.replace('_', ' ') || 'In progress'}
            </span>
            <button
              type="button"
              onClick={handleCopyTestLink}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Copied' : 'Copy test code'}
            </button>
            <a
              href={`/candidate/${candidateId}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl border border-slate-200 text-slate-600"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </header>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading candidate profile…</p>
          </div>
        ) : !candidate ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">Candidate not found.</div>
        ) : (
          <>
            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall AI score</p>
                <p className="text-2xl font-black text-slate-900 font-mono">
                  {overallScore !== null ? overallScore : '—'}
                  <span className="text-xs font-medium text-slate-400"> / 100</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">CV fitment</p>
                <p className="text-2xl font-black text-slate-900 font-mono">
                  {resumeReport?.overall_fitment_score ?? '—'}
                  <span className="text-xs font-medium text-slate-400"> / 10</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stages done</p>
                <p className="text-2xl font-black text-slate-900 font-mono">{stageResults.length}/5</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Invite code</p>
                <p className="text-sm font-bold text-indigo-700 font-mono mt-1">{candidate.invite_code || candidateId}</p>
              </div>
            </section>

            <TeachingProfilePanel candidateId={candidateId} scoredStagesDone={completedScored >= 3} />

            {(usedDeterministic || scoredWithoutAi.length > 0) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Scoring notice
                </p>
                {usedDeterministic && (
                  <p>
                    Live Gemini scoring was unavailable for one or more stages, so the report uses
                    provisional offline scores from the submitted answers/videos (not invented demo marks).
                    Video stages are completeness-based until Gemini can re-score.
                  </p>
                )}
                {scoredWithoutAi.length > 0 && (
                  <p>
                    No AI dimension scores stored yet for:{' '}
                    {scoredWithoutAi.map((r) => r.stage_name || r.stage_key).join(', ')}.
                  </p>
                )}
                {completedScored === 0 && stageResults.length > 0 && (
                  <p>Identity/HR stages do not contribute to the overall AI score.</p>
                )}
              </div>
            )}

            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-black text-slate-900">Hiring outcome actions</h2>
                <p className="text-xs text-slate-500">Marks feed the dashboard timelines (today / 30 days / year / till date). Rejections require a reason.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={outcomeBusy} onClick={() => recordOutcome('selected')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">
                  Mark selected
                </button>
                <button type="button" disabled={outcomeBusy} onClick={() => recordOutcome('offer')} className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold">
                  Offer letter sent
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 p-3 rounded-2xl border border-rose-100 bg-rose-50/50">
                  <p className="text-xs font-bold text-rose-900">Rejected by school — why?</p>
                  <textarea
                    value={schoolRejectReason}
                    onChange={(e) => setSchoolRejectReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs p-2 rounded-xl border border-rose-200 bg-white"
                    placeholder="e.g. Subject depth weak in demo; board preference not met"
                  />
                  <button type="button" disabled={outcomeBusy} onClick={() => recordOutcome('school_reject')} className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-800 text-xs font-bold bg-white">
                    Save school rejection
                  </button>
                  {candidate.rejected_by_school_reason && (
                    <p className="text-[11px] text-rose-800">Saved: {candidate.rejected_by_school_reason}</p>
                  )}
                </div>
                <div className="space-y-2 p-3 rounded-2xl border border-amber-100 bg-amber-50/50">
                  <p className="text-xs font-bold text-amber-950">Rejected by candidate — why?</p>
                  <textarea
                    value={candidateRejectReason}
                    onChange={(e) => setCandidateRejectReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs p-2 rounded-xl border border-amber-200 bg-white"
                    placeholder="e.g. Accepted another offer; salary; location; notice period"
                  />
                  <button type="button" disabled={outcomeBusy} onClick={() => recordOutcome('candidate_reject')} className="px-3 py-1.5 rounded-xl border border-amber-300 text-amber-950 text-xs font-bold bg-white">
                    Save candidate decline
                  </button>
                  {candidate.rejected_by_candidate_reason && (
                    <p className="text-[11px] text-amber-900">Saved: {candidate.rejected_by_candidate_reason}</p>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-900">Application details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {[
                  ['Full name', candidate.name],
                  ['Email', candidate.email || '—'],
                  ['Phone', candidate.phone || '—'],
                  ['Date of birth', candidate.dob || '—'],
                  ['Qualification (form)', candidate.qualification || '—'],
                  ['Experience claimed', candidate.experience_band || '—'],
                  ['Prior organisation', candidate.prior_org || '—'],
                  ['Location', candidate.current_location || '—'],
                  ['Notice period', candidate.notice_period || '—'],
                  ['Current salary', candidate.current_salary || '—'],
                  ['Expected salary', candidate.expected_salary || '—'],
                  ['Languages', candidate.languages?.length ? candidate.languages.join(', ') : '—']
                ].map(([label, value]) => (
                  <div key={label} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="font-semibold text-slate-800 mt-0.5 break-words">{value}</p>
                  </div>
                ))}
              </div>
              {identityResult?.written_submission && (
                <p className="text-[11px] text-slate-500">{identityResult.written_submission}</p>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-black text-slate-900">Overall Edcruiter AI report</h2>
              </div>
              {resumeReport?.eligibility_verdict === 'not_eligible' && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {resumeReport.eligibility_summary || 'This CV does not meet the usual bar for this vacancy.'}
                </div>
              )}
              {resumeReport?.form_vs_cv_discrepancies && resumeReport.form_vs_cv_discrepancies.length > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <p className="font-bold">Form vs CV mismatches</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {resumeReport.form_vs_cv_discrepancies.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              )}
              <p className="text-sm text-slate-700 leading-relaxed">
                {resumeReport?.career_trajectory?.summary
                  || resumeReport?.eligibility_summary
                  || (stageResults.length
                    ? 'Stage-level AI notes are listed with each assessment below.'
                    : 'The teacher has not finished enough stages for a full report yet.')}
              </p>
              {resumeReport?.red_flags && resumeReport.red_flags.length > 0 && (
                <ul className="text-xs text-slate-700 space-y-1">
                  {resumeReport.red_flags.map((flag) => (
                    <li key={flag} className="flex gap-2"><span className="text-indigo-600">•</span>{flag}</li>
                  ))}
                </ul>
              )}
              {!resumeReport && candidate.resume_url && (
                <p className="text-xs text-slate-500">CV uploaded, but resume analysis was not stored for this candidate.</p>
              )}
            </section>

            <div className="space-y-4">
              {SLOKA_DEFAULT_STAGES.map((stg) => {
                const result = stageResults.find(r => r.stage_key === stg.key);
                const score = isScoredStage(stg.key) ? averageStageScore(result) : null;
                const mediaUrl = result?.media_url || (result as { video_url?: string } | undefined)?.video_url;
                const isCvStage = stg.key === 'identity_verification';
                const isOffline = result?.ai_scores?.scoring_mode === 'deterministic_fallback';

                return (
                  <section key={stg.key} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Stage {stg.order} of 5</p>
                        <h3 className="text-base font-black text-slate-900">{stg.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {score !== null && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {score}/100
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          result
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          {result ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                          {result ? 'Completed' : 'Not submitted'}
                        </span>
                      </div>
                    </div>

                    {!result ? (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> This stage has no answers yet.
                      </p>
                    ) : (
                      <>
                        {isCvStage && resumeReport && (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2 text-[11px]">
                              <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">B.Ed: {resumeReport.qualifications_match?.b_ed_status || 'Unknown'}</span>
                              <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">Name on CV: {resumeReport.name_on_cv || 'Not extracted'}</span>
                              <span className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">CV years: {resumeReport.total_experience_years ?? '—'}</span>
                            </div>
                            {candidate.resume_url && (
                              <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                                <Download className="w-3.5 h-3.5" /> Open uploaded CV
                              </a>
                            )}
                            {resumeReport.recommended_interview_probes?.length ? (
                              <div>
                                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Suggested interview probes</p>
                                <ol className="list-decimal pl-4 text-xs text-slate-700 space-y-1">
                                  {resumeReport.recommended_interview_probes.map((p) => <li key={p}>{p}</li>)}
                                </ol>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {isCvStage && !resumeReport && candidate.resume_url && (
                          <a href={candidate.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600">
                            <Download className="w-3.5 h-3.5" /> Open uploaded CV
                          </a>
                        )}

                        {result.written_submission && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" /> Candidate answers
                            </p>
                            <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[420px] overflow-y-auto">
                              {result.written_submission}
                            </pre>
                          </div>
                        )}

                        {mediaUrl && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" /> Submitted video
                            </p>
                            <video src={mediaUrl} controls className="w-full rounded-2xl border border-slate-200 bg-black max-h-80" />
                          </div>
                        )}

                        {isScoredStage(stg.key) && (
                        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                            Edcruiter AI — this stage
                            {isOffline ? ' (provisional / offline)' : ''}
                          </p>
                          {!result.ai_scores?.scores?.length ? (
                            <p className="text-xs text-amber-800">
                              No AI scores were stored for this submission. Answers and video above are still available for human review.
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-slate-800 leading-relaxed">
                                {result.ai_scores?.evidence_reference
                                  || result.reviewer_notes
                                  || 'AI notes were not stored for this submission.'}
                              </p>
                              {result.ai_scores?.identified_gaps && result.ai_scores.identified_gaps.length > 0 && (
                                <ul className="text-xs text-slate-700 space-y-0.5">
                                  {result.ai_scores.identified_gaps.map((g) => <li key={g}>• {g}</li>)}
                                </ul>
                              )}
                              {result.ai_scores?.scores?.map((dim) => (
                                <div key={dim.dimension} className="flex justify-between gap-3 text-xs border-t border-indigo-100 pt-2">
                                  <span className="text-slate-600">{dim.dimension.replace(/_/g, ' ')}</span>
                                  <span className="font-mono font-bold text-indigo-700">{dim.score}/10</span>
                                </div>
                              ))}
                              {result.ai_scores?.scores?.map((dim) => dim.justification ? (
                                <p key={`${dim.dimension}-j`} className="text-[11px] text-slate-600">{dim.dimension.replace(/_/g, ' ')}: {dim.justification}</p>
                              ) : null)}
                            </>
                          )}
                        </div>
                        )}
                      </>
                    )}
                  </section>
                );
              })}
            </div>

            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-black text-slate-900">Proctoring</h2>
              </div>
              {proctoringEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No proctoring events recorded for this candidate.</p>
              ) : (
                <ul className="space-y-2">
                  {proctoringEvents.map((evt) => (
                    <li key={evt.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900">{evt.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500"> · {evt.stage_key.replace(/_/g, ' ')}</span>
                        {evt.details ? <p className="text-slate-600 mt-0.5">{evt.details}</p> : null}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {evaluations.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
                <h2 className="text-sm font-black text-slate-900">Human review notes</h2>
                {evaluations.map((ev) => (
                  <p key={ev.id} className="text-xs text-slate-600">
                    <strong>{ev.reviewer_name}</strong> ({ev.reviewer_role}): {ev.notes}
                  </p>
                ))}
              </section>
            )}

            {candidate.shortlist_status === 'shortlisted' && (
              <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900">Leadership interview</h2>
                  <p className="text-xs text-slate-500">Subject lead, then principal, then management. Use this only after the school shortlists the teacher.</p>
                </div>
                {(candidate.interview_decisions || []).length > 0 && (
                  <ul className="space-y-2">
                    {(candidate.interview_decisions || []).map((d, i) => (
                      <li key={`${d.decided_at}-${i}`} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="font-bold">{d.round_label} · {d.reviewer_name}</span>
                          <span className={d.decision === 'accepted' ? 'text-indigo-700 font-bold' : 'text-rose-700 font-bold'}>
                            {d.decision === 'accepted' ? 'Accepted' : 'Declined'}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1">{d.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {(['rm', 'ih', 'coo'] as const).map((role) => {
                  const notes = role === 'rm' ? rmNotes : role === 'ih' ? ihNotes : cooNotes;
                  const setNotes = role === 'rm' ? setRmNotes : role === 'ih' ? setIhNotes : setCooNotes;
                  const label = role === 'rm' ? 'Subject lead' : role === 'ih' ? 'Principal' : 'Management';
                  return (
                    <div key={role} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                      <p className="text-xs font-bold text-slate-900">{label}</p>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Interview notes"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50"
                      />
                      <div className="flex gap-2">
                        <button type="button" disabled={savingClearance} onClick={() => handleUpdateClearance(role, 'cleared')} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                          Clear
                        </button>
                        <button type="button" disabled={savingClearance} onClick={() => handleUpdateClearance(role, 'rejected')} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold cursor-pointer">
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
