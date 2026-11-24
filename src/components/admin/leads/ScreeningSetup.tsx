'use client';

import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { buttonClass, inputClass } from '../ui';
import { MODE_LABEL } from '@/lib/interviewMode';
import type { InterviewMode, LeadList, LeadScreeningSetup, QuestionImportance, ScreeningLanguage } from '@/lib/types';

const EXAMPLES = [
  'Maths teacher for class 9 and 10. B.Ed is a must. At least 3 years CBSE. Can join within a month. Salary up to 40k. Should be able to come to Manneguda daily.',
  'Primary English teacher, classes 1 to 5. B.Ed or D.El.Ed must. Good spoken English. Fresher is fine. Salary up to 25k.',
  'PGT Physics for class 11 and 12. M.Sc Physics and B.Ed must. Has taught board classes. Notice period 30 days or less.',
  'Pre-primary teacher. NTT or Montessori training must. Patient with small children. Should speak Telugu.',
  'Front office executive. Good communication in English and Telugu. Knows MS Office. Six days a week is fine.',
];

const IMPORTANCE: { value: QuestionImportance; label: string; on: string }[] = [
  { value: 'must', label: 'Must have', on: 'bg-rose-600 text-white border-rose-600' },
  { value: 'prefer', label: 'Preferred', on: 'bg-amber-500 text-white border-amber-500' },
  { value: 'ask', label: 'Just ask', on: 'bg-slate-700 text-white border-slate-700' },
];

type Item = { question: string; importance: QuestionImportance; wanted: string };
const toItems = (s: LeadScreeningSetup): Item[] => s.questions.map((q, i) => ({ question: q, importance: s.importance[i] ?? 'ask', wanted: s.requirements[i] ?? '' }));

export interface SetupSaved { list: LeadList }

/**
 * Set up a lead list's screening in three plain steps: say who you are looking
 * for, check what the AI will ask, choose what happens to good fits. Then start.
 */
export default function ScreeningSetup({
  schoolId, list, waiting, estimate, templates, mode, onSaved, onCancel,
}: {
  schoolId: string;
  list: LeadList;
  waiting: number;
  estimate: { cost_inr: number; hours: number; days: number };
  templates: { id: string; name: string }[];
  mode: 'live' | 'demo';
  onSaved: (view: unknown, started: boolean) => void;
  onCancel?: () => void;
}) {
  const [brief, setBrief] = useState(list.brief ?? '');
  const [items, setItems] = useState<Item[]>(list.setup ? toItems(list.setup) : []);
  const [goodFit, setGoodFit] = useState(list.setup?.good_fit ?? '');
  const [language, setLanguage] = useState<ScreeningLanguage>(list.setup?.language ?? 'English');
  const [leftOut, setLeftOut] = useState<string[]>(list.setup?.left_out ?? []);
  const [onGood, setOnGood] = useState<LeadList['on_good_fit']>(list.on_good_fit);
  const [testMode, setTestMode] = useState<InterviewMode>(list.interview_mode ?? 'five_stage');
  const [change, setChange] = useState('');
  const [busy, setBusy] = useState<'' | 'make' | 'change' | 'save' | 'start'>('');
  const [error, setError] = useState('');

  const hasDraft = items.length > 0;
  const current = (): LeadScreeningSetup => ({
    questions: items.map((i) => i.question), requirements: items.map((i) => (i.importance === 'ask' ? '' : i.wanted)),
    importance: items.map((i) => i.importance), language, good_fit: goodFit, left_out: leftOut,
  });

  const make = async (withChange: boolean) => {
    setBusy(withChange ? 'change' : 'make');
    setError('');
    try {
      const r = await fetch(`/api/lead-lists/${list.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, brief, ...(withChange ? { current: current(), change } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not make the questions.');
      const s = d.setup as LeadScreeningSetup;
      setItems(toItems(s));
      setGoodFit(s.good_fit);
      setLanguage(s.language);
      setLeftOut(s.left_out ?? []);
      if (withChange) setChange('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the questions.');
    } finally {
      setBusy('');
    }
  };

  const applyTemplate = async (id: string) => {
    setBusy('make');
    setError('');
    const r = await fetch(`/api/lead-lists/${list.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, action: 'use_template', template_id: id }) });
    const d = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) { setError(d.error || 'Could not use it.'); return; }
    const l = d.list as LeadList;
    setBrief(l.brief ?? '');
    if (l.setup) { setItems(toItems(l.setup)); setGoodFit(l.setup.good_fit); setLanguage(l.setup.language); setLeftOut(l.setup.left_out ?? []); }
  };

  const save = async (start: boolean) => {
    setBusy(start ? 'start' : 'save');
    setError('');
    try {
      const body = {
        school_id: schoolId, action: 'save_setup', brief, on_good_fit: onGood, interview_mode: testMode,
        setup: { good_fit: goodFit, language, left_out: leftOut, questions: items.filter((i) => i.question.trim()) },
      };
      let r = await fetch(`/api/lead-lists/${list.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      let d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save.');
      if (start) {
        r = await fetch(`/api/lead-lists/${list.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, action: list.started_at ? 'resume' : 'start' }) });
        d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Could not start.');
      }
      onSaved(d, start);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy('');
    }
  };

  const set = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const missingWanted = items.findIndex((i) => i.importance !== 'ask' && !i.wanted.trim());

  return (
    <div className="space-y-5">
      {/* 1. Who */}
      <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">1</span>
          <div>
            <h2 className="text-lg font-black text-slate-900">Who are you looking for?</h2>
            <p className="text-sm text-slate-500">Write it the way you would tell a colleague. Say what is a must.</p>
          </div>
        </div>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={4}
          maxLength={1500}
          placeholder="e.g. Maths teacher for class 9 and 10. B.Ed is a must. At least 3 years CBSE. Can join within a month. Salary up to 40k. Near Manneguda."
          className={`${inputClass} text-base leading-relaxed`}
          aria-label="Who are you looking for"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setBrief(e)} className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 text-xs text-slate-700 cursor-pointer max-w-full truncate">
              {e.split('.')[0]}
            </button>
          ))}
          {templates.map((t) => (
            <button key={t.id} type="button" onClick={() => void applyTemplate(t.id)} className="px-3 py-1.5 rounded-full border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-800 cursor-pointer">
              <Save className="w-3 h-3 inline mr-1" />{t.name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void make(false)} disabled={brief.trim().length < 5 || !!busy} className={buttonClass('primary')}>
          {busy === 'make' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {hasDraft ? 'Make the questions again' : 'Create my screening'}
        </button>
      </section>

      {hasDraft && (
        <>
          {/* 2. What the AI asks */}
          <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">2</span>
              <div>
                <h2 className="text-lg font-black text-slate-900">Check what the AI will ask</h2>
                <p className="text-sm text-slate-500">Change anything. A must-have not met sets the person aside; a preference not met sends them to you for a look.</p>
              </div>
            </div>

            <label className="block rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">A good fit is</span>
              <input value={goodFit} onChange={(e) => setGoodFit(e.target.value)} maxLength={300} className="mt-1 w-full bg-transparent text-base font-semibold text-emerald-950 outline-none" />
            </label>

            {leftOut.length > 0 && (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950 space-y-1">
                {leftOut.map((l) => <p key={l} className="flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {l}</p>)}
              </div>
            )}

            <ol className="space-y-2.5">
              {items.map((it, i) => (
                <li key={i} className="rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <span className="text-sm font-black text-slate-400 w-5 pt-2">{i + 1}</span>
                    <input value={it.question} onChange={(e) => set(i, { question: e.target.value })} maxLength={200} className={`${inputClass} font-medium`} aria-label={`Question ${i + 1}`} />
                    <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`} className={buttonClass('ghost', 'sm')}><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="pl-7 flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50" role="radiogroup" aria-label={`How much question ${i + 1} matters`}>
                      {IMPORTANCE.map((o) => (
                        <button key={o.value} type="button" role="radio" aria-checked={it.importance === o.value} onClick={() => set(i, { importance: o.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${it.importance === o.value ? o.on : 'border-transparent text-slate-600'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {it.importance !== 'ask' && (
                      <input value={it.wanted} onChange={(e) => set(i, { wanted: e.target.value })} maxLength={200} placeholder="The answer that passes, e.g. Has a B.Ed"
                        className={`${inputClass} flex-1 min-w-[12rem] text-sm ${!it.wanted.trim() ? 'border-amber-400' : ''}`} aria-label={`Answer that passes for question ${i + 1}`} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setItems((xs) => [...xs, { question: '', importance: 'ask', wanted: '' }])} disabled={items.length >= 8} className={buttonClass('secondary', 'sm')}>
                <Plus className="w-4 h-4" /> Add a question
              </button>
              <span className="text-xs text-slate-500">{items.length} questions · about {Math.max(2, Math.round(items.length * 0.5))} minutes a call</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input value={change} onChange={(e) => setChange(e.target.value)} maxLength={600} placeholder="Or say what to change: “also ask if they can take Saturday classes”"
                className={`${inputClass} flex-1`} aria-label="Change the questions in words" onKeyDown={(e) => { if (e.key === 'Enter' && change.trim()) void make(true); }} />
              <button type="button" onClick={() => void make(true)} disabled={!change.trim() || !!busy} className={buttonClass('secondary')}>
                {busy === 'change' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Change it
              </button>
            </div>
          </section>

          {/* 3. What happens */}
          <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">3</span>
              <h2 className="text-lg font-black text-slate-900">After each call</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                <p className="font-black text-emerald-900">Good fit</p>
                <select value={onGood} onChange={(e) => setOnGood(e.target.value as LeadList['on_good_fit'])} className={`${inputClass} text-sm`} aria-label="What happens to a good fit">
                  <option value="move_and_invite">Move to Candidates and send the test link</option>
                  <option value="move">Move to Candidates only</option>
                </select>
                {onGood === 'move_and_invite' && (
                  <select value={testMode} onChange={(e) => setTestMode(e.target.value as InterviewMode)} className={`${inputClass} text-sm`} aria-label="Which test">
                    {(Object.keys(MODE_LABEL) as InterviewMode[]).map((m) => <option key={m} value={m}>Test: {MODE_LABEL[m]}</option>)}
                  </select>
                )}
              </div>
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <p className="font-black text-amber-900">Not sure</p>
                <p className="text-amber-950/80 mt-1">Waits for you in “Need a look”. One click moves them in or sets them aside.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <p className="font-black text-slate-800">Filtered out</p>
                <p className="text-slate-600 mt-1">A must-have not met, not interested, or no answer: set aside with the reason. Nothing is sent, and nobody is deleted.</p>
              </div>
            </div>
            <label className="text-xs font-semibold text-slate-600 block sm:max-w-xs">
              Call language
              <select value={language} onChange={(e) => setLanguage(e.target.value as ScreeningLanguage)} className={`${inputClass} text-sm mt-1`}>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Telugu">Telugu</option>
                <option value="auto">The person’s own language</option>
              </select>
            </label>
          </section>

          {/* Start */}
          <section className="rounded-3xl bg-indigo-600 text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-2xl font-black">{waiting} {waiting === 1 ? 'lead' : 'leads'} to call</p>
              <p className="text-sm text-indigo-100">
                {mode === 'demo' ? 'Demo mode: no real calls and no charge.' : <>About ₹{estimate.cost_inr.toLocaleString('en-IN')} · about {estimate.hours < 1 ? 'an hour' : `${estimate.hours} hours`} of calling{estimate.days > 1 ? ` over ${estimate.days} days` : ''}, inside your calling hours</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {onCancel && <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold cursor-pointer">Cancel</button>}
              <button type="button" onClick={() => void save(false)} disabled={!!busy || missingWanted >= 0} className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold cursor-pointer disabled:opacity-50">
                {busy === 'save' ? 'Saving…' : 'Save for later'}
              </button>
              <button type="button" onClick={() => void save(true)} disabled={!!busy || missingWanted >= 0 || waiting === 0} className="px-5 py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-black cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
                {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />} Start screening
              </button>
            </div>
            {missingWanted >= 0 && <p className="w-full text-sm text-amber-200">Question {missingWanted + 1}: write the answer that passes, or set it to “Just ask”.</p>}
          </section>
        </>
      )}

      {error && <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
    </div>
  );
}
