'use client';

import React, { useEffect, useState } from 'react';
import { PhoneCall, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardHeader, buttonClass, inputClass } from './ui';
import { useAdmin } from './adminContext';
import { MAX_SCREENING_QUESTIONS, STARTER_SCREENING_QUESTIONS } from '@/lib/screeningCall';
import { DEFAULT_RULES, MAX_RETRIES } from '@/lib/screeningFlow';
import type { ScreeningAction, ScreeningRules } from '@/lib/types';

type Loaded = {
  settings: { questions: string[]; requirements: string[]; auto_call_on_apply: boolean; rules: ScreeningRules };
  price_per_min_inr: number;
  mode: 'live' | 'demo';
  usage: { calls: number; minutes: number; amount_inr: number; cost_inr?: number };
};

/** The school's AI screening call: its questions, automatic calls for new applicants, price and this month's usage. */
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
        description="Before any interview, an AI voice agent phones the candidate, asks these questions in a natural conversation, and writes up the answers, a short summary and a recommendation on their page."
        action={
          <button type="button" onClick={save} disabled={saving || !dirty} className={buttonClass('primary', 'sm')}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />
      {!data ? (
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="space-y-4">
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

          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={auto} onChange={(e) => change(() => setAuto(e.target.checked))} className="mt-1 w-4 h-4 accent-indigo-600" />
            <span className="text-sm">
              <strong className="text-slate-900 block">Call every new applicant automatically</strong>
              <span className="text-slate-500">Each new candidate is called within a minute of applying or being added. Each answered call is charged.</span>
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5"><PhoneCall className="w-4 h-4 text-indigo-600" /> Questions the AI asks ({questions.length})</p>
              <button type="button" onClick={() => change(() => { setQuestions(STARTER_SCREENING_QUESTIONS); setRequirements(STARTER_SCREENING_QUESTIONS.map(() => '')); })} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Starter set
              </button>
            </div>
            <p className="text-xs text-slate-500">Keep it short: calls are charged by the minute, and five or six questions take about three minutes.</p>
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
                      onClick={() => change(() => { setQuestions((qs) => qs.filter((_, j) => j !== i)); setRequirements((rs) => questions.map((_, j) => rs[j] ?? '').filter((_, j) => j !== i)); })}
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
                      placeholder="e.g. Notice period of 60 days or less"
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
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer">
              <input type="checkbox" checked={rules.enabled} onChange={(e) => change(() => setRules((r) => ({ ...r, enabled: e.target.checked })))} className="mt-1 w-4 h-4 accent-indigo-600" />
              <span className="text-sm">
                <strong className="text-slate-900 block">Act on the result automatically</strong>
                <span className="text-slate-500">After each call, the AI reads how it went, checks your must-haves, and does what you choose below, such as sending the test link by email and WhatsApp. Off means results are only shown.</span>
              </span>
            </label>

            <fieldset disabled={!rules.enabled} className={`space-y-2 ${rules.enabled ? '' : 'opacity-50'}`}>
              <p className="text-sm font-semibold text-slate-900">When the call is answered</p>
              {([
                ['on_proceed', 'Good fit', 'Interested, and every must-have is met'],
                ['on_maybe', 'Needs a look', 'Unsure, or a must-have could not be confirmed'],
                ['on_not_suitable', 'Not suitable', 'Not interested, or a must-have is not met'],
              ] as const).map(([key, label, help]) => (
                <div key={key} className="grid grid-cols-1 sm:grid-cols-[1fr_16rem] gap-2 items-center">
                  <span className="text-sm"><strong className="text-slate-900">{label}</strong> <span className="text-slate-500 text-xs">{help}</span></span>
                  <select
                    value={rules[key]}
                    onChange={(e) => change(() => setRules((r) => ({ ...r, [key]: e.target.value as ScreeningAction })))}
                    aria-label={`What to do when the result is: ${label}`}
                    className={`${inputClass} text-sm`}
                  >
                    <option value="send_link">Send the test link now</option>
                    <option value="hold">Wait for HR to approve</option>
                    <option value="flag">Do nothing, flag for HR</option>
                  </select>
                </div>
              ))}

              <p className="text-sm font-semibold text-slate-900 pt-2">When they do not pick up (or the line is busy)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-600">
                <label className="flex flex-col gap-1">Try again
                  <select value={rules.retries} onChange={(e) => change(() => setRules((r) => ({ ...r, retries: Number(e.target.value) })))} className={`${inputClass} text-sm`}>
                    {Array.from({ length: MAX_RETRIES + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Never' : `${n} ${n === 1 ? 'time' : 'times'}`}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">Wait between tries
                  <select value={rules.retry_gap_hours} onChange={(e) => change(() => setRules((r) => ({ ...r, retry_gap_hours: Number(e.target.value) })))} className={`${inputClass} text-sm`}>
                    {[1, 2, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">Call from
                  <select value={rules.window_start_hour} onChange={(e) => change(() => setRules((r) => ({ ...r, window_start_hour: Number(e.target.value) })))} className={`${inputClass} text-sm`}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h % 12 === 0 ? 12 : h % 12} {h < 12 ? 'am' : 'pm'}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">Until
                  <select value={rules.window_end_hour} onChange={(e) => change(() => setRules((r) => ({ ...r, window_end_hour: Number(e.target.value) })))} className={`${inputClass} text-sm`}>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{h % 12 === 0 ? 12 : h % 12} {h < 12 || h === 24 ? 'am' : 'pm'}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_16rem] gap-2 items-center">
                <span className="text-sm"><strong className="text-slate-900">After the last try</strong> <span className="text-slate-500 text-xs">Retries only ring between these hours, India time</span></span>
                <select
                  value={rules.after_no_answer}
                  onChange={(e) => change(() => setRules((r) => ({ ...r, after_no_answer: e.target.value as 'send_link' | 'flag' })))}
                  aria-label="What to do after the last try"
                  className={`${inputClass} text-sm`}
                >
                  <option value="flag">Do nothing, flag for HR</option>
                  <option value="send_link">Send the test link anyway</option>
                </select>
              </div>
            </fieldset>
          </div>
        </div>
      )}
    </Card>
  );
}
