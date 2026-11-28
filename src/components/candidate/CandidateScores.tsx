'use client';

import React, { useEffect, useState } from 'react';
import type { CandidateScore } from '@/lib/candidateResults';

/** The candidate's own marks, on the page they see after finishing every stage. */
export default function CandidateScores({ candidateId }: { candidateId: string }) {
  const [scores, setScores] = useState<CandidateScore[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/candidates/${candidateId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setScores(d?.my_scores ?? null); })
      .catch(() => { /* the thank-you page stands without them */ });
    return () => { cancelled = true; };
  }, [candidateId]);

  if (!scores) return null;
  return (
    <section aria-label="Your scores" className="max-w-md mx-auto text-left">
      <h4 className="text-sm font-bold text-slate-900 mb-2">Your scores</h4>
      <ul className="grid grid-cols-2 gap-2">
        {scores.map((s) => (
          <li key={s.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">{s.label}</p>
            {s.score === null ? (
              <p className="mt-1 text-sm font-semibold text-slate-500">Being reviewed</p>
            ) : (
              <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{s.score}<span className="text-xs font-medium text-slate-400"> /100</span></p>
            )}
            {s.detail && <p className="text-[11px] text-slate-500">{s.detail}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">These are your test marks. The school looks at the whole application before deciding.</p>
    </section>
  );
}
