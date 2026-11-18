'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Flag, Mail, PauseCircle, PhoneCall, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardHeader, SaveBar, buttonClass, inputClass } from './ui';
import { useAdmin } from './adminContext';
import { MAX_SCREENING_QUESTIONS, STARTER_SCREENING_QUESTIONS } from '@/lib/screeningCall';
import { DEFAULT_RULES, describeRules, matchingPreset, MAX_RETRIES, RULE_PRESETS } from '@/lib/screeningFlow';
import type { ScreeningAction, ScreeningRules } from '@/lib/types';

type Loaded = {
  settings: { questions: string[]; requirements: string[]; auto_call_on_apply: boolean; rules: ScreeningRules };
  price_per_min_inr: number;
  mode: 'live' | 'demo';
  usage: { calls: number; minutes: number; amount_inr: number; cost_inr?: number };
};

const hour = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 < 12 ? 'am' : 'pm'}`;

/** A numbered section heading, so the card reads as a short sequence of steps. */
function Step({ n, title, help, children }: { n: number; title: string; help: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-5 border-t border-slate-200 first-of-type:border-0 first-of-type:pt-0">
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{n}</span>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{help}</p>
        </div>
      </div>
      <div className="pl-10 space-y-3">{children}</div>
    </section>
  );
}

const RESULTS = [
  { key: 'on_proceed', name: 'Good fit', tone: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', means: 'They are interested, and (if you set any) every must-have is met.' },
  { key: 'on_maybe', name: 'Needs a look', tone: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', means: 'The AI is unsure, or could not confirm a must-have from what they said.' },
  { key: 'on_not_suitable', name: 'Not suitable', tone: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', means: 'They are not interested, or clearly miss a must-have.' },
] as const;

const CHOICES: { value: ScreeningAction; label: string; Icon: typeof Mail }[] = [
  { value: 'send_link', label: 'Send the test link now', Icon: Mail },
  { value: 'hold', label: 'Wait for HR to approve first', Icon: PauseCircle },
  { value: 'flag', label: 'Send nothing, flag for HR', Icon: Flag },
];

/** The school's AI screening call: when to call, what to ask, and what happens after, written so each part says what it does. */
export default function ScreeningCallSettingsCard() {
  const { schoolId, toast } = useAdmin();
  const [data, setData] = useState<Loaded | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [rules, setRules] = useState<ScreeningRules>(DEFAULT_RULES);
  const [auto, setAuto] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/screening-calls/settings?school_id=${encodeURIComponent(schoolId)}`)
      .then((r) => r.json())
      .then((d: Loaded) => {
        if (!d.settings) return;
        setData(d);
        setQuestions(d.settings.questions);
        setRequirements(d.settings.requirements);
        setRules(d.settings.rules);
        setAuto(d.settings.auto_call_on_apply);
      })
      .catch(() => {});
  }, [schoolId]);

  const change = (fn: () => void) => { fn(); setDirty(true); };
  const setRule = <K extends keyof ScreeningRules>(key: K, value: ScreeningRules[K]) => change(() => setRules((r) => ({ ...r, [key]: value })));

  const musts = requirements.filter((r, i) => r.trim() && questions[i]?.trim()).length;
  const summary = useMemo(() => describeRules(rules, musts), [rules, musts]);
  const preset = matchingPreset(rules);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/screening-calls/settings?school_id=${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, requirements, auto_call_on_apply: auto, rules }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Could not save.', 'error'); return; }
      setQuestions(d.settings.questions);
      setRequirements(d.settings.requirements);
      setRules(d.settings.rules);
      setDirty(false);
      toast('AI call settings saved.', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="AI screening call"
        description="Before any interview, an AI voice agent phones the candidate for a short chat, asks your questions, and writes up the answers. You decide what happens next."
      />
      {!data ? (
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="space-y-5">
          {/* How it works, in three pictures */}
          <ol className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-stretch text-sm" aria-label="How the screening call works">
            {[
              { Icon: PhoneCall, title: 'The AI calls', text: 'It rings the candidate and asks your questions in a friendly chat.' },
              { Icon: CheckCircle2, title: 'It reads the answers', text: 'It writes a summary and checks your must-haves.' },
              { Icon: Mail, title: 'Then your rules apply', text: 'The test link goes out, or HR is told, as you choose below.' },
            ].flatMap((s, i) => [
              <li key={s.title} className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
                <p className="font-bold text-slate-900 flex items-center gap-1.5"><s.Icon className="w-4 h-4 text-indigo-600" /> {i + 1}. {s.title}</p>
                <p className="text-slate-600 mt-0.5">{s.text}</p>
              </li>,
              ...(i < 2 ? [<li key={`a${i}`} aria-hidden className="hidden sm:flex items-center text-indigo-300"><ArrowRight className="w-5 h-5" /></li>] : []),
            ])}
          </ol>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">Price</p>
              <p className="font-bold text-slate-900">₹{data.price_per_min_inr} per minute</p>
              <p className="text-[11px] text-slate-500">Each started minute of an answered call. Unanswered or busy calls are free. A 3-minute call is ₹{data.price_per_min_inr * 3}.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">This month</p>
              <p className="font-bold text-slate-900">{data.usage.calls} {data.usage.calls === 1 ? 'call' : 'calls'} · {data.usage.minutes} min · ₹{data.usage.amount_inr}</p>
              {typeof data.usage.cost_inr === 'number' && <p className="text-[11px] text-slate-500">Platform cost ₹{data.usage.cost_inr} (only you see this)</p>}
            </div>
            <div className={`p-3 rounded-xl border ${data.mode === 'live' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
              <p className="text-xs text-slate-500">Calling</p>
              <p className="font-bold text-slate-900">{data.mode === 'live' ? 'Real phone calls' : 'Demo mode'}</p>
              <p className="text-[11px] text-slate-500">{data.mode === 'live' ? 'Calls ring the candidate’s mobile.' : 'No phone calls yet; a sample conversation is shown.'}</p>
            </div>
          </div>

          <Step n={1} title="When should the AI call?" help="You can always call someone yourself: open a candidate and press “Call now”, or use Select on the candidates list.">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={auto} onChange={(e) => change(() => setAuto(e.target.checked))} className="mt-1 w-4 h-4 accent-indigo-600" />
              <span className="text-sm">
                <strong className="text-slate-900 block">Call every new applicant automatically</strong>
                <span className="text-slate-500">Each new candidate is called within a minute of applying or being added. Each answered call is charged.</span>
              </span>
            </label>
          </Step>

          <Step n={2} title="What should the AI ask?" help={`Keep it short: calls are charged by the minute, and five or six questions take about three minutes. You can add up to ${MAX_SCREENING_QUESTIONS}.`}>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
              <strong className="text-slate-800">What is a must-have?</strong> Something the candidate has to say for you to carry on with them. For example, for the question
              {' '}“What is your notice period?” the must-have could be “60 days or less”. If they say 90 days, the AI marks it <em>not met</em> and the result becomes “Not suitable”.
              Leave it empty if any answer is fine.
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-indigo-600" /> {questions.length} {questions.length === 1 ? 'question' : 'questions'}</p>
              <button type="button" onClick={() => change(() => { setQuestions(STARTER_SCREENING_QUESTIONS); setRequirements(STARTER_SCREENING_QUESTIONS.map(() => '')); })} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Go back to the starter questions
              </button>
            </div>
            <ol className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="space-y-1.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}.</span>
                    <input
                      value={q}
                      onChange={(e) => change(() => setQuestions((qs) => qs.map((x, j) => (j === i ? e.target.value : x))))}
                      maxLength={200}
                      aria-label={`Question ${i + 1}`}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => change(() => { setQuestions((qs) => qs.filter((_, j) => j !== i)); setRequirements(questions.map((_, j) => requirements[j] ?? '').filter((_, j) => j !== i)); })}
                      aria-label={`Remove question ${i + 1}`}
                      className={buttonClass('ghost', 'sm')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">Must-have (optional)</span>
                    <input
                      value={requirements[i] ?? ''}
                      onChange={(e) => change(() => setRequirements(questions.map((_, j) => (j === i ? e.target.value : requirements[j] ?? ''))))}
                      maxLength={200}
                      placeholder="e.g. 60 days or less"
                      aria-label={`Must-have for question ${i + 1}`}
                      className={`${inputClass} text-xs`}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => change(() => { setQuestions((qs) => [...qs, '']); setRequirements([...questions.map((_, j) => requirements[j] ?? ''), '']); })}
              disabled={questions.length >= MAX_SCREENING_QUESTIONS}
              className={buttonClass('secondary', 'sm')}
            >
              <Plus className="w-4 h-4" /> Add a question
            </button>
          </Step>

          <Step n={3} title="After the call, what should happen?" help="Choose whether the test link goes out by itself. Until you switch this on, the AI only writes up the call and HR does everything by hand.">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={rules.enabled} onChange={(e) => setRule('enabled', e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
              <span className="text-sm">
                <strong className="text-slate-900 block">Act on the result automatically</strong>
                <span className="text-slate-500">The test link is sent by email, and by WhatsApp if the candidate agreed to WhatsApp messages.</span>
              </span>
            </label>

            <fieldset disabled={!rules.enabled} className={`space-y-4 ${rules.enabled ? '' : 'opacity-50'}`}>
              <div>
                <p className="text-sm font-semibold text-slate-900 mb-1.5">Start from a ready-made choice <span className="font-normal text-slate-500">(you can still change anything below)</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {RULE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => change(() => setRules((r) => ({ ...r, ...p.rules })))}
                      aria-pressed={preset === p.key}
                      className={`text-left p-3 rounded-xl border text-sm cursor-pointer ${preset === p.key ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    >
                      <span className="font-bold text-slate-900 block">{p.name}{preset === p.key && <span className="ml-1.5 text-[10px] font-bold text-indigo-700 uppercase">chosen</span>}</span>
                      <span className="text-xs text-slate-500">{p.help}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">When the candidate answers the call</p>
                {RESULTS.map((res) => (
                  <div key={res.key} className={`grid grid-cols-1 sm:grid-cols-[1fr_15rem] gap-2 items-center p-3 rounded-xl border ${res.tone}`}>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${res.dot}`} /> {res.name}</p>
                      <p className="text-xs text-slate-600">{res.means}</p>
                    </div>
                    <label className="text-xs font-semibold text-slate-600">
                      Then:
                      <select
                        value={rules[res.key]}
                        onChange={(e) => setRule(res.key, e.target.value as ScreeningAction)}
                        aria-label={`What happens for a ${res.name} result`}
                        className={`${inputClass} text-sm mt-1`}
                      >
                        {CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  “Wait for HR to approve” puts a <strong>Send the test link</strong> button on the candidate’s page. “Flag for HR” marks the candidate on their page; nothing is sent, and HR can still send the link from the same button.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><Clock className="w-4 h-4 text-indigo-600" /> If the candidate does not pick up, or the line is busy</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-600">
                  <label className="flex flex-col gap-1">Try again
                    <select value={rules.retries} onChange={(e) => setRule('retries', Number(e.target.value))} className={`${inputClass} text-sm`}>
                      {Array.from({ length: MAX_RETRIES + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Never' : `${n} ${n === 1 ? 'time' : 'times'}`}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">Wait between tries
                    <select value={rules.retry_gap_hours} onChange={(e) => setRule('retry_gap_hours', Number(e.target.value))} className={`${inputClass} text-sm`}>
                      {[1, 2, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">Only call from
                    <select value={rules.window_start_hour} onChange={(e) => setRule('window_start_hour', Number(e.target.value))} className={`${inputClass} text-sm`}>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hour(h)}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">Until
                    <select value={rules.window_end_hour} onChange={(e) => setRule('window_end_hour', Number(e.target.value))} className={`${inputClass} text-sm`}>
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{hour(h)}</option>)}
                    </select>
                  </label>
                </div>
                <label className="text-xs font-semibold text-slate-600 block sm:max-w-sm">
                  If they still do not answer after the last try:
                  <select value={rules.after_no_answer} onChange={(e) => setRule('after_no_answer', e.target.value as 'send_link' | 'flag')} className={`${inputClass} text-sm mt-1`}>
                    <option value="flag">Send nothing, flag for HR</option>
                    <option value="send_link">Send the test link anyway</option>
                  </select>
                </label>
                <p className="text-xs text-slate-500">Retries only ring inside these hours, India time, so nobody is called at night. A failed call (for example a number on the Do Not Disturb list) is flagged and not retried.</p>
              </div>
            </fieldset>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
              <p className="text-sm font-bold text-indigo-900 mb-2">In plain words, this is what will happen</p>
              <ul className="space-y-1.5 text-sm text-slate-800 list-disc pl-5">
                {summary.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </div>
          </Step>

          <SaveBar onSave={save} saving={saving} dirty={dirty} />
        </div>
      )}
    </Card>
  );
}
