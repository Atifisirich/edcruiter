'use client';

import React from 'react';
import { CheckCircle2, Film, XCircle } from 'lucide-react';
import type { PolicyAnswer } from '@/lib/types';

/** Stage 5 on the report: each policy question with the candidate's answer, disagreements first and highlighted. */
export default function PolicyAnswersPanel({
  answers,
  video,
}: {
  answers: PolicyAnswer[];
  video?: { title: string; watched_to_end: boolean };
}) {
  const disagreed = answers.filter((a) => !a.agreed);
  const ordered = [...disagreed, ...answers.filter((a) => a.agreed)];

  return (
    <div className="space-y-2.5">
      <div className={`p-3 rounded-2xl border text-xs flex flex-wrap items-center gap-x-4 gap-y-1 ${disagreed.length ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
        <strong className="text-sm">
          {disagreed.length
            ? `Did not agree with ${disagreed.length} of ${answers.length} ${answers.length === 1 ? 'policy' : 'policies'}`
            : `Agreed with all ${answers.length} ${answers.length === 1 ? 'policy' : 'policies'}`}
        </strong>
        {video && (
          <span className="inline-flex items-center gap-1">
            <Film className="w-3.5 h-3.5" /> {video.watched_to_end ? 'Watched' : 'Did not finish'} &ldquo;{video.title}&rdquo;
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {ordered.map((a) => (
          <li
            key={a.question_id}
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${a.agreed ? 'bg-white border-slate-200 text-slate-700' : 'bg-rose-50 border-rose-200 text-rose-900'}`}
          >
            {a.agreed
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span className="min-w-0">
              <span className="block font-medium">{a.question}</span>
              <span className={`block font-bold mt-0.5 ${a.agreed ? 'text-emerald-700' : 'text-rose-700'}`}>
                {a.agreed ? 'Agrees' : 'Does not agree'}
              </span>
              {!a.agreed && a.reason && <span className="block mt-1 italic">&ldquo;{a.reason}&rdquo;</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
