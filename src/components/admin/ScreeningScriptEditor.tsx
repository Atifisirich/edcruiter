'use client';

import React, { useRef, useState } from 'react';
import { Braces, MessageSquareQuote, Plus, RotateCcw, Trash2, UserRound } from 'lucide-react';
import { buttonClass, inputClass } from './ui';
import {
  BUILT_IN_VARIABLES, CALL_MINUTE_CHOICES, checkTemplate, DEFAULT_SCRIPT, fillTemplate, knownKeys, MAX_CUSTOM_VARIABLES,
  sampleValues, SCRIPT_LIMITS, toVariableKey, TONES,
} from '@/lib/callScript';
import type { CallScript, CallTone } from '@/lib/types';

type TextKey = 'greeting' | 'closing' | 'school_info' | 'instructions';

const FIELDS: { key: TextKey; title: string; help: string; rows: number; placeholder: string }[] = [
  { key: 'greeting', title: 'How the call opens', help: 'The first thing the AI says. Keep it short and ask if it is a good time.', rows: 3, placeholder: DEFAULT_SCRIPT.greeting },
  { key: 'closing', title: 'How the call ends', help: 'Said after the last question, before hanging up.', rows: 2, placeholder: DEFAULT_SCRIPT.closing },
  { key: 'school_info', title: 'What the AI may tell candidates', help: 'If a candidate asks, the AI answers only from this. Anything else: “the school team will tell you”.', rows: 4, placeholder: 'School timings: 8:30 am to 3:30 pm, Monday to Saturday.\nSchool bus available from {{campus_area}}.\nSalary for this post: {{salary_range}}, depending on experience.' },
  { key: 'instructions', title: 'Extra rules for the AI', help: 'Things it must or must not do on your calls.', rows: 3, placeholder: 'Never promise a salary or a job.\nIf the candidate asks to speak to someone, say HR will call back.' },
];

const field = 'flex flex-col gap-1 text-xs font-semibold text-slate-600';

/** The school's own call script: the caller's name and tone, the opening and closing, facts it may share, extra rules and the school's variables. */
export default function ScreeningScriptEditor({
  value, onChange, schoolName, firstQuestion,
}: { value: CallScript; onChange: (v: CallScript) => void; schoolName: string; firstQuestion?: string }) {
  const refs = useRef<Partial<Record<TextKey, HTMLTextAreaElement | null>>>({});
  const [focus, setFocus] = useState<TextKey>('greeting');
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const set = <K extends keyof CallScript>(key: K, v: CallScript[K]) => onChange({ ...value, [key]: v });
  const known = knownKeys(value);
  const samples = sampleValues(value, schoolName);
  const newKey = toVariableKey(newLabel);
  const keyTaken = !!newKey && known.has(newKey);

  /** Puts {{key}} where the cursor is in the box last used. */
  const insert = (key: string) => {
    const el = refs.current[focus];
    const token = `{{${key}}}`;
    const current = value[focus];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + token + current.slice(end)).slice(0, SCRIPT_LIMITS[focus]);
    set(focus, next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  const addVariable = () => {
    if (!newKey || keyTaken || !newValue.trim() || value.variables.length >= MAX_CUSTOM_VARIABLES) return;
    onChange({ ...value, variables: [...value.variables, { key: newKey, value: newValue.trim().slice(0, SCRIPT_LIMITS.var_value) }] });
    setNewLabel('');
    setNewValue('');
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><UserRound className="w-4 h-4 text-indigo-600" /> The caller</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className={field}>The AI introduces itself as
            <input value={value.agent_name} maxLength={SCRIPT_LIMITS.agent_name} onChange={(e) => set('agent_name', e.target.value)} placeholder="Priya" className={inputClass} />
          </label>
          <label className={field}>How it sounds
            <select value={value.tone} onChange={(e) => set('tone', e.target.value as CallTone)} className={inputClass}>
              {TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <span className="font-normal text-slate-500">{TONES.find((t) => t.value === value.tone)?.help}</span>
          </label>
          <label className={field}>Wrap up the call after about
            <select value={value.max_minutes} onChange={(e) => set('max_minutes', Number(e.target.value))} className={inputClass}>
              {CALL_MINUTE_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
            <span className="font-normal text-slate-500">Shorter calls cost less.</span>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Braces className="w-4 h-4 text-indigo-600" /> Variables</h3>
          <p className="text-sm text-slate-500">
            Click one to put it where your cursor is. It is filled in for each candidate before the call. They work in your questions too.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {BUILT_IN_VARIABLES.map((v) => (
            <button key={v.key} type="button" onClick={() => insert(v.key)} title={`${v.label}, e.g. “${v.key === 'school_name' ? schoolName : v.key === 'agent_name' ? value.agent_name : v.sample}”`}
              className="px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-mono cursor-pointer hover:bg-indigo-100">
              {`{{${v.key}}}`}
            </button>
          ))}
          {value.variables.map((v) => (
            <button key={v.key} type="button" onClick={() => insert(v.key)} title={v.value}
              className="px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-mono cursor-pointer hover:bg-emerald-100">
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-700">Your variables <span className="font-normal text-slate-500">— the same for every call: salary range, campus address, timings, HR’s name…</span></p>
          {value.variables.length > 0 && (
            <ul className="space-y-1.5">
              {value.variables.map((v, i) => (
                <li key={v.key} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr_auto] gap-2 items-center">
                  <code className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-2 truncate">{`{{${v.key}}}`}</code>
                  <input value={v.value} maxLength={SCRIPT_LIMITS.var_value} aria-label={`Value of ${v.key}`}
                    onChange={(e) => set('variables', value.variables.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className={inputClass} />
                  <button type="button" aria-label={`Remove ${v.key}`} onClick={() => set('variables', value.variables.filter((_, j) => j !== i))} className={buttonClass('ghost', 'sm')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {value.variables.length < MAX_CUSTOM_VARIABLES && (
            <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr_auto] gap-2 items-start">
              <div>
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name, e.g. Salary range" aria-label="New variable name" className={inputClass} />
                {newKey && <p className={`mt-1 text-[11px] font-mono ${keyTaken ? 'text-rose-600' : 'text-slate-500'}`}>{keyTaken ? `{{${newKey}}} already exists` : `{{${newKey}}}`}</p>}
              </div>
              <input value={newValue} maxLength={SCRIPT_LIMITS.var_value} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addVariable(); } }}
                placeholder="Value, e.g. ₹25,000 to ₹35,000 a month" aria-label="New variable value" className={inputClass} />
              <button type="button" onClick={addVariable} disabled={!newKey || keyTaken || !newValue.trim()} className={buttonClass('secondary', 'sm')}>
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          )}
        </div>
      </section>

      {FIELDS.map((f) => {
        const err = checkTemplate(value[f.key], known, 'This');
        return (
          <section key={f.key} className="space-y-1.5">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500">{f.help}</p>
              </div>
              {(f.key === 'greeting' || f.key === 'closing') && value[f.key] !== DEFAULT_SCRIPT[f.key] && (
                <button type="button" onClick={() => set(f.key, DEFAULT_SCRIPT[f.key])} className={`${buttonClass('ghost', 'sm')} shrink-0`}>
                  <RotateCcw className="w-3.5 h-3.5" /> Standard
                </button>
              )}
            </div>
            <textarea
              ref={(el) => { refs.current[f.key] = el; }}
              value={value[f.key]}
              rows={f.rows}
              maxLength={SCRIPT_LIMITS[f.key]}
              onFocus={() => setFocus(f.key)}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              aria-label={f.title}
              className={`${inputClass} resize-y ${focus === f.key ? 'ring-2 ring-indigo-100 border-indigo-400' : ''}`}
            />
            <div className="flex justify-between text-[11px]">
              <span className="text-rose-600">{err}</span>
              <span className="text-slate-400">{value[f.key].length}/{SCRIPT_LIMITS[f.key]}</span>
            </div>
          </section>
        );
      })}

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><MessageSquareQuote className="w-4 h-4 text-indigo-600" /> How it will sound</h3>
        <p className="text-sm text-slate-500">With a sample candidate, Mansi Bhosle, who applied for English, Primary.</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
          <p><strong className="text-indigo-700">{value.agent_name || 'AI'}:</strong> {fillTemplate(value.greeting || DEFAULT_SCRIPT.greeting, samples)}</p>
          <p className="text-slate-500"><strong>Mansi:</strong> Yes, go ahead.</p>
          {firstQuestion && <p><strong className="text-indigo-700">{value.agent_name || 'AI'}:</strong> {fillTemplate(firstQuestion, samples)}</p>}
          <p className="text-slate-400 text-xs">… the rest of your questions …</p>
          <p><strong className="text-indigo-700">{value.agent_name || 'AI'}:</strong> {fillTemplate(value.closing || DEFAULT_SCRIPT.closing, samples)}</p>
        </div>
      </section>
    </div>
  );
}
