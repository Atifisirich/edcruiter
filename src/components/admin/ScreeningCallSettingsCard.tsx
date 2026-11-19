'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Bell, CalendarClock, CheckCircle2, Clock, Copy, FlaskConical, Languages, ListChecks, Mail, PhoneCall,
  MessageSquareText, PhoneMissed, RotateCcw, ShieldCheck, Wallet, X,
} from 'lucide-react';
import { Card, CardHeader, SaveBar, buttonClass, inputClass } from './ui';
import { useAdmin } from './adminContext';
import ScreeningQuestionsEditor from './ScreeningQuestionsEditor';
import ScreeningTrial from './ScreeningTrial';
import ScreeningScriptEditor from './ScreeningScriptEditor';
import { MAX_SCREENING_QUESTIONS } from '@/lib/screeningCall';
import type { FullScreeningSettings } from '@/lib/screeningCall';
import {
  describeRules, GROUPS, HOLD_DAY_CHOICES, hourText, matchingPreset, MAX_CALLBACKS, MAX_RETRIES,
  RULE_PRESETS, STARTER_SETS,
} from '@/lib/screeningFlow';
import type { ScreeningAction, ScreeningGroup, ScreeningLanguage, ScreeningQuestionSet, ScreeningRules } from '@/lib/types';

type Loaded = {
  settings: FullScreeningSettings;
  price_per_min_inr: number;
  owner_cap_inr: number;
  is_owner: boolean;
  subjects: string[];
  mode: 'live' | 'demo';
  usage: { calls: number; minutes: number; amount_inr: number; cost_inr?: number };
};

const TABS = [
  { key: 'when', label: 'When to call', Icon: CalendarClock },
  { key: 'script', label: 'Call script', Icon: MessageSquareText },
  { key: 'questions', label: 'Questions', Icon: ListChecks },
  { key: 'after', label: 'After the call', Icon: CheckCircle2 },
  { key: 'missed', label: 'Missed calls', Icon: PhoneMissed },
  { key: 'limits', label: 'Limits & alerts', Icon: Wallet },
  { key: 'try', label: 'Try it', Icon: FlaskConical },
] as const;
type Tab = (typeof TABS)[number]['key'];

const RESULTS = [
  { key: 'on_proceed', name: 'Good fit', tone: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', means: 'Interested, and every must-have is met.' },
  { key: 'on_maybe', name: 'Needs a look', tone: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', means: 'The AI is unsure, a preference is not met, or a must-have could not be confirmed.' },
  { key: 'on_not_suitable', name: 'Not suitable', tone: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', means: 'A must-have is clearly not met.' },
] as const;

const CHOICES: { value: ScreeningAction; label: string }[] = [
  { value: 'send_link', label: 'Send the test link now' },
  { value: 'hold', label: 'Wait for HR to approve the link' },
  { value: 'suggest_decline', label: 'Suggest a decline (HR approves)' },
  { value: 'flag', label: 'Send nothing, flag for HR' },
];

const LANGUAGES: { value: ScreeningLanguage; label: string }[] = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Telugu', label: 'Telugu' },
  { value: 'auto', label: 'The candidate’s language (English, else Hindi, else Telugu)' },
];

const field = 'flex flex-col gap-1 text-xs font-semibold text-slate-600';
const select = `${inputClass} text-sm`;

function Section({ title, help, Icon, children }: { title: string; help?: string; Icon?: typeof Clock; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">{Icon && <Icon className="w-4 h-4 text-indigo-600" />} {title}</h3>
        {help && <p className="text-sm text-slate-500">{help}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, title, help, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; help: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-3 p-3 rounded-xl border border-slate-200 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
      <span className="text-sm">
        <strong className="text-slate-900 block">{title}</strong>
        <span className="text-slate-500">{help}</span>
      </span>
    </label>
  );
}

const copySet = (s: ScreeningQuestionSet): ScreeningQuestionSet => ({ questions: [...s.questions], requirements: [...s.requirements], importance: [...s.importance] });

/** The school's AI screening call: who is called and when, what is asked for each kind of post, what happens after, and the limits. */
export default function ScreeningCallSettingsCard() {
  const { schoolId, school, toast } = useAdmin();
  const [data, setData] = useState<Loaded | null>(null);
  const [s, setS] = useState<FullScreeningSettings | null>(null);
  const [owner, setOwner] = useState({ price_per_min_inr: 0, owner_cap_inr: 0 });
  const [tab, setTab] = useState<Tab>('when');
  const [qGroup, setQGroup] = useState<ScreeningGroup | 'main'>('main');
  const [newRole, setNewRole] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/screening-calls/settings?school_id=${encodeURIComponent(schoolId)}`)
      .then((r) => r.json())
      .then((d: Loaded) => {
        if (!d.settings) return;
        setData(d);
        setS(d.settings);
        setOwner({ price_per_min_inr: d.price_per_min_inr, owner_cap_inr: d.owner_cap_inr });
      })
      .catch(() => {});
  }, [schoolId]);

  const patch = (fn: (prev: FullScreeningSettings) => FullScreeningSettings) => { setS((prev) => (prev ? fn(prev) : prev)); setDirty(true); };
  const setRule = <K extends keyof ScreeningRules>(key: K, value: ScreeningRules[K]) => patch((p) => ({ ...p, rules: { ...p.rules, [key]: value } }));
  const setAuto = <K extends keyof FullScreeningSettings['auto_call']>(key: K, value: FullScreeningSettings['auto_call'][K]) => patch((p) => ({ ...p, auto_call: { ...p.auto_call, [key]: value } }));
  const setLimit = <K extends keyof FullScreeningSettings['limits']>(key: K, value: number) => patch((p) => ({ ...p, limits: { ...p.limits, [key]: value } }));
  const setNotify = <K extends keyof FullScreeningSettings['notify']>(key: K, value: FullScreeningSettings['notify'][K]) => patch((p) => ({ ...p, notify: { ...p.notify, [key]: value } }));

  const mainSet: ScreeningQuestionSet | null = s ? { questions: s.questions, requirements: s.requirements, importance: s.importance } : null;
  const setFor = (g: ScreeningGroup | 'main'): ScreeningQuestionSet => (g !== 'main' && s?.sets[g]) || mainSet!;
  const musts = mainSet ? mainSet.importance.filter((x) => x !== 'ask').length + Object.values(s!.sets).reduce((n, x) => n + (x?.importance.filter((i) => i !== 'ask').length ?? 0), 0) : 0;
  const summary = useMemo(() => (s ? describeRules(s.rules, musts) : []), [s, musts]);
  const preset = s ? matchingPreset(s.rules) : null;

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/screening-calls/settings?school_id=${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, ...(data?.is_owner ? { owner } : {}) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'Could not save.', 'error'); return; }
      setS(d.settings);
      setData((x) => (x ? { ...x, price_per_min_inr: d.price_per_min_inr, owner_cap_inr: d.owner_cap_inr } : x));
      setDirty(false);
      toast('AI call settings saved.', 'success');
    } finally {
      setSaving(false);
    }
  };

  if (!data || !s || !mainSet) {
    return (
      <Card>
        <CardHeader title="AI screening call" description="Before any interview, an AI voice agent phones the candidate for a short chat, asks your questions, and writes up the answers." />
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      </Card>
    );
  }

  const cap = [s.limits.monthly_cap_inr, data.owner_cap_inr].filter((c) => c > 0);
  const effectiveCap = cap.length ? Math.min(...cap) : 0;
  const usedPct = effectiveCap ? Math.min(100, Math.round((data.usage.amount_inr / effectiveCap) * 100)) : 0;
  const rulesOff = !s.rules.enabled;

  return (
    <Card>
      <CardHeader
        title="AI screening call"
        description="Before any interview, an AI voice agent phones the candidate for a short chat, asks your questions, and writes up the answers. You decide who is called, what is asked, and what happens next."
      />
      <div className="space-y-5">
        <ol className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-2 items-stretch text-sm" aria-label="How the screening call works">
          {[
            { Icon: PhoneCall, title: 'The AI calls', text: 'Inside your calling hours, in English, Hindi or Telugu, with the questions for that post.' },
            { Icon: CheckCircle2, title: 'It reads the answers', text: 'It writes a summary and checks your must-haves and preferences.' },
            { Icon: Mail, title: 'Then your rules apply', text: 'The test link goes out, HR is asked, or a call-back is booked.' },
          ].flatMap((x, i) => [
            <li key={x.title} className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100">
              <p className="font-bold text-slate-900 flex items-center gap-1.5"><x.Icon className="w-4 h-4 text-indigo-600" /> {i + 1}. {x.title}</p>
              <p className="text-slate-600 mt-0.5">{x.text}</p>
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
            <p className="font-bold text-slate-900">{data.usage.calls} {data.usage.calls === 1 ? 'call' : 'calls'} · {data.usage.minutes} min · ₹{data.usage.amount_inr}{effectiveCap ? ` of ₹${effectiveCap}` : ''}</p>
            {effectiveCap > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden" aria-label={`${usedPct}% of the monthly limit used`}>
                <div className={`h-full ${usedPct >= 90 ? 'bg-rose-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
              </div>
            )}
            {typeof data.usage.cost_inr === 'number' && <p className="text-[11px] text-slate-500 mt-1">Platform cost ₹{data.usage.cost_inr} (only you see this)</p>}
          </div>
          <div className={`p-3 rounded-xl border ${data.mode === 'live' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-xs text-slate-500">Calling</p>
            <p className="font-bold text-slate-900">{data.mode === 'live' ? 'Real phone calls' : 'Demo mode'}</p>
            <p className="text-[11px] text-slate-500">{data.mode === 'live' ? 'Calls ring the candidate’s mobile.' : 'No phone calls yet; a sample conversation is shown.'}</p>
          </div>
        </div>

        <div role="tablist" aria-label="AI call settings" className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-semibold border-b-2 -mb-px cursor-pointer ${tab === t.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              <t.Icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="space-y-6">
          {tab === 'when' && (
            <>
              <Section title="Who is called" help="You can always call someone yourself: open a candidate and press “Call now”, or use Select on the candidates list.">
                <Toggle checked={s.auto_call_on_apply} onChange={(v) => patch((p) => ({ ...p, auto_call_on_apply: v }))} title="Call new applicants automatically" help="Each new candidate who fits the choices below is called, inside your calling hours. Each answered call is charged." />
                <fieldset disabled={!s.auto_call_on_apply} className={`space-y-3 ${s.auto_call_on_apply ? '' : 'opacity-50'}`}>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1.5">Only for these posts <span className="font-normal text-slate-500">(none ticked: every post)</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {GROUPS.map((g) => {
                        const on = s.auto_call.groups.includes(g.key);
                        return (
                          <button key={g.key} type="button" aria-pressed={on}
                            onClick={() => setAuto('groups', on ? s.auto_call.groups.filter((x) => x !== g.key) : [...s.auto_call.groups, g.key])}
                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${on ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={field}>Only if the CV fit score is at least
                      <select value={s.auto_call.min_cv_score} onChange={(e) => setAuto('min_cv_score', Number(e.target.value))} className={select}>
                        <option value={0}>Call everyone</option>
                        {[3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} out of 10</option>)}
                      </select>
                      <span className="font-normal text-slate-500">Saves money on weak applications. A CV not read yet does not stop the call.</span>
                    </label>
                    <label className={field}>How soon after they apply
                      <select value={s.auto_call.delay_min} onChange={(e) => setAuto('delay_min', Number(e.target.value))} className={select}>
                        <option value={0}>Straight away</option>
                        {[2, 5, 10, 30, 60].map((n) => <option key={n} value={n}>After {n} minutes</option>)}
                      </select>
                      <span className="font-normal text-slate-500">Outside calling hours, the call waits for the next morning.</span>
                    </label>
                  </div>
                  <Toggle checked={s.auto_call.heads_up} onChange={(v) => setAuto('heads_up', v)} title="Tell them the call is coming" help="An email (and a WhatsApp message if they have chatted with you today) says when the AI will call and from which number, so they pick up. Works best with a delay of a few minutes." />
                </fieldset>
              </Section>

              <Section title="Calling hours" Icon={Clock} help="Every automatic call, retry and call-back happens only inside these hours, India time.">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className={field}>From
                    <select value={s.rules.window_start_hour} onChange={(e) => setRule('window_start_hour', Number(e.target.value))} className={select}>
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourText(h)}</option>)}
                    </select>
                  </label>
                  <label className={field}>Until
                    <select value={s.rules.window_end_hour} onChange={(e) => setRule('window_end_hour', Number(e.target.value))} className={select}>
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => <option key={h} value={h}>{hourText(h)}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:pt-5 cursor-pointer">
                    <input type="checkbox" checked={s.rules.skip_sundays} onChange={(e) => setRule('skip_sundays', e.target.checked)} className="w-4 h-4 accent-indigo-600" /> No calls on Sundays
                  </label>
                </div>
                <p className="text-xs text-slate-500">Teachers are in class during the day. Many schools call from 3 pm to 8 pm; the AI also books a call-back when someone says “call me later”.</p>
              </Section>

              <Section title="Language" Icon={Languages}>
                <label className={`${field} sm:max-w-md`}>The AI speaks
                  <select value={s.language} onChange={(e) => patch((p) => ({ ...p, language: e.target.value as ScreeningLanguage }))} className={select}>
                    {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </label>
              </Section>
            </>
          )}

          {tab === 'questions' && (
            <>
              <Section title="Questions for each post" help="Pre-primary, primary, senior and non-teaching posts need different questions. A post without its own list uses the main questions.">
                <div className="flex flex-wrap gap-1.5">
                  {[{ key: 'main' as const, name: 'Main questions' }, ...GROUPS].map((g) => {
                    const own = g.key !== 'main' && !!s.sets[g.key];
                    return (
                      <button key={g.key} type="button" aria-pressed={qGroup === g.key} onClick={() => setQGroup(g.key)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${qGroup === g.key ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
                        {g.name}{g.key !== 'main' && <span className={`ml-1 ${qGroup === g.key ? 'text-indigo-100' : own ? 'text-emerald-600' : 'text-slate-400'}`}>· {own ? 'own' : 'main'}</span>}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 space-y-1">
                <p><strong className="text-rose-700">Must have</strong>: not met makes the result Not suitable (for example “Has a B.Ed”).</p>
                <p><strong className="text-amber-700">Preferred</strong>: not met sends them to HR as Needs a look (for example “Notice period 30 days or less”).</p>
                <p><strong className="text-slate-800">Just ask</strong>: the answer is written down and changes nothing (for example current salary).</p>
              </div>

              {qGroup === 'main' ? (
                <Section title="Main questions" help="Asked for every post that has no list of its own.">
                  <ScreeningQuestionsEditor value={mainSet} max={MAX_SCREENING_QUESTIONS} onChange={(v) => patch((p) => ({ ...p, ...v }))} />
                </Section>
              ) : (() => {
                const g = GROUPS.find((x) => x.key === qGroup)!;
                const own = s.sets[qGroup];
                return (
                  <Section title={`${g.name} (${g.help})`}>
                    {qGroup === 'non_teaching' && (
                      <div className="p-3 rounded-xl border border-slate-200 space-y-2">
                        <p className="text-sm font-semibold text-slate-900">Which posts are non-teaching?</p>
                        <p className="text-xs text-slate-500">A candidate whose post (subject) is one of these gets the non-teaching questions.</p>
                        <div className="flex flex-wrap gap-1.5">
                          {[...new Set([...data.subjects, ...s.non_teaching_roles])].map((r) => {
                            const on = s.non_teaching_roles.some((x) => x.toLowerCase() === r.toLowerCase());
                            return (
                              <button key={r} type="button" aria-pressed={on}
                                onClick={() => patch((p) => ({ ...p, non_teaching_roles: on ? p.non_teaching_roles.filter((x) => x.toLowerCase() !== r.toLowerCase()) : [...p.non_teaching_roles, r] }))}
                                className={`px-2.5 py-1 rounded-full border text-xs font-semibold cursor-pointer ${on ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                                {r}
                              </button>
                            );
                          })}
                        </div>
                        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const r = newRole.trim(); if (r) { patch((p) => ({ ...p, non_teaching_roles: [...new Set([...p.non_teaching_roles, r])] })); setNewRole(''); } }}>
                          <input value={newRole} onChange={(e) => setNewRole(e.target.value)} maxLength={60} placeholder="Add a post, e.g. Front office, Accountant, Driver" className={inputClass} />
                          <button type="submit" className={buttonClass('secondary', 'sm')}>Add</button>
                        </form>
                      </div>
                    )}
                    {own ? (
                      <>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button type="button" onClick={() => patch((p) => ({ ...p, sets: { ...p.sets, [qGroup]: copySet(STARTER_SETS[qGroup]) } }))} className={buttonClass('ghost', 'sm')}>
                            <RotateCcw className="w-3.5 h-3.5" /> Go back to the starter questions
                          </button>
                          <button type="button" onClick={() => patch((p) => { const sets = { ...p.sets }; delete sets[qGroup]; return { ...p, sets }; })} className={buttonClass('ghost', 'sm')}>
                            <X className="w-3.5 h-3.5" /> Use the main questions instead
                          </button>
                        </div>
                        <ScreeningQuestionsEditor value={own} max={MAX_SCREENING_QUESTIONS} onChange={(v) => patch((p) => ({ ...p, sets: { ...p.sets, [qGroup]: v } }))} />
                      </>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 space-y-3">
                        <p>{g.name} candidates are asked the <strong>main questions</strong>. Give them their own list:</p>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => patch((p) => ({ ...p, sets: { ...p.sets, [qGroup]: copySet(STARTER_SETS[qGroup]) } }))} className={buttonClass('primary', 'sm')}>
                            <ShieldCheck className="w-4 h-4" /> Start from our {g.name.toLowerCase()} questions
                          </button>
                          <button type="button" onClick={() => patch((p) => ({ ...p, sets: { ...p.sets, [qGroup]: copySet(mainSet) } }))} className={buttonClass('secondary', 'sm')}>
                            <Copy className="w-4 h-4" /> Copy the main questions
                          </button>
                        </div>
                      </div>
                    )}
                  </Section>
                );
              })()}
            </>
          )}

          {tab === 'after' && (
            <>
              <Toggle checked={s.rules.enabled} onChange={(v) => setRule('enabled', v)} title="Act on the result automatically" help="Until you switch this on, the AI only writes up the call and HR does everything by hand. Retries and call-backs also need this on." />
              <fieldset disabled={rulesOff} className={`space-y-5 ${rulesOff ? 'opacity-50' : ''}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-1.5">Start from a ready-made choice <span className="font-normal text-slate-500">(you can still change anything below)</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {RULE_PRESETS.map((p) => (
                      <button key={p.key} type="button" onClick={() => patch((x) => ({ ...x, rules: { ...x.rules, ...p.rules } }))} aria-pressed={preset === p.key}
                        className={`text-left p-3 rounded-xl border text-sm cursor-pointer ${preset === p.key ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <span className="font-bold text-slate-900 block">{p.name}{preset === p.key && <span className="ml-1.5 text-[10px] font-bold text-indigo-700 uppercase">chosen</span>}</span>
                        <span className="text-xs text-slate-500">{p.help}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">When the candidate answers the call</p>
                  {RESULTS.map((res) => (
                    <div key={res.key} className={`grid grid-cols-1 sm:grid-cols-[1fr_16rem] gap-2 items-center p-3 rounded-xl border ${res.tone}`}>
                      <div className="text-sm">
                        <p className="font-bold text-slate-900 flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${res.dot}`} /> {res.name}</p>
                        <p className="text-xs text-slate-600">{res.means}</p>
                      </div>
                      <label className="text-xs font-semibold text-slate-600">Then:
                        <select value={s.rules[res.key]} onChange={(e) => setRule(res.key, e.target.value as ScreeningAction)} aria-label={`What happens for a ${res.name} result`} className={`${select} mt-1`}>
                          {CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </label>
                    </div>
                  ))}
                  <p className="text-xs text-slate-500">
                    A decline is never sent on its own: “Suggest a decline” puts a <strong>Send the decline</strong> button on the candidate’s page, and the polite message goes out only when HR presses it. HR can send the test link instead.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={field}>If they say they are no longer interested
                    <select value={s.rules.on_not_interested} onChange={(e) => setRule('on_not_interested', e.target.value as ScreeningRules['on_not_interested'])} className={select}>
                      <option value="withdraw">Mark them as withdrawn (nothing is sent)</option>
                      <option value="as_not_suitable">Treat it as Not suitable</option>
                    </select>
                  </label>
                  <label className={field}>If a result waits for HR
                    <select value={s.rules.hold_days} onChange={(e) => setRule('hold_days', Number(e.target.value))} className={select}>
                      {HOLD_DAY_CHOICES.map((d) => <option key={d} value={d}>{d === 0 ? 'Wait as long as it takes' : `More than ${d} ${d === 1 ? 'day' : 'days'}`}</option>)}
                    </select>
                  </label>
                  {s.rules.hold_days > 0 && (
                    <label className={`${field} sm:col-start-2`}>Then
                      <select value={s.rules.after_hold} onChange={(e) => setRule('after_hold', e.target.value as ScreeningRules['after_hold'])} className={select}>
                        <option value="remind">Email HR a reminder</option>
                        <option value="send_link">Send the test link anyway (declines are only reminded)</option>
                      </select>
                    </label>
                  )}
                </div>
              </fieldset>
            </>
          )}

          {tab === 'missed' && (
            <fieldset disabled={rulesOff} className={`space-y-5 ${rulesOff ? 'opacity-50' : ''}`}>
              {rulesOff && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Switch on “Act on the result automatically” in After the call for retries and call-backs to happen.</p>}
              <Section title="If they do not pick up, or the line is busy" Icon={PhoneMissed}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={field}>Try again
                    <select value={s.rules.retries} onChange={(e) => setRule('retries', Number(e.target.value))} className={select}>
                      {Array.from({ length: MAX_RETRIES + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Never' : `${n} ${n === 1 ? 'time' : 'times'}`}</option>)}
                    </select>
                  </label>
                  <label className={field}>Wait between tries
                    <select value={s.rules.retry_gap_hours} onChange={(e) => setRule('retry_gap_hours', Number(e.target.value))} className={select}>
                      {[1, 2, 3, 4, 6, 12, 24, 48].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>)}
                    </select>
                  </label>
                  <label className={field}>After the last try
                    <select value={s.rules.after_no_answer} onChange={(e) => setRule('after_no_answer', e.target.value as 'send_link' | 'flag')} className={select}>
                      <option value="flag">Send nothing, flag for HR</option>
                      <option value="send_link">Send the test link anyway</option>
                    </select>
                  </label>
                </div>
                <Toggle checked={s.rules.missed_call_message} onChange={(v) => setRule('missed_call_message', v)} title="Tell them we tried to call" help="After the first missed call, an email (and a WhatsApp message if they have chatted with you today) says who called and when the AI will try again. More people pick up the second time." />
              </Section>

              <Section title="If they say “call me later”" Icon={CalendarClock} help="The AI understands answers like “I am in class, call me after 4” or “call tomorrow morning” and rings them then, inside your calling hours.">
                <label className={`${field} sm:max-w-sm`}>Call back at the time they ask
                  <select value={s.rules.max_callbacks} onChange={(e) => setRule('max_callbacks', Number(e.target.value))} className={select}>
                    {Array.from({ length: MAX_CALLBACKS + 1 }, (_, n) => <option key={n} value={n}>{n === 0 ? 'Never: flag for HR to call' : `Up to ${n} ${n === 1 ? 'time' : 'times'}`}</option>)}
                  </select>
                </label>
              </Section>

              <Section title="If the call cannot go through" help="For example a number on the Do Not Disturb list, or a number that is switched off. These are not retried.">
                <label className={`${field} sm:max-w-sm`}>Then
                  <select value={s.rules.after_failed} onChange={(e) => setRule('after_failed', e.target.value as 'send_link' | 'flag')} className={select}>
                    <option value="flag">Send nothing, flag for HR</option>
                    <option value="send_link">Send the test link anyway</option>
                  </select>
                </label>
              </Section>
            </fieldset>
          )}

          {tab === 'limits' && (
            <>
              <Section title="Spending limits" Icon={Wallet} help="Calls stop when a limit is reached, so there are no surprise bills. A call already ringing still finishes.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={field}>Most to spend in a month (₹)
                    <input type="number" min={0} step={100} value={s.limits.monthly_cap_inr || ''} placeholder="No limit"
                      onChange={(e) => setLimit('monthly_cap_inr', Math.max(0, Math.round(Number(e.target.value) || 0)))} className={inputClass} />
                    <span className="font-normal text-slate-500">About {s.limits.monthly_cap_inr ? Math.floor(s.limits.monthly_cap_inr / (data.price_per_min_inr * 3 || 1)) : '∞'} three-minute calls. When reached, candidates are flagged for HR instead.</span>
                  </label>
                  <label className={field}>Most automatic calls in a day
                    <input type="number" min={0} step={5} value={s.limits.daily_max_calls || ''} placeholder="No limit"
                      onChange={(e) => setLimit('daily_max_calls', Math.max(0, Math.round(Number(e.target.value) || 0)))} className={inputClass} />
                    <span className="font-normal text-slate-500">Extra calls move to the next day. HR’s own “Call now” is not counted.</span>
                  </label>
                </div>
                {data.owner_cap_inr > 0 && !data.is_owner && (
                  <p className="text-xs text-slate-600">Edcruiter also limits your school to ₹{data.owner_cap_inr} a month. The lower of the two limits applies.</p>
                )}
              </Section>

              <Section title="Who is told" Icon={Bell} help="Emails go to these people. With nobody added, they go to your school’s main contact.">
                <div className="flex flex-wrap gap-1.5">
                  {s.notify.emails.map((e) => (
                    <span key={e} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900">
                      {e}
                      <button type="button" aria-label={`Remove ${e}`} onClick={() => setNotify('emails', s.notify.emails.filter((x) => x !== e))} className="p-0.5 rounded-full hover:bg-indigo-100 cursor-pointer"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
                <form className="flex gap-2 sm:max-w-md" onSubmit={(ev) => {
                  ev.preventDefault();
                  const e = newEmail.trim().toLowerCase();
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast('Type a full email address.', 'error'); return; }
                  setNotify('emails', [...new Set([...s.notify.emails, e])].slice(0, 10));
                  setNewEmail('');
                }}>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="hr@yourschool.in" className={inputClass} />
                  <button type="submit" className={buttonClass('secondary', 'sm')}>Add</button>
                </form>
                <Toggle checked={s.notify.good_fit_now} onChange={(v) => setNotify('good_fit_now', v)} title="Email me the moment there is a good fit" help="Good teachers get other offers fast. You hear about them within a minute of the call." />
                <Toggle checked={s.notify.daily_digest} onChange={(v) => setNotify('daily_digest', v)} title="Daily summary in the evening" help="After calling hours: how many were called, how many are good fits, what is waiting for you, and this month’s spend." />
                <p className="text-xs text-slate-500">HR also gets a reminder when a result waits longer than you allow (After the call), and an email if the monthly limit is reached.</p>
              </Section>

              {data.is_owner && (
                <Section title="Edcruiter owner settings" Icon={ShieldCheck} help="Only you see these. The school cannot change them.">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-violet-200 bg-violet-50/50">
                    <label className={field}>Price to this school per started minute (₹)
                      <input type="number" min={0} step={0.5} value={owner.price_per_min_inr}
                        onChange={(e) => { setOwner((o) => ({ ...o, price_per_min_inr: Math.max(0, Number(e.target.value) || 0) })); setDirty(true); }} className={inputClass} />
                    </label>
                    <label className={field}>Owner’s monthly limit for this school (₹)
                      <input type="number" min={0} step={100} value={owner.owner_cap_inr || ''} placeholder="No limit"
                        onChange={(e) => { setOwner((o) => ({ ...o, owner_cap_inr: Math.max(0, Math.round(Number(e.target.value) || 0)) })); setDirty(true); }} className={inputClass} />
                    </label>
                  </div>
                </Section>
              )}
            </>
          )}

          {tab === 'script' && (
            <ScreeningScriptEditor value={s.script} onChange={(script) => patch((p) => ({ ...p, script }))} schoolName={school?.name || 'Your school'} firstQuestion={s.questions[0]} />
          )}

          {tab === 'try' && <ScreeningTrial rules={s.rules} setFor={setFor} />}
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <p className="text-sm font-bold text-indigo-900 mb-2">In plain words, this is what will happen</p>
          <ul className="space-y-1.5 text-sm text-slate-800 list-disc pl-5">
            <li>
              {s.auto_call_on_apply
                ? `New applicants${s.auto_call.groups.length ? ` for ${s.auto_call.groups.map((g) => GROUPS.find((x) => x.key === g)!.name.toLowerCase()).join(', ')} posts` : ''}${s.auto_call.min_cv_score ? ` with a CV score of ${s.auto_call.min_cv_score}/10 or more` : ''} are called ${s.auto_call.delay_min ? `${s.auto_call.delay_min} minutes after applying` : 'soon after applying'}, between ${hourText(s.rules.window_start_hour)} and ${hourText(s.rules.window_end_hour)}${s.rules.skip_sundays ? ', not on Sundays' : ''}, in ${s.language === 'auto' ? 'their own language' : s.language}.`
                : 'Nobody is called automatically. HR presses “Call now” on a candidate, or calls several from the candidates list.'}
            </li>
            {summary.map((line) => <li key={line}>{line}</li>)}
            {effectiveCap > 0 && <li>Calls stop for the month once ₹{effectiveCap} is spent.</li>}
          </ul>
        </div>

        <SaveBar onSave={save} saving={saving} dirty={dirty} />
      </div>
    </Card>
  );
}
