'use client';

import React, { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { GROUPS, trialRun, type Outcome } from '@/lib/screeningFlow';
import type { ScreeningCheck, ScreeningGroup, ScreeningQuestionSet, ScreeningRules } from '@/lib/types';

const selectSm = 'mt-1 w-full px-2.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800';
const TONE = {
  good: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  look: 'border-amber-300 bg-amber-50 text-amber-900',
  bad: 'border-rose-300 bg-rose-50 text-rose-900',
  wait: 'border-indigo-300 bg-indigo-50 text-indigo-900',
} as const;

/**
 * "Try it": make up how one call went and see exactly what the school's rules
 * (as they are on screen, saved or not) would do. Nothing is called or sent.
 */
export default function ScreeningTrial({ rules, setFor }: { rules: ScreeningRules; setFor: (g: ScreeningGroup | 'main') => ScreeningQuestionSet }) {
  const [group, setGroup] = useState<ScreeningGroup | 'main'>('main');
  const [pickup, setPickup] = useState<'answered' | 'callback' | 'no_answer' | 'failed'>('answered');
  const [interest, setInterest] = useState<'interested' | 'not_interested' | 'unclear'>('interested');
  const [rec, setRec] = useState<Outcome>('proceed');
  const [attempt, setAttempt] = useState(1);
  const [results, setResults] = useState<Record<string, ScreeningCheck['result']>>({});

  const set = setFor(group);
  const wishes = set.questions
    .map((q, i) => ({ question: q, requirement: set.requirements[i] ?? '', importance: set.importance[i] ?? 'ask' }))
    .filter((w) => w.importance !== 'ask' && w.requirement.trim());
  const checks: ScreeningCheck[] = wishes.map((w) => ({
    question: w.question, requirement: w.requirement, importance: w.importance as 'must' | 'prefer', result: results[`${group}:${w.question}`] ?? 'met',
  }));
  const out = useMemo(() => trialRun(rules, { pickup, interest, recommendation: rec, checks, attempt: pickup === 'callback' ? attempt - 1 : attempt }), [rules, pickup, interest, rec, checks, attempt]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 flex items-start gap-2">
        <FlaskConical className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        Make up how a call went and see what your rules would do, before any real candidate is called. Nothing is called or sent. It uses the settings on this screen, even unsaved ones.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
        <label>Post applied for
          <select value={group} onChange={(e) => setGroup(e.target.value as ScreeningGroup | 'main')} className={selectSm}>
            <option value="main">Any post (main questions)</option>
            {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
          </select>
        </label>
        <label>How the call went
          <select value={pickup} onChange={(e) => { setPickup(e.target.value as typeof pickup); setAttempt(1); }} className={selectSm}>
            <option value="answered">They picked up and answered</option>
            <option value="callback">They picked up but said “call me later”</option>
            <option value="no_answer">They did not pick up</option>
            <option value="failed">The call could not go through</option>
          </select>
        </label>
        {pickup === 'answered' && (
          <>
            <label>Are they still interested?
              <select value={interest} onChange={(e) => setInterest(e.target.value as typeof interest)} className={selectSm}>
                <option value="interested">Yes</option>
                <option value="unclear">Not clear</option>
                <option value="not_interested">No, not any more</option>
              </select>
            </label>
            <label>The AI’s overall view
              <select value={rec} onChange={(e) => setRec(e.target.value as Outcome)} className={selectSm}>
                <option value="proceed">Move forward</option>
                <option value="maybe">Not sure</option>
                <option value="not_suitable">Not suitable</option>
              </select>
            </label>
          </>
        )}
        {(pickup === 'no_answer' || pickup === 'callback') && (
          <label>{pickup === 'no_answer' ? 'Which try is this?' : 'Which call-back is this?'}
            <select value={attempt} onChange={(e) => setAttempt(Number(e.target.value))} className={selectSm}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{pickup === 'no_answer' ? (n === 1 ? 'The first call' : `Retry ${n - 1}`) : `Call-back ${n}`}</option>)}
            </select>
          </label>
        )}
      </div>

      {pickup === 'answered' && interest !== 'not_interested' && (
        wishes.length ? (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-slate-600">What they said, against what you want to hear</p>
            {checks.map((c) => (
              <div key={c.question} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-2 items-center p-2.5 rounded-xl border border-slate-200 bg-white">
                <p className="text-xs text-slate-700">
                  <span className={`font-bold ${c.importance === 'must' ? 'text-rose-700' : 'text-amber-700'}`}>{c.importance === 'must' ? 'Must have' : 'Preferred'}:</span> {c.requirement}
                </p>
                <select
                  value={c.result}
                  onChange={(e) => setResults((r) => ({ ...r, [`${group}:${c.question}`]: e.target.value as ScreeningCheck['result'] }))}
                  aria-label={`Answer for: ${c.requirement}`}
                  className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="met">Met</option>
                  <option value="unclear">Not clear</option>
                  <option value="not_met">Not met</option>
                </select>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">These questions have no must-haves or preferences, so only the AI&apos;s overall view decides the result.</p>
        )
      )}

      <div className={`rounded-xl border-2 p-4 ${TONE[out.tone]}`} aria-live="polite">
        <p className="text-base font-black">{out.result}</p>
        <ol className="mt-1.5 space-y-1 text-sm list-decimal pl-5">
          {out.steps.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </div>
    </div>
  );
}
