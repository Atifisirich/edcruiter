'use client';

import React, { useRef, useState } from 'react';
import { Languages, MessageSquareQuote, Play, Plus, Square, Trash2, Undo2 } from 'lucide-react';
import { buttonClass, inputClass } from './ui';
import {
  blanksOf, CALL_MINUTE_CHOICES, DEFAULT_SCRIPT, FACT_SUGGESTIONS, fillTemplate, fromDisplay, labelOf, LANGUAGE_CHOICES,
  MAX_CUSTOM_VARIABLES, RULE_PRESETS, sampleValues, SCRIPT_LIMITS, schoolFactsText, speakSeconds, strayBlanks, STYLE_PRESETS,
  toDisplay, toVariableKey, TONES,
} from '@/lib/callScript';
import type { CallScript, CallTone, ScreeningLanguage } from '@/lib/types';


const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const field = 'flex flex-col gap-1 text-xs font-semibold text-slate-700';

function Step({ n, title, help, children }: { n: number; title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {help && <p className="text-sm text-slate-500">{help}</p>}
        </div>
      </div>
      <div className="@lg:pl-10 space-y-4">{children}</div>
    </section>
  );
}

/** Says a text aloud with the browser's own voice: a rough idea of the pace, not the real caller's voice. */
function say(textToSay: string, onEnd: () => void): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(textToSay);
  u.lang = 'en-IN';
  u.rate = 0.95;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
  return true;
}

/**
 * A text box where the school types normally and picks blanks from a list. The
 * blanks read as [Candidate's first name] here; the stored text keeps the plain
 * form the server fills in.
 */
function ScriptField({
  title, help, rows, placeholder, value, script, limit, onChange, spoken,
}: {
  title: string; help?: string; rows: number; placeholder: string; value: string; script: CallScript; limit: number;
  onChange: (stored: string) => void;
  /** The text as a candidate would hear it, so its length can be shown. */
  spoken?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const shown = toDisplay(value, script);
  const stray = strayBlanks(value);
  const blanks = blanksOf(script);

  const insert = (label: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? shown.length;
    const end = el?.selectionEnd ?? shown.length;
    const token = `[${label}]`;
    onChange(fromDisplay(shown.slice(0, start) + token + shown.slice(end), script));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };

  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-sm font-bold text-slate-900">{title}</label>
        {help && <p className="text-sm text-slate-500">{help}</p>}
      </div>
      <textarea
        ref={ref}
        value={shown}
        rows={rows}
        maxLength={limit}
        placeholder={placeholder}
        aria-label={title}
        onChange={(e) => onChange(fromDisplay(e.target.value, script))}
        className={`${inputClass} resize-y`}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          value=""
          aria-label={`Add a blank to: ${title}`}
          onChange={(e) => { if (e.target.value) insert(e.target.value); }}
          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-xs font-semibold cursor-pointer"
        >
          <option value="">＋ Add a blank (filled in for each candidate)</option>
          <optgroup label="Filled in automatically">
            {blanks.filter((b) => !b.custom).map((b) => <option key={b.key} value={b.label}>{b.label}</option>)}
          </optgroup>
          {blanks.some((b) => b.custom) && (
            <optgroup label="Your school’s details">
              {blanks.filter((b) => b.custom).map((b) => <option key={b.key} value={b.label}>{b.label}</option>)}
            </optgroup>
          )}
        </select>
        <span className="text-[11px] text-slate-500">
          {spoken ? `About ${speakSeconds(spoken)} seconds to say · ` : ''}{shown.length}/{limit}
        </span>
      </div>
      {stray.length > 0 && (
        <p className="text-xs text-amber-700 font-semibold">
          {stray[0]} is not one of your blanks. Pick one from the list above, or take the brackets out.
        </p>
      )}
    </div>
  );
}

/** The school's own call script, as a guided setup in plain language, with a live preview. */
export default function ScreeningScriptEditor({
  value, onChange, language, onLanguage, schoolName, firstQuestion,
}: {
  value: CallScript; onChange: (v: CallScript) => void;
  language: ScreeningLanguage; onLanguage: (l: ScreeningLanguage) => void;
  schoolName: string; firstQuestion?: string;
}) {
  const set = <K extends keyof CallScript>(key: K, v: CallScript[K]) => onChange({ ...value, [key]: v });
  const [undo, setUndo] = useState<Pick<CallScript, 'tone' | 'greeting' | 'closing'> | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [sampleName, setSampleName] = useState('Mansi Bhosle');
  const [samplePost, setSamplePost] = useState('English teacher, Primary');
  const [playing, setPlaying] = useState<'greeting' | 'closing' | null>(null);

  const blanks = blanksOf(value);
  const taken = new Set(blanks.map((b) => norm(b.label)));
  const builtInNames = new Set(blanks.filter((b) => !b.custom).map((b) => norm(b.label)));
  const newKey = toVariableKey(newLabel);
  const nameTaken = !!newLabel.trim() && taken.has(norm(newLabel));
  const uniqueKey = (base: string) => {
    let key = base || 'detail';
    for (let i = 2; value.variables.some((v) => v.key === key); i += 1) key = `${base}_${i}`.slice(0, 30);
    return key;
  };

  const applyStyle = (key: string) => {
    const p = STYLE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setUndo({ tone: value.tone, greeting: value.greeting, closing: value.closing });
    onChange({ ...value, tone: p.tone, greeting: p.greeting, closing: p.closing });
  };

  const addFact = (label: string, factValue = '') => {
    const name = label.trim();
    if (!name || taken.has(norm(name)) || value.variables.length >= MAX_CUSTOM_VARIABLES) return;
    onChange({ ...value, variables: [...value.variables, { key: uniqueKey(toVariableKey(name)), label: name, value: factValue }] });
  };
  const addOwn = () => {
    if (!newKey || nameTaken || !newValue.trim()) return;
    addFact(newLabel, newValue.trim());
    setNewLabel('');
    setNewValue('');
  };
  const editFact = (i: number, patch: Partial<CallScript['variables'][number]>) =>
    set('variables', value.variables.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const samples = sampleValues(value, schoolName, { name: sampleName, post: samplePost });
  const opening = fillTemplate(value.greeting || DEFAULT_SCRIPT.greeting, samples);
  const closing = fillTemplate(value.closing || DEFAULT_SCRIPT.closing, samples);
  const told = schoolFactsText(value, samples).split('\n').filter(Boolean);
  const callerName = value.agent_name || 'AI';
  const firstName = samples.candidate_name;

  const play = (which: 'greeting' | 'closing') => {
    if (playing === which) { window.speechSynthesis?.cancel(); setPlaying(null); return; }
    const ok = say(which === 'greeting' ? opening : closing, () => setPlaying(null));
    if (ok) setPlaying(which);
  };
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  return (
    <div className="@container">
    <div className="grid grid-cols-1 @3xl:grid-cols-[minmax(0,1fr)_19rem] gap-8 items-start">
      <div className="space-y-9">
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-indigo-950">Set up your AI caller once.</p>
            <p className="text-sm text-indigo-900/80">For every call we fill in the candidate’s name and post, and your school’s details. Start with a style, then change anything you like. The preview shows how it will sound.{' '}<a href="#script-preview" className="@3xl:hidden font-semibold underline">Jump to the preview</a></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STYLE_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => applyStyle(p.key)} className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-white text-left cursor-pointer hover:border-indigo-400">
                <span className="block text-sm font-bold text-slate-900">{p.label}</span>
                <span className="block text-[11px] text-slate-500">{p.help}</span>
              </button>
            ))}
            {undo && (
              <button type="button" onClick={() => { onChange({ ...value, ...undo }); setUndo(null); }} className={buttonClass('ghost', 'sm')}>
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
            )}
          </div>
        </div>

        <Step n={1} title="Who is calling" help="How the AI introduces itself and how it speaks.">
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
            <label className={field}>The AI’s name
              <input value={value.agent_name} maxLength={SCRIPT_LIMITS.agent_name} onChange={(e) => set('agent_name', e.target.value)} placeholder="Priya" className={inputClass} />
              <span className="font-normal text-slate-500">Candidates hear: “This is {callerName || 'Priya'}…”</span>
            </label>
            <label className={field}><span className="inline-flex items-center gap-1"><Languages className="w-3.5 h-3.5" /> Language it speaks</span>
              <select value={language} onChange={(e) => onLanguage(e.target.value as ScreeningLanguage)} className={inputClass}>
                {LANGUAGE_CHOICES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </label>
          </div>
          <fieldset className="space-y-1.5">
            <legend className={field}>How it sounds</legend>
            <div className="grid grid-cols-1 gap-2">
              {TONES.map((t) => (
                <label key={t.value} className={`p-3 rounded-xl border cursor-pointer text-sm ${value.tone === t.value ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input type="radio" name="tone" className="sr-only" checked={value.tone === t.value} onChange={() => set('tone', t.value as CallTone)} />
                  <span className="block font-bold text-slate-900">{t.label}</span>
                  <span className="block text-xs text-slate-500 italic mt-0.5">“{t.example}”</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className={`${field} @md:max-w-xs`}>Aim to finish the call within
            <select value={value.max_minutes} onChange={(e) => set('max_minutes', Number(e.target.value))} className={inputClass}>
              {CALL_MINUTE_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
            <span className="font-normal text-slate-500">Shorter calls cost less.</span>
          </label>
        </Step>

        <Step n={2} title="What it says" help="The first and last thing the candidate hears. Add blanks so each call sounds personal.">
          <ScriptField
            title="How the call opens"
            help="Say who is calling and why, then ask if it is a good time."
            rows={3} limit={SCRIPT_LIMITS.greeting} placeholder={toDisplay(DEFAULT_SCRIPT.greeting, value)}
            value={value.greeting} script={value} onChange={(v) => set('greeting', v)} spoken={opening}
          />
          <ScriptField
            title="How the call ends"
            help="Said after the last question, before hanging up."
            rows={2} limit={SCRIPT_LIMITS.closing} placeholder={toDisplay(DEFAULT_SCRIPT.closing, value)}
            value={value.closing} script={value} onChange={(v) => set('closing', v)} spoken={closing}
          />
        </Step>

        <Step n={3} title="Your school’s details" help="Fill these in once. Use them as blanks in your texts and questions, and the AI can tell candidates if they ask.">
          {value.variables.length > 0 && (
            <ul className="space-y-2">
              {value.variables.map((v, i) => {
                const dup = value.variables.some((o, j) => j !== i && norm(labelOf(o)) === norm(labelOf(v))) || builtInNames.has(norm(labelOf(v)));
                return (
                  <li key={v.key} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="grid grid-cols-1 @lg:grid-cols-[11rem_1fr_auto] gap-2 items-start">
                      <input value={labelOf(v)} maxLength={SCRIPT_LIMITS.var_label} aria-label="Detail name" onChange={(e) => editFact(i, { label: e.target.value })} className={`${inputClass} font-semibold`} />
                      <input
                        value={v.value} maxLength={SCRIPT_LIMITS.var_value} aria-label={`${labelOf(v)}: value`} placeholder="Type it here"
                        onChange={(e) => editFact(i, { value: e.target.value })}
                        className={`${inputClass} ${!v.value.trim() ? 'border-amber-400' : ''}`}
                      />
                      <button type="button" aria-label={`Remove ${labelOf(v)}`} onClick={() => set('variables', value.variables.filter((_, j) => j !== i))} className={buttonClass('ghost', 'sm')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={v.share !== false} onChange={(e) => editFact(i, { share: e.target.checked ? undefined : false })} className="accent-indigo-600" />
                      Candidates can be told this if they ask
                    </label>
                    {dup && <p className="text-xs text-rose-600 font-semibold">Another detail already has this name.</p>}
                    {!v.value.trim() && <p className="text-xs text-amber-700">Type a value, or remove this row. A detail with no value is not saved.</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {value.variables.length < MAX_CUSTOM_VARIABLES && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {FACT_SUGGESTIONS.filter((f) => !taken.has(norm(f))).map((f) => (
                  <button key={f} type="button" onClick={() => addFact(f)} className="px-2.5 py-1 rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50">
                    <Plus className="inline w-3 h-3 -mt-0.5" /> {f}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 @lg:grid-cols-[11rem_1fr_auto] gap-2 items-start">
                <div>
                  <input value={newLabel} maxLength={SCRIPT_LIMITS.var_label} onChange={(e) => setNewLabel(e.target.value)} placeholder="Your own, e.g. Notice" aria-label="New detail name" className={inputClass} />
                  {nameTaken && <p className="mt-1 text-[11px] text-rose-600">You already have “{newLabel.trim()}”.</p>}
                </div>
                <input value={newValue} maxLength={SCRIPT_LIMITS.var_value} onChange={(e) => setNewValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOwn(); } }}
                  placeholder="What it is, e.g. 30 days" aria-label="New detail value" className={inputClass} />
                <button type="button" onClick={addOwn} disabled={!newKey || nameTaken || !newValue.trim()} className={buttonClass('secondary', 'sm')}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          )}
          <ScriptField
            title="Anything else candidates may ask about (optional)"
            help="Write it in your own words. The AI answers only from your details and this; for anything else it says the school team will tell them."
            rows={3} limit={SCRIPT_LIMITS.school_info} placeholder="e.g. Staff get a free lunch. The school is closed on the second Saturday."
            value={value.school_info} script={value} onChange={(v) => set('school_info', v)}
          />
        </Step>

        <Step n={4} title="Rules for the AI" help="The AI never promises a job or salary and never asks for bank or Aadhaar details. Add your own on top.">
          <div className="space-y-1.5">
            {RULE_PRESETS.map((r) => {
              const on = value.rule_flags?.includes(r.key) ?? false;
              return (
                <label key={r.key} className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 text-sm cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={on} onChange={(e) => set('rule_flags', e.target.checked ? [...(value.rule_flags ?? []), r.key] : (value.rule_flags ?? []).filter((k) => k !== r.key))} className="accent-indigo-600 w-4 h-4" />
                  <span className="font-semibold text-slate-800">{r.label}</span>
                </label>
              );
            })}
          </div>
          <ScriptField
            title="Anything else it must or must not do (optional)"
            rows={3} limit={SCRIPT_LIMITS.instructions} placeholder="e.g. If the candidate asks to speak to a person, say HR will call back."
            value={value.instructions} script={value} onChange={(v) => set('instructions', v)}
          />
        </Step>
      </div>

      <aside id="script-preview" className="scroll-mt-4 @3xl:sticky @3xl:top-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><MessageSquareQuote className="w-4 h-4 text-indigo-600" /> How it will sound</h3>
        <div className="grid grid-cols-1 gap-2">
          <label className="text-[11px] font-semibold text-slate-500">Pretend the candidate is
            <input value={sampleName} onChange={(e) => setSampleName(e.target.value)} maxLength={60} className={`${inputClass} mt-1 bg-white`} />
          </label>
          <label className="text-[11px] font-semibold text-slate-500">Applying for
            <input value={samplePost} onChange={(e) => setSamplePost(e.target.value)} maxLength={60} className={`${inputClass} mt-1 bg-white`} />
          </label>
        </div>

        <div className="space-y-2 text-sm">
          <div className="rounded-2xl rounded-bl-md bg-white border border-indigo-100 p-3">
            <p className="text-[11px] font-bold text-indigo-700">{callerName}</p>
            <p className="text-slate-800">{opening}</p>
            {canSpeak && (
              <button type="button" onClick={() => play('greeting')} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 cursor-pointer">
                {playing === 'greeting' ? <><Square className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Hear it</>}
              </button>
            )}
          </div>
          <div className="rounded-2xl rounded-br-md bg-slate-200 p-3 ml-6">
            <p className="text-[11px] font-bold text-slate-500">{firstName}</p>
            <p className="text-slate-700">Yes, go ahead.</p>
          </div>
          {firstQuestion && (
            <div className="rounded-2xl rounded-bl-md bg-white border border-indigo-100 p-3">
              <p className="text-[11px] font-bold text-indigo-700">{callerName}</p>
              <p className="text-slate-800">{fillTemplate(firstQuestion, samples)}</p>
            </div>
          )}
          <p className="text-center text-xs text-slate-400">… your other questions …</p>
          <div className="rounded-2xl rounded-bl-md bg-white border border-indigo-100 p-3">
            <p className="text-[11px] font-bold text-indigo-700">{callerName}</p>
            <p className="text-slate-800">{closing}</p>
            {canSpeak && (
              <button type="button" onClick={() => play('closing')} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 cursor-pointer">
                {playing === 'closing' ? <><Square className="w-3 h-3" /> Stop</> : <><Play className="w-3 h-3" /> Hear it</>}
              </button>
            )}
          </div>
        </div>

        {told.length > 0 && (
          <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">If a candidate asks, the AI can say:</p>
            <ul className="list-disc pl-4 space-y-0.5">{told.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
        <p className="text-[11px] text-slate-500">The voice here is your browser’s, only to show the pace. The real call uses a natural voice.</p>
      </aside>
    </div>
    </div>
  );
}
