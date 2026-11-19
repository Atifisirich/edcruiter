'use client';

import React, { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { buttonClass, inputClass } from './ui';
import { blanksOf, fromDisplay, toDisplay } from '@/lib/callScript';
import type { CallScript, QuestionImportance, ScreeningQuestionSet } from '@/lib/types';

const IMPORTANCE: { value: QuestionImportance; label: string; help: string; cls: string }[] = [
  { value: 'must', label: 'Must have', help: 'Not met: the result is Not suitable', cls: 'border-rose-300 bg-rose-50 text-rose-800' },
  { value: 'prefer', label: 'Preferred', help: 'Not met: HR takes a look', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'ask', label: 'Just ask', help: 'Any answer is fine', cls: 'border-slate-300 bg-white text-slate-700' },
];

/** One list of call questions: the wording, how much each matters, and what answer the school wants to hear. */
export default function ScreeningQuestionsEditor({
  value, onChange, max, script,
}: { value: ScreeningQuestionSet; onChange: (v: ScreeningQuestionSet) => void; max: number; script?: CallScript }) {
  const { questions, requirements, importance } = value;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // With the school's script known, its blanks read as [Salary range] here, never as braces.
  const shown = (t: string) => (script ? toDisplay(t, script) : t);
  const stored = (t: string) => (script ? fromDisplay(t, script) : t);
  const blanks = script ? blanksOf(script) : [];
  const insertBlank = (i: number, label: string) => {
    const el = inputs.current[i];
    const text = shown(questions[i] ?? '');
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const token = `[${label}]`;
    update(i, { q: stored(text.slice(0, start) + token + text.slice(end)) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };
  const update = (i: number, patch: Partial<{ q: string; r: string; imp: QuestionImportance }>) =>
    onChange({
      questions: questions.map((x, j) => (j === i && patch.q !== undefined ? patch.q : x)),
      requirements: questions.map((_, j) => (j === i && patch.r !== undefined ? patch.r : requirements[j] ?? '')),
      importance: questions.map((_, j) => (j === i && patch.imp ? patch.imp : importance[j] ?? 'ask')),
    });
  const remove = (i: number) =>
    onChange({
      questions: questions.filter((_, j) => j !== i),
      requirements: questions.map((_, j) => requirements[j] ?? '').filter((_, j) => j !== i),
      importance: questions.map((_, j) => importance[j] ?? 'ask').filter((_, j) => j !== i),
    });
  const add = () =>
    onChange({
      questions: [...questions, ''],
      requirements: [...questions.map((_, j) => requirements[j] ?? ''), ''],
      importance: [...questions.map((_, j) => importance[j] ?? 'ask'), 'ask'],
    });

  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {questions.map((q, i) => {
          const imp = importance[i] ?? 'ask';
          const meta = IMPORTANCE.find((x) => x.value === imp)!;
          return (
            <li key={i} className="space-y-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-5 text-right shrink-0">{i + 1}.</span>
                <input
                  ref={(el) => { inputs.current[i] = el; }}
                  value={shown(q)}
                  onChange={(e) => update(i, { q: stored(e.target.value) })}
                  maxLength={200}
                  placeholder="Type the question the AI asks"
                  aria-label={`Question ${i + 1}`}
                  className={inputClass}
                />
                {script && (
                  <select
                    value=""
                    aria-label={`Add a blank to question ${i + 1}`}
                    onChange={(e) => { if (e.target.value) insertBlank(i, e.target.value); }}
                    className="w-28 shrink-0 px-2 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-semibold cursor-pointer"
                  >
                    <option value="">＋ Blank</option>
                    {blanks.map((b) => <option key={b.key} value={b.label}>{b.label}</option>)}
                  </select>
                )}
                <button type="button" onClick={() => remove(i)} aria-label={`Remove question ${i + 1}`} className={buttonClass('ghost', 'sm')}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="pl-7 grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-2 items-start">
                <label className="text-[11px] font-semibold text-slate-500">
                  How much it matters
                  <select
                    value={imp}
                    onChange={(e) => update(i, { imp: e.target.value as QuestionImportance })}
                    aria-label={`How much question ${i + 1} matters`}
                    className={`mt-1 w-full px-2.5 py-2 rounded-xl border text-sm font-semibold ${meta.cls}`}
                  >
                    {IMPORTANCE.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                  <span className="block font-normal mt-0.5">{meta.help}</span>
                </label>
                {imp !== 'ask' ? (
                  <label className="text-[11px] font-semibold text-slate-500">
                    The answer you want to hear
                    <input
                      value={shown(requirements[i] ?? '')}
                      onChange={(e) => update(i, { r: stored(e.target.value) })}
                      maxLength={200}
                      placeholder="e.g. 60 days or less"
                      aria-label={`Answer wanted for question ${i + 1}`}
                      className={`${inputClass} mt-1 ${!(requirements[i] ?? '').trim() ? 'border-amber-400' : ''}`}
                    />
                    {!(requirements[i] ?? '').trim() && <span className="block font-normal text-amber-700 mt-0.5">Write what answer you want, or set it to Just ask.</span>}
                  </label>
                ) : (
                  <p className="text-xs text-slate-500 sm:pt-5">The AI asks and writes down the answer. It does not change the result.</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={add} disabled={questions.length >= max} className={buttonClass('secondary', 'sm')}>
          <Plus className="w-4 h-4" /> Add a question
        </button>
        <span className="text-xs text-slate-500">{questions.length} of {max} · about {Math.max(1, Math.round(questions.length * 0.5))} min a call</span>
      </div>
    </div>
  );
}
