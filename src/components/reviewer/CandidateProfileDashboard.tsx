'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Check, CheckCircle2, Clock, Copy, Download, ExternalLink,
  FileText, Loader2, ShieldAlert, Sparkles, Video, X
} from 'lucide-react';
import { Candidate, EvaluationRecord, ProctoringEvent, StageAttempt, StageResult } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import PolicyAnswersPanel from '@/components/reviewer/PolicyAnswersPanel';
import { ageFromDob } from '@/lib/age';
import { candidateState } from '@/lib/candidateProgress';
import { MAX_ATTEMPTS } from '@/lib/stageAttempts';
import HiringDecision from './HiringDecision';
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
  const [attempts, setAttempts] = useState<StageAttempt[]>([]);

  useEffect(() => {
    if (isOpen && candidateId) loadCandidateData();
  }, [isOpen, candidateId]);

  const loadCandidateData = async () => {
    setLoading(true);
    try {
      const candRes = await fetch(`/api/candidates/${candidateId}`);
      const candData = await candRes.json();
      if (candData.candidate) {
        setCandidate(candData.candidate);
        setStageResults(candData.stageResults || []);
        setProctoringEvents(candData.proctoringEvents || []);
        setEvaluations(candData.evaluations || []);
        setAttempts(candData.stageAttempts || []);
      } else {
        setCandidate(null);
        setStageResults([]);
        setProctoringEvents([]);
        setEvaluations([]);
        setAttempts([]);
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
              {candidate ? candidateState({ ...candidate, stages_completed: stageResults.length }).label : 'In progress'}
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
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Application ID</p>
                <p className="text-sm font-bold text-indigo-700 font-mono mt-1 break-all" title="The ID in the candidate's invite message. The candidate signs in with it if their link expires.">{candidate.invite_code || '—'}</p>
              </div>
            </section>

            <TeachingProfilePanel candidateId={candidateId} scoredStagesDone={completedScored >= 3} />

            <HiringDecision
              candidate={candidate}
              onChanged={(next) => { setCandidate(next); onCandidateUpdated?.(next); }}
            />

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
              <h2 className="text-sm font-black text-slate-900">Application details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {[
                  ['Full name', candidate.name],
                  ['Email', candidate.email || '—'],
                  ['Phone', candidate.phone || '—'],
                  ['Date of birth', candidate.dob ? `${candidate.dob}${ageFromDob(candidate.dob) !== null ? ` (age ${ageFromDob(candidate.dob)})` : ''}` : '—'],
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

                        {result.policy_answers?.length ? (
                          <PolicyAnswersPanel answers={result.policy_answers} video={result.policy_video} />
                        ) : null}

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

            {(() => {
              const behaviour = stageResults.find((r) => r.behaviour)?.behaviour;
              if (!behaviour) return null;
              const { typing, mcq, signals } = behaviour;
              return (
                <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-black text-slate-900">How the written answers were produced</h2>
                  </div>
                  {signals.length === 0 ? (
                    <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">Nothing unusual in how the answers were entered.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {signals.map((s) => (
                        <li key={s} className="text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-2xl p-3">{s}</li>
                      ))}
                    </ul>
                  )}
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {mcq && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <dt className="text-slate-500">Time between answers</dt>
                        <dd className="font-bold text-slate-900">{mcq.median_gap_seconds}s typical</dd>
                      </div>
                    )}
                    {typing && !typing.touch && (
                      <>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <dt className="text-slate-500">Lesson plan</dt>
                          <dd className="font-bold text-slate-900">{typing.words_final} words</dd>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <dt className="text-slate-500">Corrections</dt>
                          <dd className="font-bold text-slate-900">{typing.deletions}</dd>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <dt className="text-slate-500">Thinking pauses</dt>
                          <dd className="font-bold text-slate-900">{typing.pauses_over_4s}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <p className="text-[11px] text-slate-500">
                    These are signals to weigh, not proof. A fast, fluent typist can trigger some of them, and typing is not judged on phones. They never change a score. A few follow-up questions in the interview about the candidate&apos;s own lesson plan are the best check.
                  </p>
                </section>
              );
            })()}

            <section className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <h2 className="text-sm font-black text-slate-900">Proctoring</h2>
              </div>
              {candidate.face_reference?.photo_url ? (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={candidate.face_reference.photo_url} alt="Photo taken at the start" className="w-16 h-16 rounded-xl object-cover border border-slate-200 -scale-x-100" />
                  <p className="text-xs text-slate-600">
                    <strong className="block text-slate-900">Photo taken at the start</strong>
                    {candidate.face_reference.measured
                      ? 'Each stage and a check every few seconds are compared with this photo. Different faces are listed below.'
                      : 'The automatic face check was not available on this device, so compare this photo with the video yourself.'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">No start photo was taken, so nobody could check that the same person took every stage.</p>
              )}
              {attempts.some((a) => a.number > 1 || a.status === 'abandoned') && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                  <p className="font-bold">Stages that were left and started again</p>
                  <ul className="list-disc list-inside">
                    {Object.entries(attempts.reduce<Record<string, StageAttempt[]>>((m, a) => { (m[a.stage_key] ||= []).push(a); return m; }, {}))
                      .filter(([, list]) => list.length > 1)
                      .map(([stage, list]) => (
                        <li key={stage}>{stage.replace(/_/g, ' ')}: {list.length} goes ({list.filter((a) => a.status === 'abandoned').length} left unfinished). Each restart had different questions.</li>
                      ))}
                  </ul>
                  {Object.entries(attempts.reduce<Record<string, StageAttempt[]>>((m, a) => { (m[a.stage_key] ||= []).push(a); return m; }, {}))
                    .filter(([stage, list]) => list.length >= MAX_ATTEMPTS + (candidate.extra_attempts?.[stage as keyof typeof candidate.extra_attempts] ?? 0) && list.every((a) => a.status !== 'open'))
                    .map(([stage]) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/candidates/${candidate.id}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'allow_retry', stage_key: stage }) });
                          const data = await res.json().catch(() => ({}));
                          if (data.candidate) { setCandidate(data.candidate); onCandidateUpdated?.(data.candidate); }
                        }}
                        className="mt-1 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-bold text-amber-950 cursor-pointer"
                      >
                        Allow one more go at {stage.replace(/_/g, ' ')}
                      </button>
                    ))}
                </div>
              )}
              {proctoringEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No proctoring events recorded for this candidate.</p>
              ) : (
                <ul className="space-y-2">
                  {proctoringEvents.map((evt) => (
                    <li key={evt.id} className={`p-3 rounded-2xl border text-xs flex flex-wrap justify-between gap-2 ${evt.event_type === 'IDENTITY_MISMATCH' ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                      <div>
                        <span className="font-bold text-slate-900">{evt.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500"> · {evt.stage_key.replace(/_/g, ' ')}</span>
                        {evt.details ? <p className="text-slate-600 mt-0.5">{evt.details}</p> : null}
                        {evt.snapshot_url ? (
                          <a href={evt.snapshot_url} target="_blank" rel="noreferrer" className="inline-block mt-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={evt.snapshot_url} alt="Camera picture at the time" className="w-24 h-auto rounded-lg border border-rose-200 -scale-x-100" />
                          </a>
                        ) : null}
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

          </>
        )}
      </div>
    </div>
  );
}
