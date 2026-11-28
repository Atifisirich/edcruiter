'use client';

import React, { useState } from 'react';
import { NO_SUBJECT, type SubjectCount } from '@/lib/subjectGroups';

const SHOWN = 8;

/**
 * "How many have applied for each subject?" One tile per subject with the number
 * large, so a thin subject (advertise more) and a full one (start interviews)
 * stand out. Pressing a tile shows those people.
 */
export default function SubjectCounts({ counts, selected, onPick }: { counts: SubjectCount[]; selected?: string; onPick: (key: string) => void }) {
  const [all, setAll] = useState(false);
  if (counts.length === 0) return null;
  const total = counts.reduce((n, c) => n + c.total, 0);
  // "Subject not stated" always shows: those people are waiting for someone to set their subject.
  const named = counts.filter((c) => c.key !== NO_SUBJECT);
  const unstated = counts.filter((c) => c.key === NO_SUBJECT);
  const shown = all ? counts : [...named.slice(0, SHOWN - unstated.length), ...unstated];

  return (
    <section aria-label="Applicants by subject" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Applicants by subject</h2>
        <p className="text-xs text-slate-500">{total} {total === 1 ? 'candidate' : 'candidates'} · {named.length} {named.length === 1 ? 'subject' : 'subjects'} · press one to see them</p>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {shown.map((c) => {
          const active = selected === c.key;
          return (
            <li key={c.key}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onPick(active ? '' : c.key)}
                className={`w-full h-full text-left rounded-xl border p-3 cursor-pointer transition hover:border-indigo-400 ${active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50/60'}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 leading-snug">{c.label}</span>
                  <span className="text-2xl font-bold leading-none tabular-nums text-slate-900">{c.total}</span>
                </span>
                <span className="mt-1.5 block text-[11px] text-slate-500">
                  {c.ready} to review · {c.shortlisted} shortlisted{c.selected ? ` · ${c.selected} selected` : ''}
                </span>
                {c.total <= 2 && c.key !== NO_SUBJECT && <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[11px] font-semibold">Few applicants</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {counts.length > SHOWN && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-xs font-semibold text-indigo-700 hover:underline cursor-pointer">
          {all ? 'Show fewer' : `Show all ${named.length} subjects`}
        </button>
      )}
    </section>
  );
}
