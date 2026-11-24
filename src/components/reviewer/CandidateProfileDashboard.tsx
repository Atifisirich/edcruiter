'use client';

import React, { useEffect, useRef, useState } from 'react';
import { copyApplicationMessage } from '@/components/admin/copyApplication';
import {
  ArrowLeft, Check, CheckCircle2, ClipboardList, Clock, Copy, ExternalLink, FileText,
  Flag, Loader2, MessageSquareQuote, Mic, Printer, ShieldAlert, ShieldCheck, Sparkles, StickyNote, UserRound, Video, X
} from 'lucide-react';
import { AiInterview, Candidate, EvaluationRecord, ProctoringEvent, StageAttempt, StageResult } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import PolicyAnswersPanel from '@/components/reviewer/PolicyAnswersPanel';
import { ageFromDob } from '@/lib/age';
import { describeEducation } from '@/lib/teacherProfile';
import { candidateState } from '@/lib/candidateProgress';
import { MAX_ATTEMPTS } from '@/lib/stageAttempts';
import HiringDecision from './HiringDecision';
import RoundReviewCard from './RoundReviewCard';
import { isScoredStage } from '@/lib/scoredStages';
import { cleanResumeReport, dedupeSimilar } from '@/lib/reportText';
import TeachingProfilePanel, { type ProfileResponse } from './TeachingProfilePanel';
import CvActions from './CvActions';
import ReadingCheckPanel from './ReadingCheckPanel';
import { GROUP_LABEL, recommendationFor, scoreLabel, type FactorGroup } from '@/lib/teachingProfile';
import {
  countTone, cvTone, eventLabel, firstSentence, flagEvents, groupEvents, integrityTone, redFlags,
  stageScore100, summariseFactors, toneFor100, topLists, verdictFor, type MetricTone,
} from '@/lib/reportVerdict';
import ReportVerdict from './report/ReportVerdict';
import WrittenAnswers from './report/WrittenAnswers';
import { parseWrittenSubmission } from '@/lib/writtenAnswers';
import AiInterviewReportView, { INTERVIEW_REC } from './report/AiInterviewReportView';
import { MiniChip, OpenCue, PointList, Points, ReportSection, SkillBlock, SubHead, TONE, type Metric } from './report/ReportUI';
import { isPlaceholderSubmission, parsePolicyText, sentences } from '@/lib/reportPoints';

interface CandidateProfileDashboardProps {
  isOpen: boolean;
  candidateId: string;
  onClose: () => void;
  onCandidateUpdated?: (updatedCandidate: Candidate) => void;
  layout?: 'modal' | 'page';
  /**
   * The AI interview section's content. The school admin's page passes the panel
   * with its invite buttons; it reports the interview back so the cards follow.
   * Without it the finished report is shown read only.
   */
  renderInterview?: (onChange: (interview: AiInterview | null) => void) => React.ReactNode;
}

const STAGE_SHORT: Record<string, string> = {
  identity_verification: 'Identity and CV',
  written_theory: 'Written test',
  micro_teaching_demo: 'Teaching demo',
  situational_scenario: 'Classroom scenario',
  hr_policy_briefing: 'School policies',
};

function stageTitle(name: string): string {
  return name.replace(/^\d+\.\s*/, '');
}

function overallFromStages(results: StageResult[], fallback?: number): number | null {
  const scores = results
    .filter((r) => isScoredStage(r.stage_key))
    .map(stageScore100)
    .filter((n): n is number => n !== null);
  if (scores.length) {
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return typeof fallback === 'number' && fallback > 0 ? fallback : null;
}

function hasDeterministicScores(results: StageResult[]): boolean {
  return results.some((r) => r.ai_scores?.scoring_mode === 'deterministic_fallback');
}


function eligibilityText(v?: string): string {
  return v === 'eligible' ? 'Meets the vacancy' : v === 'not_eligible' ? 'Does not meet the vacancy' : v === 'needs_review' ? 'Needs a look' : 'CV reviewed';
}

export default function CandidateProfileDashboard({
  isOpen,
  candidateId,
  onClose,
  onCandidateUpdated,
  layout = 'modal',
  renderInterview,
}: CandidateProfileDashboardProps) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== candidateId;
  const [copiedLink, setCopiedLink] = useState(false);
  const [attempts, setAttempts] = useState<StageAttempt[]>([]);
  const [interview, setInterview] = useState<AiInterview | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Load whenever the candidate changes. `loading` is derived, so nothing is set synchronously in the effect.
  useEffect(() => {
    if (!isOpen || !candidateId) return;
    let cancelled = false;
    fetch(`/api/candidates/${candidateId}`)
      .then((res) => res.json())
      .then((candData) => {
        if (cancelled) return;
        setCandidate(candData.candidate ?? null);
        setStageResults(candData.candidate ? candData.stageResults || [] : []);
        setProctoringEvents(candData.candidate ? candData.proctoringEvents || [] : []);
        setEvaluations(candData.candidate ? candData.evaluations || [] : []);
        setAttempts(candData.candidate ? candData.stageAttempts || [] : []);
      })
      .catch((err) => {
        console.error('Failed to load candidate profile:', err);
        if (!cancelled) setCandidate(null);
      })
      .finally(() => { if (!cancelled) setLoadedFor(candidateId); });
    return () => { cancelled = true; };
  }, [isOpen, candidateId]);

  // Without the admin's panel, read the interview ourselves (staff only; a 403 just leaves it empty).
  useEffect(() => {
    if (!isOpen || !candidateId || renderInterview) return;
    let cancelled = false;
    fetch(`/api/voice-interview?candidate_id=${encodeURIComponent(candidateId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setInterview(d?.interview ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, candidateId, renderInterview]);

  // Printing or saving as PDF shows every section, then puts them back as they were.
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = Array.from(rootRef.current?.querySelectorAll('details:not([open])') ?? []) as HTMLDetailsElement[];
      opened.forEach((d) => { d.open = true; });
    };
    const after = () => { opened.forEach((d) => { d.open = false; }); opened = []; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, []);


  if (!isOpen && layout !== 'page') return null;

  const handleCopyTestLink = async () => {
    try {
      await copyApplicationMessage(candidateId);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      /* the button simply does not change */
    }
  };

  // Each point once: the summary, the mismatches and the red flags used to repeat one another.
  const resumeReport = candidate?.resume_analysis ? cleanResumeReport(candidate.resume_analysis, { crossList: true }) : undefined;
  const profile = profileData?.profile && profileData.profile.status !== 'failed' ? profileData.profile : null;
  const report = interview?.status === 'completed' ? interview.report : undefined;
  const interviewIsReal = !!report && interview?.mode !== 'sample';

  // One headline number: the teaching profile's overall suitability, the same one the candidates list shows.
  // Until the profile is written, the plain average of the test stages is shown and labelled as such.
  const profileOverall = profile ? profile.overall.score : null;
  const stageAverage = overallFromStages(stageResults, candidate?.total_ai_score);
  const overallScore = profileOverall ?? stageAverage;
  const overallIsProfile = profileOverall !== null;
  const scoredWithoutAi = stageResults.filter((r) => isScoredStage(r.stage_key) && !r.ai_scores?.scores?.length);
  const usedDeterministic = hasDeterministicScores(stageResults);
  const completedScored = stageResults.filter((r) => isScoredStage(r.stage_key)).length;

  const verdict = verdictFor(overallScore, {
    notEligible: resumeReport?.eligibility_verdict === 'not_eligible',
    cappedReason: profile?.overall.capped_reason,
  });
  const band = overallScore !== null ? recommendationFor(overallScore, profileData?.shortlist_bands) : null;
  const interviewForLists = interviewIsReal ? report : null;
  const { strengths, concerns } = topLists({
    profileStrengths: profile?.strengths,
    profileImprovements: profile?.improvements,
    cappedReason: profile?.overall.capped_reason,
    interview: interviewForLists,
    resume: resumeReport,
  });
  const flags = redFlags({ resume: resumeReport, interview: interviewForLists, cappedReason: profile?.overall.capped_reason });
  const eventFlags = flagEvents(proctoringEvents);
  const eventGroups = groupEvents(proctoringEvents);
  const behaviour = stageResults.find((r) => r.behaviour)?.behaviour;
  const restarts = Object.entries(attempts.reduce<Record<string, StageAttempt[]>>((m, a) => { (m[a.stage_key] ||= []).push(a); return m; }, {}))
    .filter(([, list]) => list.length > 1);
  const integrityScore = profile?.measured.integrity_score ?? null;
  const intTone = integrityTone(proctoringEvents, integrityScore);
  // What each closed section says without being opened.
  const areas = (profile?.factors ?? [])
    .filter((f) => f.group === 'area' && f.confidence !== 'none' && f.score !== null)
    .map((f) => ({ key: f.key, label: f.label, score: f.score }));
  const groupChips = (['area', 'extra', 'attitude', 'resume', 'communication'] as FactorGroup[])
    .map((g) => ({ g, sum: summariseFactors((profile?.factors ?? []).filter((f) => f.group === g)) }))
    .filter((x) => x.sum.average !== null);
  const writtenParsed = parseWrittenSubmission(stageResults.find((r) => r.stage_key === 'written_theory')?.written_submission);
  const mcqRight = writtenParsed?.mcqs.filter((m) => m.correct).length ?? 0;
  const mcqTotal = writtenParsed?.mcqs.length ?? 0;
  const questions = dedupeSimilar([...(interviewIsReal ? report?.followups ?? [] : []), ...(resumeReport?.recommended_interview_probes ?? [])]);

  const summary = firstSentence(profile?.summary)
    || (interviewIsReal ? firstSentence(report?.summary) : '')
    || firstSentence(resumeReport?.career_trajectory?.summary)
    || firstSentence(resumeReport?.eligibility_summary)
    || (stageResults.length ? 'The written profile is not ready yet. The numbers below come from the finished stages.' : 'The candidate has not finished enough stages for a report yet.');

  const facts = candidate ? [
    `${stageResults.length} of 5 stages done`,
    candidate.applied_subject ? `${candidate.applied_subject}${candidate.applied_segment ? ` · ${candidate.applied_segment}` : ''}` : '',
    candidate.experience_band ? `Experience: ${candidate.experience_band}` : '',
    candidate.current_location ? candidate.current_location : '',
  ].filter(Boolean) : [];

  const metrics: Metric[] = [];
  for (const stg of SLOKA_DEFAULT_STAGES.filter((s) => isScoredStage(s.key))) {
    const result = stageResults.find((r) => r.stage_key === stg.key);
    const score = stageScore100(result);
    metrics.push({
      key: stg.key,
      label: STAGE_SHORT[stg.key] || stageTitle(stg.name),
      value: score === null ? '—' : String(score),
      unit: score === null ? undefined : '/100',
      tone: toneFor100(score),
      caption: !result ? 'Not submitted' : score === null ? 'Waiting for the AI score' : `${scoreLabel(score)}${result.ai_scores?.scoring_mode === 'deterministic_fallback' ? ' · provisional' : ''}`,
      target: `stage-${stg.key}`,
    });
  }
  {
    const rec = report ? INTERVIEW_REC[report.recommendation] : null;
    metrics.push({
      key: 'ai_interview',
      label: 'AI interview',
      value: report?.scored ? String(report.overall) : '—',
      unit: report?.scored ? '/100' : undefined,
      tone: interviewIsReal && report?.scored && rec ? rec.tone : 'none',
      caption: !interview ? 'Not invited yet'
        : interview.status === 'invited' ? 'Invited, not taken yet'
        : interview.status === 'in_progress' ? 'In progress'
        : interview.status === 'abandoned' ? 'Ended early'
        : !report ? 'Report being written'
        : interview.mode === 'sample' ? 'Sample, not this candidate'
        : !report.scored ? 'Too short to score'
        : rec?.label,
      target: 'ai-interview',
    });
  }
  metrics.push({
    key: 'cv',
    label: 'CV fit',
    value: resumeReport ? String(resumeReport.overall_fitment_score) : '—',
    unit: resumeReport ? '/10' : undefined,
    tone: cvTone(resumeReport),
    caption: resumeReport ? eligibilityText(resumeReport.eligibility_verdict) : candidate?.resume_url ? 'CV not reviewed' : 'No CV uploaded',
    target: 'sec-cv',
  });
  {
    const years = resumeReport && typeof resumeReport.total_experience_years === 'number' ? resumeReport.total_experience_years : null;
    const hopping = resumeReport?.job_hopping_risk;
    metrics.push({
      key: 'experience',
      label: 'Experience (CV)',
      value: years === null ? '—' : String(Math.round(years * 10) / 10),
      unit: years === null ? undefined : years === 1 ? 'yr' : 'yrs',
      tone: hopping === 'High' ? 'watch' : years === null ? 'none' : years > 0 ? 'good' : 'watch',
      caption: [candidate?.experience_band ? `Form: ${candidate.experience_band}` : '', hopping ? `job-hopping ${hopping.toLowerCase()}` : ''].filter(Boolean).join(' · ') || undefined,
      target: 'sec-cv',
    });
  }
  metrics.push({
    key: 'integrity',
    label: 'Integrity flags',
    value: String(eventFlags.length),
    tone: intTone,
    caption: eventFlags.length === 0
      ? (integrityScore !== null ? `No camera flags · integrity score ${integrityScore}/100` : 'Nothing unusual recorded')
      : `${eventGroups[0].count}× ${eventGroups[0].label.toLowerCase()}${integrityScore !== null ? ` · integrity ${integrityScore}/100` : ''}`,
    target: 'sec-integrity',
  });
  metrics.push({
    key: 'red_flags',
    label: 'Red flags',
    value: String(flags.length),
    tone: countTone(flags.length),
    caption: flags.length ? flags[0] : 'None from the CV or interview',
    target: flags.length ? 'sec-flags' : undefined,
  });

  const shell = layout === 'page' ? 'w-full' : 'fixed inset-0 z-50 bg-[#f8fafc] overflow-y-auto';
  const inner = layout === 'page' ? 'space-y-5' : 'max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5';

  return (
    <div className={`${shell} report-root`} ref={rootRef}>
      <div className={inner}>
        <header className="bg-white border border-slate-200 rounded-2xl px-4 sm:px-5 py-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label={layout === 'page' ? 'Back to candidates' : 'Close'}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer print:hidden"
            >
              {layout === 'page' ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0 uppercase">
              {candidate?.name?.[0] || 'C'}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate capitalize">{candidate?.name || 'Candidate report'}</h1>
              <p className="text-xs text-slate-500 truncate">
                {candidate?.applied_subject || 'Subject pending'} · {candidate?.applied_segment || 'Segment pending'}
                {candidate?.invite_code ? <> · ID <span className="font-mono text-slate-700" title="The ID in the candidate's invite message. The candidate signs in with it if their link expires.">{candidate.invite_code}</span></> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {candidate ? candidateState({ ...candidate, stages_completed: stageResults.length, done_keys: stageResults.map((r) => r.stage_key), ai_interview_status: candidate.ai_interview?.status }).label : 'In progress'}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyTestLink()}
              title="Copies a message for the candidate: their sign-in link, and their application ID for if the link stops working"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 print:hidden"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-indigo-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedLink ? 'Message copied' : 'Copy sign-in message'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="Print this report, or choose Save as PDF in the print window"
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 print:hidden"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <a
              href={`/candidate/${candidateId}`}
              target="_blank"
              rel="noreferrer"
              title="Open the candidate's own page"
              aria-label="Open the candidate's own page"
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 print:hidden"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </header>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading candidate report…</p>
          </div>
        ) : !candidate ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">Candidate not found.</div>
        ) : (
          <>
            <RoundReviewCard candidate={candidate} onChanged={(next) => { setCandidate(next); onCandidateUpdated?.(next); }} />

            <ReportVerdict
              score={overallScore}
              scoreLabel={overallIsProfile ? 'Overall score' : 'Test average'}
              scoreNote={!overallIsProfile && overallScore !== null ? 'Provisional. The final score follows once the profile is written.' : undefined}
              verdict={verdict}
              bandLabel={band?.label}
              summary={summary}
              facts={facts}
              metrics={metrics}
              areas={areas}
              strengths={strengths}
              concerns={concerns}
            />

            {(usedDeterministic || scoredWithoutAi.length > 0) && (
              <p className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-px" />
                <span>
                  {usedDeterministic && 'Live AI scoring was unavailable for one or more stages, so those scores are provisional, worked out offline from the answers and videos. '}
                  {scoredWithoutAi.length > 0 && `No AI scores stored yet for ${scoredWithoutAi.map((r) => STAGE_SHORT[r.stage_key] || r.stage_name || r.stage_key).join(', ')}.`}
                </span>
              </p>
            )}

            <HiringDecision
              candidate={candidate}
              onChanged={(next) => { setCandidate(next); onCandidateUpdated?.(next); }}
            />

            <div className="space-y-3">
              <h2 className="pt-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">The detail behind the verdict</h2>

              {flags.length > 0 && (
                <ReportSection id="sec-flags" icon={<Flag className="w-4 h-4" />} title="Red flags" hint="From the CV, the application form and the AI interview" badge={String(flags.length)} badgeTone={countTone(flags.length)}
                  preview={<>{flags.slice(0, 2).map((f) => <MiniChip key={f} tone="concern" label={f} />)}{flags.length > 2 && <MiniChip label={`+${flags.length - 2} more`} />}</>}
                >
                  <PointList items={flags} tone="concern" empty="" />
                </ReportSection>
              )}

              <ReportSection
                id="sec-skills"
                preview={groupChips.length ? <>{groupChips.map(({ g, sum }) => <MiniChip key={g} tone={toneFor100(sum.average)} label={GROUP_LABEL[g]} value={String(sum.average)} />)}</> : undefined}
                icon={<Sparkles className="w-4 h-4" />}
                title="Teaching skills and evidence"
                hint="Each teaching area with its score, reason and the candidate's own words"
                badge={profile ? (profileOverall !== null ? `${profileOverall}/100` : 'Not enough evidence') : 'Not written yet'}
                badgeTone={profile ? toneFor100(profileOverall) : 'none'}
              >
                <TeachingProfilePanel candidateId={candidateId} scoredStagesDone={completedScored >= 3} onData={setProfileData} hideOverall embedded />
              </ReportSection>

              <ReportSection
                id="ai-interview"
                preview={report?.scored && report.topics.length ? <>{report.topics.map((t) => <MiniChip key={t.key} tone={interview?.mode === 'sample' || !t.score ? 'none' : t.score >= 8 ? 'good' : t.score >= 5 ? 'watch' : 'concern'} label={t.name} value={t.score ? `${t.score}/10` : '—'} />)}</> : undefined}
                icon={<Mic className="w-4 h-4" />}
                title="AI interview"
                hint="Spoken interview: score per topic, quotes and the transcript"
                badge={report?.scored ? `${report.overall}/100${interview?.mode === 'sample' ? ' · sample' : ''}` : interview ? (interview.status === 'completed' ? 'Done' : interview.status === 'invited' ? 'Invited' : interview.status === 'in_progress' ? 'In progress' : 'Ended early') : 'Not invited'}
                badgeTone={interviewIsReal && report?.scored ? INTERVIEW_REC[report.recommendation]?.tone ?? 'none' : 'none'}
              >
                {renderInterview
                  ? renderInterview(setInterview)
                  : interview?.status === 'completed' && report
                    ? <AiInterviewReportView interview={interview} candidateName={candidate.name} />
                    : <p className="text-sm text-slate-500">{interview ? 'No finished interview report yet.' : 'The candidate has not been invited to the AI interview.'}</p>}
              </ReportSection>

              <ReportSection
                id="sec-questions"
                preview={questions.length ? <span className="w-full text-sm text-slate-600 line-clamp-1"><span className="font-semibold text-slate-800">1.</span> {questions[0]}{questions.length > 1 ? <span className="text-slate-400"> · +{questions.length - 1} more</span> : null}</span> : undefined}
                icon={<MessageSquareQuote className="w-4 h-4" />}
                title="Questions for your interview"
                hint="To ask in the next round or the demo class"
                badge={questions.length ? String(questions.length) : 'None yet'}
              >
                {questions.length ? (
                  <ol className="space-y-2.5">
                    {questions.map((q, i) => (
                      <li key={q} className="flex gap-3 text-sm text-slate-800 leading-snug">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="pt-0.5">{q}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-slate-500">Questions appear here from the CV review and the AI interview.</p>
                )}
              </ReportSection>

              <ReportSection
                id="sec-cv"
                preview={resumeReport ? <>
                  <MiniChip tone={cvTone(resumeReport)} label={eligibilityText(resumeReport.eligibility_verdict)} />
                  <MiniChip tone={/yes|complete|found|has|holds/i.test(resumeReport.qualifications_match?.b_ed_status || '') ? 'good' : 'none'} label="B.Ed" value={(resumeReport.qualifications_match?.b_ed_status || 'Unknown').slice(0, 28)} />
                  <MiniChip label="Years on CV" value={String(resumeReport.total_experience_years ?? '—')} />
                  {resumeReport.career_stability_index && <MiniChip tone={resumeReport.career_stability_index === 'High' ? 'good' : resumeReport.career_stability_index === 'Volatile' ? 'concern' : 'watch'} label="Stability" value={resumeReport.career_stability_index} />}
                  {(resumeReport.form_vs_cv_discrepancies?.length ?? 0) > 0 && <MiniChip tone="watch" label="Form vs CV mismatches" value={String(resumeReport.form_vs_cv_discrepancies!.length)} />}
                </> : undefined}
                icon={<FileText className="w-4 h-4" />}
                title="CV review and application"
                hint={resumeReport ? eligibilityText(resumeReport.eligibility_verdict) : 'The form the candidate filled in'}
                badge={resumeReport ? `${resumeReport.overall_fitment_score}/10` : 'No review'}
                badgeTone={cvTone(resumeReport)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                  <CvActions resumeUrl={candidate.resume_url} candidateName={candidate.name} />
                </div>
                {resumeReport ? (
                  <>
                    {resumeReport.eligibility_summary && (
                      <p className={`text-sm p-3.5 rounded-xl border ${TONE[cvTone(resumeReport)].chip}`}>{resumeReport.eligibility_summary}</p>
                    )}
                    {resumeReport.career_trajectory?.summary && <p className="text-sm text-slate-700 leading-relaxed">{resumeReport.career_trajectory.summary}</p>}
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        ['B.Ed', resumeReport.qualifications_match?.b_ed_status || 'Unknown'],
                        ['CTET / TET', resumeReport.qualifications_match?.ctet_tet_status || 'Unknown'],
                        ['Years on CV', String(resumeReport.total_experience_years ?? '—')],
                        ['Average tenure', resumeReport.average_tenure_years ? `${resumeReport.average_tenure_years} yrs` : '—'],
                        ['Career stability', resumeReport.career_stability_index || '—'],
                        ['Job-hopping risk', resumeReport.job_hopping_risk || '—'],
                        ['Subject match', resumeReport.qualifications_match?.alignment_with_subject || '—'],
                        ['Name on CV', resumeReport.name_on_cv || 'Not read'],
                      ].map(([label, value]) => (
                        <div key={label} className="report-card p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                          <dd className="text-sm font-semibold text-slate-900 mt-0.5 break-words line-clamp-3">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><SubHead>Good signs</SubHead><PointList items={dedupeSimilar([...(resumeReport.green_flags ?? []), ...(resumeReport.pedagogical_highlights ?? [])])} tone="good" empty="None noted." /></div>
                      <div><SubHead>Red flags</SubHead><PointList items={resumeReport.red_flags ?? []} tone="concern" empty="None noted." /></div>
                    </div>
                    {resumeReport.form_vs_cv_discrepancies && resumeReport.form_vs_cv_discrepancies.length > 0 && (
                      <div><SubHead>Form and CV do not match</SubHead><PointList items={resumeReport.form_vs_cv_discrepancies} tone="watch" empty="" /></div>
                    )}
                    {resumeReport.career_gaps?.length > 0 && (
                      <div>
                        <SubHead>Career gaps</SubHead>
                        <PointList items={resumeReport.career_gaps.map((g) => [g.period, g.duration_months ? `${g.duration_months} months` : '', g.description].filter(Boolean).join(' · ')).filter(Boolean)} tone="watch" empty="" />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-500">{candidate.resume_url ? 'CV uploaded, but it has not been reviewed.' : 'No CV uploaded.'}</p>
                )}

                <div>
                  <SubHead>Application form</SubHead>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5 text-sm">
                    {[
                      ['Full name', candidate.name],
                      ['Email', candidate.email || '—'],
                      ['Phone', candidate.phone || '—'],
                      ['Date of birth', candidate.dob ? `${candidate.dob}${ageFromDob(candidate.dob) !== null ? ` (age ${ageFromDob(candidate.dob)})` : ''}` : '—'],
                      ['Qualification (form)', candidate.qualification || '—'],
                      ...describeEducation(candidate.education).map((r) => [r.label, r.value]),
                      ...(candidate.boards_taught?.length ? [['Boards taught', candidate.boards_taught.join(', ')]] : []),
                      ['Experience claimed', candidate.experience_band || '—'],
                      ['Prior organisation', candidate.prior_org || '—'],
                      ['Location', candidate.current_location || '—'],
                      ['Notice period', candidate.notice_period || '—'],
                      ['Current salary', candidate.current_salary || '—'],
                      ['Expected salary', candidate.expected_salary || '—'],
                      ['Languages', candidate.languages?.length ? candidate.languages.join(', ') : '—'],
                      ['Application ID', candidate.invite_code || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-slate-100 pb-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
                        <dd className="text-slate-800 mt-0.5 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </ReportSection>

              <ReportSection
                id="sec-stages"
                preview={<>
                  {SLOKA_DEFAULT_STAGES.map((stg) => {
                    const r = stageResults.find((x) => x.stage_key === stg.key);
                    const sc = isScoredStage(stg.key) ? stageScore100(r) : null;
                    return <MiniChip key={stg.key} tone={!r ? 'none' : sc !== null ? toneFor100(sc) : 'good'} label={STAGE_SHORT[stg.key] || stageTitle(stg.name)} value={!r ? 'Not done' : sc !== null ? String(sc) : '✓'} />;
                  })}
                  {mcqTotal > 0 && <MiniChip tone={mcqRight / mcqTotal >= 0.8 ? 'good' : mcqRight / mcqTotal >= 0.5 ? 'watch' : 'concern'} label="MCQs right" value={`${mcqRight}/${mcqTotal}`} />}
                </>}
                icon={<ClipboardList className="w-4 h-4" />}
                title="Stage answers"
                hint="What the candidate wrote and recorded, and the AI notes per stage"
                badge={`${stageResults.length}/5 done`}
                badgeTone={stageResults.length >= 5 ? 'good' : stageResults.length ? 'watch' : 'none'}
              >
                <div className="space-y-2.5">
                  {SLOKA_DEFAULT_STAGES.map((stg) => {
                    const result = stageResults.find((r) => r.stage_key === stg.key);
                    const score = isScoredStage(stg.key) ? stageScore100(result) : null;
                    const mediaUrl = result?.media_url || (result as { video_url?: string } | undefined)?.video_url;
                    const isOffline = result?.ai_scores?.scoring_mode === 'deterministic_fallback';
                    const written = parseWrittenSubmission(result?.written_submission);
                    const structured = !!written && written.mcqs.length > 0;
                    const policyFromText = !result?.policy_answers?.length ? parsePolicyText(result?.written_submission) : null;
                    const placeholder = isPlaceholderSubmission(result?.written_submission);
                    const lead = sentences(result?.ai_scores?.evidence_reference || result?.reviewer_notes);
                    const tone: MetricTone = score !== null ? toneFor100(score) : 'none';
                    return (
                      <details key={stg.key} id={`stage-${stg.key}`} className="group/stage scroll-mt-20 rounded-xl border border-slate-200 bg-slate-50/40">
                        <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-3 sm:px-4 py-3 flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-600 flex items-center justify-center shrink-0">{stg.order}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-slate-900 truncate">{STAGE_SHORT[stg.key] || stageTitle(stg.name)}</span>
                            <span className="block text-xs text-slate-500 truncate">{stageTitle(stg.name)}</span>
                          </span>
                          {score !== null && <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold tabular-nums ${TONE[tone].chip}`}>{score}/100</span>}
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${result ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {result ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{result ? 'Done' : 'Not submitted'}</span>
                          </span>
                          <OpenCue rotate="group-open/stage:rotate-180" size="sm" />
                        </summary>
                        <div className="px-2 sm:px-4 pb-3 sm:pb-4 pt-1 space-y-4">
                          {!result ? (
                            <p className="text-sm text-slate-500">This stage has no answers yet.</p>
                          ) : (
                            <>
                              {structured && result && <WrittenAnswers parsed={written!} result={result} />}

                              {isScoredStage(stg.key) && !structured && (
                                <div className="space-y-3">
                                  <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-2.5">
                                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                                      AI review
                                      {isOffline && <span className={`normal-case tracking-normal px-2 py-0.5 rounded-full border ${TONE.watch.chip}`}>Provisional, scored offline</span>}
                                    </p>
                                    {!result.ai_scores?.scores?.length ? (
                                      <p className="text-sm text-amber-800">No AI scores were stored for this submission. The answers and video are below for a person to review.</p>
                                    ) : (
                                      <>
                                        {lead.length > 0 && <p className="text-[15px] font-semibold text-slate-900 leading-snug">{lead[0]}</p>}
                                        {lead.length > 1 && <Points text={lead.slice(1).join(' ')} />}
                                        {result.ai_scores?.identified_gaps && result.ai_scores.identified_gaps.length > 0 && (
                                          <div className="pt-1">
                                            <SubHead>What is missing</SubHead>
                                            <Points points={result.ai_scores.identified_gaps.map((g) => ({ text: g, tone: 'watch' as const }))} />
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  {(result.ai_scores?.scores?.length ?? 0) > 0 && (
                                    <div className="grid gap-3 xl:grid-cols-2">
                                      {result.ai_scores!.scores!.map((dim) => (
                                        <SkillBlock
                                          key={dim.dimension}
                                          name={dim.dimension.replace(/_/g, ' ')}
                                          score={Number(dim.score) || 0}
                                          measures={dim.pedagogical_benchmark}
                                          text={dim.justification}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {result.policy_answers?.length ? (
                                <PolicyAnswersPanel answers={result.policy_answers} video={result.policy_video} />
                              ) : policyFromText ? (
                                <PolicyAnswersPanel answers={policyFromText.answers} note={policyFromText.note} />
                              ) : null}

                              {placeholder && (
                                <p className="inline-flex items-center gap-1.5 text-sm text-emerald-800">
                                  <CheckCircle2 className="w-4 h-4" /> {result.written_submission}
                                </p>
                              )}

                              {result.written_submission && !structured && !policyFromText && !placeholder && (
                                <div>
                                  <SubHead>Candidate answers</SubHead>
                                  <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 leading-relaxed bg-white p-4 rounded-xl border border-slate-100 max-h-[420px] overflow-y-auto print:max-h-none">
                                    {result.written_submission}
                                  </pre>
                                </div>
                              )}

                              {mediaUrl && (
                                <div className="print:hidden">
                                  <SubHead><span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Submitted video</span></SubHead>
                                  <video id={`stage-video-${stg.key}`} src={mediaUrl} controls preload="metadata" className="w-full rounded-xl border border-slate-200 bg-black max-h-80" />
                                </div>
                              )}

                              {mediaUrl && (
                                <ReadingCheckPanel
                                  events={proctoringEvents.filter((e) => e.stage_key === stg.key)}
                                  delivery={result.ai_scores?.delivery_check}
                                  onSeek={(seconds) => {
                                    const v = document.getElementById(`stage-video-${stg.key}`) as HTMLVideoElement | null;
                                    if (v) { v.currentTime = seconds; v.play().catch(() => {}); v.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
                                  }}
                                />
                              )}
                            </>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </ReportSection>

              <ReportSection
                id="sec-integrity"
                preview={eventGroups.length || restarts.length ? <>
                  {eventGroups.slice(0, 4).map((g) => <MiniChip key={g.type} tone={g.serious ? 'concern' : 'watch'} label={g.label} value={`${g.count}×`} />)}
                  {restarts.length > 0 && <MiniChip tone="watch" label="Stages restarted" value={String(restarts.length)} />}
                </> : <MiniChip tone="good" label="No proctoring events" />}
                icon={<ShieldCheck className="w-4 h-4" />}
                title="Proctoring and integrity"
                hint="Camera checks, restarts and how the written answers were entered"
                badge={eventFlags.length ? `${eventFlags.length} flag${eventFlags.length === 1 ? '' : 's'}` : 'Clean'}
                badgeTone={intTone}
              >
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  {candidate.face_reference?.photo_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={candidate.face_reference.photo_url} alt="Photo taken at the start" className="w-16 h-16 rounded-xl object-cover border border-slate-200 -scale-x-100" />
                      <p className="text-sm text-slate-600">
                        <strong className="block text-slate-900">Photo taken at the start</strong>
                        {candidate.face_reference.measured
                          ? 'Each stage and a check every few seconds are compared with this photo.'
                          : 'The automatic face check was not available on this device, so compare this photo with the video yourself.'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-900 flex items-center gap-2"><UserRound className="w-4 h-4 shrink-0" /> No start photo was taken, so nobody could check that the same person took every stage.</p>
                  )}
                </div>

                {eventGroups.length > 0 ? (
                  <div>
                    <SubHead>What the checks saw</SubHead>
                    <ul className="flex flex-wrap gap-2">
                      {eventGroups.map((g) => (
                        <li key={g.type} className={`px-3 py-1.5 rounded-full border text-sm ${TONE[g.serious ? 'concern' : 'watch'].chip}`}>
                          <span className="font-bold tabular-nums">{g.count}×</span> {g.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className={`text-sm p-3 rounded-xl border ${TONE.good.chip}`}>No proctoring events were recorded.</p>
                )}

                {restarts.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950 space-y-1.5">
                    <p className="font-semibold">Stages left and started again</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {restarts.map(([stage, list]) => (
                        <li key={stage}>{STAGE_SHORT[stage] || stage.replace(/_/g, ' ')}: {list.length} goes ({list.filter((a) => a.status === 'abandoned').length} left unfinished). Each restart had different questions.</li>
                      ))}
                    </ul>
                    {restarts
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
                          className="mt-1 mr-2 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-amber-950 cursor-pointer print:hidden"
                        >
                          Allow one more go at {STAGE_SHORT[stage] || stage.replace(/_/g, ' ')}
                        </button>
                      ))}
                  </div>
                )}

                {behaviour && (
                  <div className="space-y-2">
                    <SubHead>How the written answers were entered</SubHead>
                    {behaviour.signals.length === 0 ? (
                      <p className={`text-sm p-3 rounded-xl border ${TONE.good.chip}`}>Nothing unusual in how the answers were entered.</p>
                    ) : (
                      <PointList items={behaviour.signals} tone="watch" empty="" />
                    )}
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      {behaviour.mcq && (
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"><dt className="text-xs text-slate-500">Time between answers</dt><dd className="font-semibold text-slate-900">{behaviour.mcq.median_gap_seconds}s typical</dd></div>
                      )}
                      {behaviour.typing && !behaviour.typing.touch && (
                        <>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"><dt className="text-xs text-slate-500">Lesson plan</dt><dd className="font-semibold text-slate-900">{behaviour.typing.words_final} words</dd></div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"><dt className="text-xs text-slate-500">Corrections</dt><dd className="font-semibold text-slate-900">{behaviour.typing.deletions}</dd></div>
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100"><dt className="text-xs text-slate-500">Thinking pauses</dt><dd className="font-semibold text-slate-900">{behaviour.typing.pauses_over_4s}</dd></div>
                        </>
                      )}
                    </dl>
                    <p className="text-xs text-slate-500">Signals to weigh, not proof. A fast, fluent typist can trigger some, and typing is not judged on phones. They never change a score. Ask about their own lesson plan in the interview.</p>
                  </div>
                )}

                {proctoringEvents.some((e) => e.snapshot_url) && (
                  <div>
                    <SubHead>Camera pictures at the time</SubHead>
                    <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
                      {proctoringEvents.filter((e) => e.snapshot_url).map((e) => (
                        <li key={e.id} className="report-card">
                          <a href={e.snapshot_url} target="_blank" rel="noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={e.snapshot_url} alt={eventLabel(e.event_type)} loading="lazy" className={`w-full aspect-[4/3] object-cover rounded-lg border -scale-x-100 ${e.event_type === 'IDENTITY_MISMATCH' ? 'border-rose-300' : 'border-slate-200'}`} />
                          </a>
                          <p className="mt-1 text-[11px] text-slate-500 leading-tight line-clamp-2">{eventLabel(e.event_type)} · {STAGE_SHORT[e.stage_key] || e.stage_key.replace(/_/g, ' ')}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {proctoringEvents.length > 0 && (
                  <details className="group/ev rounded-xl border border-slate-200">
                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-4 py-2.5 flex items-center justify-between gap-3 text-sm font-semibold text-indigo-700">
                      Every event, in order ({proctoringEvents.length})
                      <OpenCue rotate="group-open/ev:rotate-180" size="sm" />
                    </summary>
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                      {proctoringEvents.map((evt) => (
                        <li key={evt.id} className={`px-4 py-2.5 text-sm flex flex-wrap justify-between gap-x-3 gap-y-0.5 ${evt.event_type === 'IDENTITY_MISMATCH' ? 'bg-rose-50' : ''}`}>
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-900">{eventLabel(evt.event_type)}</span>
                            <span className="text-slate-500"> · {STAGE_SHORT[evt.stage_key] || evt.stage_key.replace(/_/g, ' ')}</span>
                            {evt.details ? <span className="block text-xs text-slate-600 mt-0.5">{evt.details}</span> : null}
                          </span>
                          <span className="text-xs text-slate-400 tabular-nums shrink-0">{evt.timestamp ? new Date(evt.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </ReportSection>

              {evaluations.length > 0 && (
                <ReportSection id="sec-notes" icon={<StickyNote className="w-4 h-4" />} title="Reviewer notes" hint="What your team wrote" badge={String(evaluations.length)}>
                  <ul className="space-y-2.5">
                    {evaluations.map((ev) => (
                      <li key={ev.id} className="text-sm text-slate-700 leading-relaxed">
                        <strong className="text-slate-900">{ev.reviewer_name}</strong> <span className="text-slate-500">({ev.reviewer_role})</span>: {ev.notes}
                      </li>
                    ))}
                  </ul>
                </ReportSection>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
