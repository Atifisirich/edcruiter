import React from 'react';
import { Camera, Clock } from 'lucide-react';
import { STAGE_GUIDE } from '@/lib/candidateStageGuide';

/**
 * The heading of a stage: what it is, how long it takes, and what to do, in
 * order. On a phone the steps fold away so the question itself is on screen.
 */
export default function StageIntro({ stageKey, number }: { stageKey: string; number: number }) {
  const guide = STAGE_GUIDE[stageKey];
  if (!guide) return null;

  const steps = guide.steps.map((step, i) => (
    <li key={step} className="flex items-start gap-3 text-sm text-slate-700">
      <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black flex items-center justify-center mt-px">
        {i + 1}
      </span>
      <span className="leading-relaxed">{step}</span>
    </li>
  ));

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="text-indigo-700 uppercase tracking-wider">Stage {number} of 5</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          <Clock className="w-3 h-3" /> {guide.time}
        </span>
        {guide.camera && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
            <Camera className="w-3 h-3" /> Camera on
          </span>
        )}
      </div>
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">{guide.title}</h2>
        <p className="text-sm text-slate-600 mt-1">{guide.summary}</p>
      </div>

      <ol className="hidden sm:block space-y-2">{steps}</ol>
      <details className="sm:hidden rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
        <summary className="text-sm font-bold text-slate-800 cursor-pointer">What to do ({guide.steps.length} steps)</summary>
        <ol className="mt-3 space-y-2">{steps}</ol>
      </details>
    </section>
  );
}
