'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { inputClass, buttonClass } from '@/components/admin/ui';
import type { AssessmentPack } from '@/lib/types';

type Part = 'questions' | 'lesson' | 'demo' | 'scenario';

/** One question while it is being edited. `correct` is the position of the right answer in `options`. */
interface Draft {
  key: string;
  id: string;
  question_text: string;
  options: string[];
  correct: number;
  explanation: string;
  category: 'subject' | 'pedagogy';
}

const MIN_OWN = 5;
let counter = 0;
const newKey = () => `k${Date.now().toString(36)}${counter++}`;

function toDraft(q: AssessmentPack['mcqs'][number], index: number): Draft {
  const at = q.options.findIndex((o) => o === q.correct_option);
  return {
    // Stable from the saved question, so the page renders the same on the server and in the browser.
    key: `saved-${index}-${q.id}`,
    id: q.id,
    question_text: q.question_text,
    options: [...q.options],
    correct: at >= 0 ? at : 0,
    explanation: q.explanation ?? '',
    category: q.category === 'pedagogy' ? 'pedagogy' : 'subject',
  };
}

const blankQuestion = (): Draft => ({
  key: newKey(), id: '', question_text: '', options: ['', '', '', ''], correct: 0, explanation: '', category: 'subject',
});

/** The form of a question that goes to the server, and the one used to tell whether anything changed. */
const toSend = (d: Draft) => ({
  id: d.id,
  question_text: d.question_text,
  options: d.options,
  correct_option: d.options[d.correct] ?? '',
  explanation: d.explanation,
  category: d.category,
});

const PART_LABEL: Record<Part, string> = {
  questions: 'Stage 2 · Questions',
  lesson: 'Lesson plan task',
  demo: 'Teaching demo task',
  scenario: 'Classroom scenario task',
};

/**
 * Edit every part of an AI-written test by hand: each question and its
 * answers, the three tasks candidates are given, and the scoring guides the AI
 * marks them with. Nothing has to be edited; a test that is left alone is used
 * exactly as the AI wrote it.
 */
export default function TestEditor({
  pack,
  canActivate,
  onCancel,
  onSaved,
}: {
  pack: AssessmentPack;
  /** The school admin can put a test in use; HR cannot. */
  canActivate: boolean;
  onCancel: () => void;
  onSaved: (pack: AssessmentPack, opts: { activate: boolean; switchedToOwn: boolean }) => void;
}) {
  const initialQuestions = useMemo(() => (pack.mcqs ?? []).map((q, i) => toDraft(q, i)), [pack]);
  const [part, setPart] = useState<Part>('questions');
  const [title, setTitle] = useState(pack.title);
  const [questions, setQuestions] = useState<Draft[]>(initialQuestions);
  const [lessonPrompt, setLessonPrompt] = useState(pack.lesson_prompt || '');
  const [lessonRubric, setLessonRubric] = useState(pack.lesson_rubric || '');
  const [demoPrompt, setDemoPrompt] = useState(pack.demo_prompt || '');
  const [demoRubric, setDemoRubric] = useState(pack.demo_rubric || '');
  const [scenarioPrompt, setScenarioPrompt] = useState(pack.scenario_prompt || '');
  const [scenarioRubric, setScenarioRubric] = useState(pack.scenario_rubric || '');
  // undefined until the school chooses; then a question edit picks "this test's questions" for them.
  const [chosen, setChosen] = useState<'bank' | 'own' | undefined>(pack.use_own_questions === undefined ? undefined : pack.use_own_questions ? 'own' : 'bank');
  const [saving, setSaving] = useState<'save' | 'activate' | null>(null);
  const [error, setError] = useState('');

  const questionsChanged = useMemo(
    () => JSON.stringify(questions.map(toSend)) !== JSON.stringify(initialQuestions.map(toSend)),
    [questions, initialQuestions]
  );
  const source: 'bank' | 'own' = chosen ?? (questionsChanged && questions.length >= MIN_OWN ? 'own' : 'bank');
  const live = pack.status === 'active';

  const patchQuestion = (key: string, change: Partial<Draft>) =>
    setQuestions((list) => list.map((q) => (q.key === key ? { ...q, ...change } : q)));
  const setOption = (key: string, at: number, value: string) =>
    setQuestions((list) => list.map((q) => (q.key === key ? { ...q, options: q.options.map((o, i) => (i === at ? value : o)) } : q)));
  const addOption = (key: string) =>
    setQuestions((list) => list.map((q) => (q.key === key && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q)));
  const removeOption = (key: string, at: number) =>
    setQuestions((list) => list.map((q) => {
      if (q.key !== key || q.options.length <= 2) return q;
      const options = q.options.filter((_, i) => i !== at);
      const correct = q.correct === at ? 0 : q.correct > at ? q.correct - 1 : q.correct;
      return { ...q, options, correct };
    }));
  const move = (at: number, by: -1 | 1) =>
    setQuestions((list) => {
      const to = at + by;
      if (to < 0 || to >= list.length) return list;
      const next = [...list];
      [next[at], next[to]] = [next[to], next[at]];
      return next;
    });

  const save = async (activate: boolean) => {
    setError('');
    setSaving(activate ? 'activate' : 'save');
    try {
      const res = await fetch(`/api/assessment-packs/${encodeURIComponent(pack.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          mcqs: questions.map(toSend),
          lesson_prompt: lessonPrompt,
          lesson_rubric: lessonRubric,
          demo_prompt: demoPrompt,
          demo_rubric: demoRubric,
          scenario_prompt: scenarioPrompt,
          scenario_rubric: scenarioRubric,
          use_own_questions: source === 'own',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.pack) {
        setError(data.error || 'Could not save the test. Try again.');
        return;
      }
      onSaved(data.pack, { activate, switchedToOwn: !!data.switched_to_own_questions });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  };

  const area = `${inputClass} min-h-[88px] text-xs`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex-1 min-w-[14rem] block text-xs font-bold text-slate-600">Test name
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${inputClass} mt-1`} />
        </label>
        <button type="button" onClick={onCancel} className={buttonClass('ghost', 'sm')}><X className="w-4 h-4" /> Cancel</button>
      </div>

      {live && (
        <p className="flex items-start gap-2 text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
          <span><strong>This test is in use.</strong> Your changes apply to candidates who start a new go from now on. Anyone part way through a go keeps the questions they were given.</span>
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="tablist">
        {(Object.keys(PART_LABEL) as Part[]).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => setPart(p)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${part === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>
            {PART_LABEL[p]}{p === 'questions' ? ` (${questions.length})` : ''}
          </button>
        ))}
      </div>

      {part === 'questions' && (
        <div className="space-y-4">
          <fieldset className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <legend className="px-1 text-xs font-black text-slate-900">Which questions do candidates get?</legend>
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer text-xs ${source === 'bank' ? 'bg-white border-indigo-300' : 'border-transparent'}`}>
              <input type="radio" name="source" checked={source === 'bank'} onChange={() => setChosen('bank')} className="mt-0.5 accent-indigo-600" />
              <span><strong className="text-slate-900">Edcruiter&apos;s question bank (the usual way).</strong> Each candidate gets a different mix of about 30 questions, so answers cannot be shared. Your edits to the questions below are not used for candidates.</span>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer text-xs ${source === 'own' ? 'bg-white border-indigo-300' : 'border-transparent'}`}>
              <input type="radio" name="source" checked={source === 'own'} onChange={() => setChosen('own')} className="mt-0.5 accent-indigo-600" />
              <span><strong className="text-slate-900">The questions on this page, exactly as you wrote them.</strong> Every candidate gets all of them (at least {MIN_OWN}), each in their own order with the answers shuffled.</span>
            </label>
            {chosen === undefined && questionsChanged && questions.length >= MIN_OWN && (
              <p className="text-[11px] text-indigo-900 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">You changed a question, so candidates will get these questions. Choose the first option if you would rather keep the question bank.</p>
            )}
            <p className="text-[11px] text-slate-500">If Edcruiter has no question bank for this subject yet, candidates take this test&apos;s questions either way.</p>
          </fieldset>

          <ol className="space-y-3">
            {questions.map((q, i) => (
              <li key={q.key} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-900">Question {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <select value={q.category} onChange={(e) => patchQuestion(q.key, { category: e.target.value as Draft['category'] })} aria-label={`Kind of question ${i + 1}`}
                      className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700">
                      <option value="subject">Subject knowledge</option>
                      <option value="pedagogy">Teaching practice</option>
                    </select>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label={`Move question ${i + 1} down`} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => setQuestions((l) => l.filter((x) => x.key !== q.key))} aria-label={`Delete question ${i + 1}`} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <textarea value={q.question_text} onChange={(e) => patchQuestion(q.key, { question_text: e.target.value })} placeholder="Write the question" aria-label={`Question ${i + 1} text`} className={area} />
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-600">Answers. Tick the one that is correct.</p>
                  {q.options.map((o, at) => (
                    <div key={at} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${q.key}`} checked={q.correct === at} onChange={() => patchQuestion(q.key, { correct: at })} aria-label={`Answer ${at + 1} is correct`} className="accent-emerald-600 w-4 h-4 shrink-0" />
                      <input value={o} onChange={(e) => setOption(q.key, at, e.target.value)} placeholder={`Answer ${at + 1}`} aria-label={`Question ${i + 1} answer ${at + 1}`}
                        className={`${inputClass} text-xs ${q.correct === at ? 'border-emerald-400 bg-emerald-50/50' : ''}`} />
                      <button type="button" onClick={() => removeOption(q.key, at)} disabled={q.options.length <= 2} aria-label={`Remove answer ${at + 1}`} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"><X className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {q.options.length < 6 && (
                    <button type="button" onClick={() => addOption(q.key)} className="text-[11px] font-bold text-indigo-700 inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add an answer</button>
                  )}
                </div>
                <input value={q.explanation} onChange={(e) => patchQuestion(q.key, { explanation: e.target.value })} placeholder="Why this answer is right (optional; only your team sees it)" aria-label={`Question ${i + 1} explanation`} className={`${inputClass} text-xs`} />
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setQuestions((l) => [...l, blankQuestion()])} className={buttonClass('secondary', 'sm')}><Plus className="w-4 h-4" /> Add a question</button>
          {source === 'own' && questions.length < MIN_OWN && (
            <p className="text-xs text-rose-700">Candidates can only get this test&apos;s own questions once it has at least {MIN_OWN}. It has {questions.length}.</p>
          )}
        </div>
      )}

      {part === 'lesson' && (
        <TaskFields prompt={lessonPrompt} rubric={lessonRubric} onPrompt={setLessonPrompt} onRubric={setLessonRubric} area={area} />
      )}
      {part === 'demo' && (
        <TaskFields prompt={demoPrompt} rubric={demoRubric} onPrompt={setDemoPrompt} onRubric={setDemoRubric} area={area} />
      )}
      {part === 'scenario' && (
        <TaskFields prompt={scenarioPrompt} rubric={scenarioRubric} onPrompt={setScenarioPrompt} onRubric={setScenarioRubric} area={area} />
      )}

      {error && <p role="alert" className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3 shadow-lg">
        <button type="button" onClick={onCancel} disabled={saving !== null} className={buttonClass('secondary')}>Cancel</button>
        <button type="button" onClick={() => save(false)} disabled={saving !== null} className={buttonClass(canActivate && !live ? 'secondary' : 'primary')}>
          {saving === 'save' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save changes</>}
        </button>
        {canActivate && !live && (
          <button type="button" onClick={() => save(true)} disabled={saving !== null} className={buttonClass('primary')}>
            {saving === 'activate' ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save and use for candidates'}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskFields({ prompt, rubric, onPrompt, onRubric, area }: {
  prompt: string; rubric: string; onPrompt: (v: string) => void; onRubric: (v: string) => void; area: string;
}) {
  return (
    <div className="space-y-4">
      <label className="block text-xs font-bold text-slate-600">What the candidate is asked to do
        <textarea value={prompt} onChange={(e) => onPrompt(e.target.value)} className={`${area} mt-1 min-h-[120px]`} />
      </label>
      <label className="block text-xs font-bold text-slate-600">Scoring guide the AI marks the answer against
        <textarea value={rubric} onChange={(e) => onRubric(e.target.value)} className={`${area} mt-1 min-h-[120px]`} />
        <span className="block mt-1 text-[11px] font-normal text-slate-500">Candidates never see this. Change it if you want answers judged on different things.</span>
      </label>
    </div>
  );
}
