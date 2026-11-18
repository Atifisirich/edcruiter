'use client';

import React, { useEffect, useState } from 'react';
import { PhoneCall, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Card, CardHeader, buttonClass, inputClass } from './ui';
import { useAdmin } from './adminContext';
import { MAX_SCREENING_QUESTIONS, STARTER_SCREENING_QUESTIONS } from '@/lib/screeningCall';

type Loaded = {
  settings: { questions: string[]; auto_call_on_apply: boolean };
  price_inr: number;
  mode: 'live' | 'demo';
  usage: { calls: number; amount_inr: number; cost_inr?: number };
};

/** The school's AI screening call: its questions, automatic calls for new applicants, price and this month's usage. */
export default function ScreeningCallSettingsCard() {
  const { schoolId, toast } = useAdmin();
  const [data, setData] = useState<Loaded | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
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
        body: JSON.stringify({ questions, auto_call_on_apply: auto }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Could not save.', 'error'); return; }
      setQuestions(d.settings.questions);
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
              <p className="text-xs text-slate-500">Price per answered call</p>
              <p className="font-bold text-slate-900">₹{data.price_inr}</p>
              <p className="text-[11px] text-slate-500">Unanswered or busy calls are free.</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">This month</p>
              <p className="font-bold text-slate-900">{data.usage.calls} {data.usage.calls === 1 ? 'call' : 'calls'} · ₹{data.usage.amount_inr}</p>
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
              <button type="button" onClick={() => change(() => setQuestions(STARTER_SCREENING_QUESTIONS))} className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> Starter set
              </button>
            </div>
            <p className="text-xs text-slate-500">Keep it short: five or six questions make a call of about three minutes.</p>
            <ol className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}.</span>
                  <input
                    value={q}
                    onChange={(e) => change(() => setQuestions((qs) => qs.map((x, j) => (j === i ? e.target.value : x))))}
                    maxLength={200}
                    aria-label={`Question ${i + 1}`}
                    className={inputClass}
                  />
                  <button type="button" onClick={() => change(() => setQuestions((qs) => qs.filter((_, j) => j !== i)))} aria-label={`Remove question ${i + 1}`} className={buttonClass('ghost', 'sm')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => change(() => setQuestions((qs) => [...qs, '']))}
              disabled={questions.length >= MAX_SCREENING_QUESTIONS}
              className={buttonClass('secondary', 'sm')}
            >
              <Plus className="w-4 h-4" /> Add a question
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
