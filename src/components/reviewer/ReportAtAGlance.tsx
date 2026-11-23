'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { recommendationFor, scoreLabel, scoreTone, type ScoreTone, type TeachingProfile } from '@/lib/teachingProfile';
import { bandBadgeClass, type ShortlistBand } from '@/lib/shortlistBands';
import type { ResumeAnalysisReport } from '@/lib/types';

const BAR: Record<ScoreTone, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-rose-500' };
const TEXT: Record<ScoreTone, string> = { green: 'text-emerald-700', yellow: 'text-amber-700', red: 'text-rose-700' };
const BOX: Record<ScoreTone, string> = {
  green: 'bg-emerald-50 border-emerald-200',
  yellow: 'bg-amber-50 border-amber-200',
  red: 'bg-rose-50 border-rose-200',
};

/** The few lines a busy reader needs first: one number, what went well, what to look at. */
export default function ReportAtAGlance({
  profile,
  bands,
  resume,
  integrityFlags,
}: {
  profile: TeachingProfile;
  bands: ShortlistBand[] | null | undefined;
  resume?: ResumeAnalysisReport;
  integrityFlags?: number;
}) {
  const overall = profile.overall.score;
  const tone = overall === null ? null : scoreTone(overall);
  const rec = recommendationFor(overall, bands);
  const areas = profile.factors.filter((f) => f.group === 'area' && f.score !== null && f.confidence !== 'none');

  // What to look at: the profile's own improvements, then anything the CV or the test raised.
  const concerns = [...profile.improvements];
  if (resume?.eligibility_verdict === 'not_eligible') concerns.unshift(resume.eligibility_summary || 'The CV does not meet the requirements set for this vacancy.');
  for (const f of resume?.form_vs_cv_discrepancies ?? []) concerns.push(f);
  if ((integrityFlags ?? 0) > 0) concerns.push(`${integrityFlags} test-integrity ${integrityFlags === 1 ? 'flag was' : 'flags were'} raised. Read them under the stages below.`);
  if (profile.overall.capped_reason) concerns.unshift(profile.overall.capped_reason);
  const goodThings = [...profile.strengths];

  return (
    <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden" aria-label="Summary of this report">
      <div className="p-5 sm:p-6 grid gap-5 sm:grid-cols-[auto,1fr] items-center">
        <div className={`rounded-2xl border px-6 py-4 text-center min-w-[11rem] ${tone ? BOX[tone] : 'bg-slate-50 border-slate-200'}`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Overall suitability</p>
          {overall === null ? (
            <p className="mt-1 text-base font-bold text-slate-600">Not enough evidence yet</p>
          ) : (
            <>
              <p className={`mt-1 text-5xl font-black font-mono leading-none ${TEXT[tone!]}`}>{overall}</p>
              <p className="text-xs text-slate-500 mt-1">out of 100 · {scoreLabel(overall)}</p>
            </>
          )}
          {rec && <span className={`inline-block mt-3 px-3 py-1 rounded-full border text-xs font-bold ${bandBadgeClass(rec.tone)}`}>{rec.label}</span>}
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-bold text-slate-900">In short</p>
          <p className="text-sm text-slate-700 leading-relaxed">{profile.summary || 'The written summary is not ready yet.'}</p>
          <p className="text-xs text-slate-500">This is the same number shown in the candidates list. It is built from the areas below, and every area has its reason.</p>
        </div>
      </div>

      {areas.length > 0 && (
        <div className="px-5 sm:px-6 pb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">By teaching area</p>
          <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {areas.map((f) => {
              const t = scoreTone(f.score as number);
              return (
                <li key={f.key} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-slate-700" title={f.label}>{f.label}</span>
                  <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                    <span className={`block h-full rounded-full ${BAR[t]}`} style={{ width: `${f.score}%` }} />
                  </span>
                  <span className={`w-9 text-right text-sm font-bold tabular-nums ${TEXT[t]}`}>{f.score}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-slate-400 mt-2">Green 80 and above · Amber 41 to 79 · Red 40 and below</p>
        </div>
      )}

      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 border-t border-slate-200">
        <div className="bg-white p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><CheckCircle2 className="w-4 h-4" /> What went well</p>
          {goodThings.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">Nothing stood out yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {goodThings.slice(0, 5).map((s) => (
                <li key={s} className="flex gap-2 text-sm text-slate-700"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-800"><AlertTriangle className="w-4 h-4" /> What to look at</p>
          {concerns.length === 0 ? (
            <p className="text-sm text-slate-500 mt-2">No concerns were raised.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {concerns.slice(0, 6).map((s) => (
                <li key={s} className="flex gap-2 text-sm text-slate-700"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />{s}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="px-5 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600">
        {resume && (
          <span className="inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" /> CV review {resume.overall_fitment_score}/10
            {resume.eligibility_verdict === 'not_eligible' ? ' · does not meet requirements' : resume.eligibility_verdict === 'needs_review' ? ' · needs a look' : resume.eligibility_verdict === 'eligible' ? ' · meets requirements' : ''}</span>
        )}
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Test integrity {profile.measured.integrity_score !== null ? `${profile.measured.integrity_score}/100` : 'not measured'}</span>
      </div>
    </section>
  );
}
