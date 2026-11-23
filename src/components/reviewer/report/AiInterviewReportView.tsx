'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AiInterview } from '@/lib/types';
import { PointList, SubHead, TONE } from './ReportUI';
import type { MetricTone } from '@/lib/reportVerdict';

export const INTERVIEW_REC: Record<string, { label: string; tone: MetricTone }> = {
  strong: { label: 'Strong interview', tone: 'good' },
  good: { label: 'Good interview', tone: 'good' },
  mixed: { label: 'Mixed interview', tone: 'watch' },
  weak: { label: 'Weak interview', tone: 'concern' },
};

/** Topic scores are out of 10. */
function topicTone(score: number): MetricTone {
  if (!score) return 'none';
  return score >= 8 ? 'good' : score >= 5 ? 'watch' : 'concern';
}

/**
 * The finished AI interview, read only: badges, summary, flags, the score per
 * topic with the candidate's own words as evidence, and the transcript on request.
 * The questions to ask next are listed with the report's other questions.
 */
export default function AiInterviewReportView({ interview, candidateName, showFollowups = false }: { interview: AiInterview; candidateName: string; showFollowups?: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const r = interview.report;
  if (!r) return null;
  const rec = INTERVIEW_REC[r.recommendation];
  const first = candidateName.split(' ')[0] || 'Candidate';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        {interview.mode === 'sample' && <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white">Sample: a made-up conversation, not this candidate</span>}
        {interview.by_staff && interview.mode !== 'sample' && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Demo run by your team</span>}
        {rec && r.scored && <span className={`px-2.5 py-1 rounded-full border ${TONE[rec.tone].chip}`}>{rec.label} · {r.overall}/100</span>}
        {r.depth && (
          <span className={`px-2.5 py-1 rounded-full border ${TONE[r.depth === 'deep' ? 'good' : r.depth === 'adequate' ? 'none' : 'watch'].chip}`}>
            {r.depth === 'deep' ? 'Went deep' : r.depth === 'adequate' ? 'Some depth' : 'Stayed shallow'}
          </span>
        )}
        {interview.duration_sec ? <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{Math.max(1, Math.round(interview.duration_sec / 60))} min</span> : null}
        {interview.transcript_source === 'browser' && <span className={`px-2.5 py-1 rounded-full border ${TONE.watch.chip}`}>Transcript from the candidate&apos;s browser, not checked</span>}
      </div>

      {r.summary && <p className="text-sm text-slate-800 leading-relaxed">{r.summary}</p>}

      {r.flags.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-900">
          <p className="font-semibold flex items-center gap-1.5 mb-1.5"><AlertTriangle className="w-4 h-4" /> Needs your attention</p>
          <PointList items={r.flags} tone="concern" empty="" />
        </div>
      )}

      {r.scored && r.topics.length > 0 && (
        <div>
          <SubHead>Score per topic</SubHead>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {r.topics.map((t) => {
              const tone = topicTone(t.score);
              return (
                <li key={t.key} className="report-card p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <span className={`text-sm font-bold tabular-nums ${TONE[tone].number}`}>{t.score ? `${t.score}/10` : 'Not covered'}</span>
                  </div>
                  {t.score > 0 && (
                    <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                      <div className={`h-full rounded-full ${TONE[tone].dot}`} style={{ width: `${t.score * 10}%` }} />
                    </div>
                  )}
                  {t.note && <p className="text-xs text-slate-600 leading-relaxed">{t.note}</p>}
                  {t.evidence.map((q) => <blockquote key={q} className="text-xs text-slate-700 border-l-2 border-indigo-300 pl-3 italic">&ldquo;{q}&rdquo;</blockquote>)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(r.strengths.length > 0 || r.concerns.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100"><SubHead>Strengths</SubHead><PointList items={r.strengths} tone="good" empty="None noted." /></div>
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100"><SubHead>Concerns</SubHead><PointList items={r.concerns} tone="watch" empty="None noted." /></div>
        </div>
      )}

      {r.cv_checks && r.cv_checks.length > 0 && (
        <div><SubHead>What the interview showed about the CV</SubHead><PointList items={r.cv_checks} tone="none" empty="" /></div>
      )}

      {showFollowups && r.followups.length > 0 && (
        <div><SubHead>Ask these in your own interview</SubHead><ol className="list-decimal pl-5 space-y-1 text-sm text-slate-800">{r.followups.map((s) => <li key={s}>{s}</li>)}</ol></div>
      )}

      {interview.transcript.length > 0 && (
        <div className="print:hidden">
          <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-sm font-semibold text-indigo-700 hover:underline cursor-pointer">
            {showTranscript ? 'Hide' : 'Read'} the full transcript ({interview.transcript.length} turns)
          </button>
          {showTranscript && (
            <div className="mt-3 max-h-96 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              {interview.transcript.map((t, i) => (
                <p key={i} className="text-sm leading-relaxed"><strong className={t.role === 'agent' ? 'text-slate-900' : 'text-indigo-800'}>{t.role === 'agent' ? 'Interviewer' : first}:</strong> {t.text}</p>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">The AI reads only the transcript. It is a second opinion to help you decide, never the decision itself.</p>
    </div>
  );
}
