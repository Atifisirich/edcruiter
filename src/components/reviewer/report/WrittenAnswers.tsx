'use client';

import React, { useState } from 'react';
import { BookOpen, Check, ListChecks, Sparkles, X } from 'lucide-react';
import type { StageResult } from '@/lib/types';
import { isSubjectDimension, type ParsedWritten } from '@/lib/writtenAnswers';
import { MIN_LESSON_WORDS, countWords } from '@/lib/testRules';
import { PointList, Points, SkillBlock, SubHead, TONE } from './ReportUI';
import type { MetricTone } from '@/lib/reportVerdict';

/**
 * The written stage as two cards: the subject test, one line per question with a
 * clear right or wrong, and the lesson plan with the AI's review beside it.
 */
export default function WrittenAnswers({ parsed, result }: { parsed: ParsedWritten; result: StageResult }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const dims = result.ai_scores?.scores ?? [];
  const subjectDims = dims.filter((d) => isSubjectDimension(d.dimension));
  const lessonDims = dims.filter((d) => !isSubjectDimension(d.dimension));
  const provisional = result.ai_scores?.scoring_mode === 'deterministic_fallback';
  const right = parsed.mcqs.filter((m) => m.correct).length;
  const total = parsed.mcqs.length;
  const pct = total ? Math.round((right / total) * 100) : 0;
  const testTone: MetricTone = !total ? 'none' : pct >= 80 ? 'good' : pct >= 50 ? 'watch' : 'concern';
  const shown = onlyWrong ? parsed.mcqs.filter((m) => !m.correct) : parsed.mcqs;
  const words = countWords(parsed.lessonPlan);
  const gaps = result.ai_scores?.identified_gaps ?? [];
  const note = result.ai_scores?.evidence_reference || result.reviewer_notes;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <section className="report-card rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100">
            <span className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 items-center justify-center shrink-0"><ListChecks className="w-4 h-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Subject test</span>
              <span className="hidden sm:block text-xs text-slate-500">{total} multiple-choice {total === 1 ? 'question' : 'questions'}, marked against the answer key</span>
            </span>
            <span className="text-right">
              <span className={`text-2xl font-bold tabular-nums ${TONE[testTone].number}`}>{right}<span className="text-sm font-medium text-slate-400">/{total}</span></span>
              <span className="block text-[11px] text-slate-500">correct · {pct}%</span>
            </span>
          </div>
          <div className="px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex h-2 flex-1 min-w-[8rem] rounded-full overflow-hidden bg-rose-200" aria-hidden="true">
              <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            {right < total && right > 0 && (
              <button type="button" onClick={() => setOnlyWrong((v) => !v)} className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer print:hidden">
                {onlyWrong ? 'Show all questions' : `Show only the ${total - right} wrong`}
              </button>
            )}
          </div>
          <ol className="p-2 sm:p-3 space-y-1.5">
            {shown.map((m) => {
              const n = parsed.mcqs.indexOf(m) + 1;
              return (
                <li key={n} className={`report-card flex gap-3 rounded-lg px-3 py-2.5 ${m.correct ? 'bg-emerald-50/60' : 'bg-rose-50/60'}`}>
                  <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${m.correct ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-label={m.correct ? 'Correct' : 'Wrong'}>
                    {m.correct ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <X className="w-3.5 h-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-slate-900 leading-snug"><span className="text-slate-400 tabular-nums mr-1.5">{n}.</span>{m.question}</span>
                    {m.correct ? (
                      <span className="mt-1 block text-xs text-emerald-800">Answered <span className="font-semibold">{m.key}</span></span>
                    ) : (
                      <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                        <span className="text-rose-800">Their answer: <span className="font-semibold">{m.selected ?? 'No answer'}</span></span>
                        <span className="text-emerald-800">Correct: <span className="font-semibold">{m.key}</span></span>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {subjectDims.length > 0 && (
            <div className="px-4 pb-4 pt-1 space-y-3">
              {subjectDims.map((d) => <SkillBlock key={d.dimension} name={d.dimension.replace(/_/g, ' ')} score={Number(d.score) || 0} measures={d.pedagogical_benchmark} text={d.justification} />)}
            </div>
          )}
        </section>
      )}

      {(parsed.lessonPlan || lessonDims.length > 0) && (
        <section className="report-card rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100">
            <span className="hidden sm:flex w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Lesson plan</span>
              <span className="hidden sm:block text-xs text-slate-500">Written by the candidate, with the AI review beside it</span>
            </span>
            <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold tabular-nums ${TONE[words >= MIN_LESSON_WORDS ? 'none' : 'watch'].chip}`}>
              {words} words{words < MIN_LESSON_WORDS ? ` · under ${MIN_LESSON_WORDS}` : ''}
            </span>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            <div className="p-4">
              {parsed.lessonPlan ? (
                <p className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed max-h-[28rem] overflow-y-auto print:max-h-none">{parsed.lessonPlan}</p>
              ) : (
                <p className="text-sm text-slate-500">No lesson plan was written.</p>
              )}
            </div>
            <aside className="p-4 bg-indigo-50/40 space-y-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                <Sparkles className="w-3.5 h-3.5" /> AI review{provisional ? ' · provisional' : ''}
              </p>
              {lessonDims.length ? lessonDims.map((d) => <SkillBlock key={d.dimension} name={d.dimension.replace(/_/g, ' ')} score={Number(d.score) || 0} measures={d.pedagogical_benchmark} text={d.justification} />) : <p className="text-sm text-slate-500">No AI score was stored for the lesson plan.</p>}
              {gaps.length > 0 && <div><SubHead>What is missing</SubHead><PointList items={gaps} tone="watch" empty="" /></div>}
              {note && <Points text={note} />}
            </aside>
          </div>
        </section>
      )}
    </div>
  );
}
