'use client';

import React from 'react';
import { Check, Film, MessageSquareQuote, X } from 'lucide-react';
import type { PolicyAnswer } from '@/lib/types';

/**
 * School policies on the report: one clear result (how many the candidate agreed
 * to), then each policy as a row with a green tick or a red cross. Disagreements
 * come first, with the candidate's reason underneath.
 */
export default function PolicyAnswersPanel({
  answers,
  video,
  note,
}: {
  answers: PolicyAnswer[];
  video?: { title: string; watched_to_end: boolean };
  /** Anything extra the candidate wrote. */
  note?: string;
}) {
  const disagreed = answers.filter((a) => !a.agreed);
  const ordered = [...disagreed, ...answers.filter((a) => a.agreed)];
  const agreed = answers.length - disagreed.length;
  const allAgreed = disagreed.length === 0;
  const pct = answers.length ? Math.round((agreed / answers.length) * 100) : 0;

  return (
    <section className="report-card rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`px-4 py-4 flex flex-wrap items-center gap-x-5 gap-y-3 ${allAgreed ? 'bg-emerald-50/70' : 'bg-rose-50/70'}`}>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">School policies</p>
          <p className={`text-base font-bold ${allAgreed ? 'text-emerald-800' : 'text-rose-800'}`}>
            {allAgreed
              ? `Agreed to all ${answers.length} ${answers.length === 1 ? 'policy' : 'policies'}`
              : `Did not agree to ${disagreed.length} of ${answers.length}`}
          </p>
          {video && (
            <p className={`mt-1 inline-flex items-center gap-1.5 text-xs ${video.watched_to_end ? 'text-slate-600' : 'text-amber-800 font-semibold'}`}>
              <Film className="w-3.5 h-3.5" /> {video.watched_to_end ? 'Watched the policy video' : 'Did not finish the policy video'}: &ldquo;{video.title}&rdquo;
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold leading-none tabular-nums ${allAgreed ? 'text-emerald-700' : 'text-rose-700'}`}>
            {agreed}<span className="text-base font-medium text-slate-400">/{answers.length}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">agreed</p>
        </div>
        <div className="basis-full flex h-1.5 rounded-full overflow-hidden bg-rose-200" aria-hidden="true">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {ordered.map((a) => (
          <li key={a.question_id} className={`px-4 py-3 flex items-start gap-3 ${a.agreed ? '' : 'bg-rose-50/40'}`}>
            <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${a.agreed ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true">
              {a.agreed ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <X className="w-3.5 h-3.5" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-900 leading-snug">{a.question}</span>
              {!a.agreed && a.reason && (
                <span className="mt-1.5 flex gap-1.5 text-sm text-rose-900 bg-white border border-rose-200 rounded-lg px-3 py-2">
                  <MessageSquareQuote className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span><span className="font-semibold">Their reason:</span> {a.reason}</span>
                </span>
              )}
            </span>
            <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${a.agreed ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-300'}`}>
              {a.agreed ? 'Agrees' : 'Does not agree'}
            </span>
          </li>
        ))}
      </ul>

      {note && (
        <p className="px-4 py-3 border-t border-slate-100 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Candidate&apos;s note:</span> {note}
        </p>
      )}
    </section>
  );
}
