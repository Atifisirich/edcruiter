'use client';

import React, { useState } from 'react';
import { digitsOnly } from '@/lib/salary';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import GradePicker from '@/components/admin/GradePicker';
import { Card, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import { suggestRoleName } from '@/lib/payGuide';
import { displayName, levelLabel, previewRange, problemsOf, setEdge, setUsual, type EditRole, type EditTier } from '@/lib/payGuideEdit';
import type { PotState } from '@/lib/payGuide';

export type Person = { id: string; name: string; role_name: string };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function Heading({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">{n}</span>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * One job, edited as three short questions: who is it for, what do you pay,
 * and (only if wanted) the extras. A preview at the end shows exactly what
 * the decision-maker will see, so the admin can check it before saving.
 */
export default function JobEditor({
  role,
  subjects,
  people,
  campusName,
  campusDecider,
  pot,
  onChange,
  onDone,
  onRemove,
}: {
  role: EditRole;
  subjects: string[];
  people: Person[];
  campusName: string;
  /** The person who decides at this campus unless this job says otherwise. */
  campusDecider: string;
  pot: PotState | null;
  onChange: (next: EditRole) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  const [years, setYears] = useState(3);
  const [bed, setBed] = useState(false);
  const [masters, setMasters] = useState(false);
  const [editYears, setEditYears] = useState(false);

  const patch = (p: Partial<EditRole>) => onChange({ ...role, ...p });
  const setTier = (i: number, t: EditTier) => patch({ tiers: role.tiers.map((x, at) => (at === i ? t : x)) });
  const problems = problemsOf(role);
  const preview = previewRange(role, years, bed, masters);
  const suggestion = suggestRoleName(role.grades, role.subjects);
  const decidesName = role.decider ? people.find((p) => p.id === role.decider)?.name : undefined;

  const cell = `${inputClass} !py-2 !px-2.5 tabular-nums`;

  return (
    <Card className="!border-indigo-300 ring-2 ring-indigo-100">
      <div className="space-y-8">
        {/* 1 */}
        <section className="space-y-4">
          <Heading n={1} title="Which teachers is this job for?" hint={`For ${campusName}. A teacher is matched to the job from the grades and subject they applied for.`} />
          <GradePicker value={role.grades} onChange={(grades) => patch({ grades })} label="Grades" required />
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Subjects <span className="font-normal text-slate-500">· leave empty if every subject is paid the same</span></p>
            <div className="flex flex-wrap gap-1.5">
              {subjects.map((s) => {
                const on = role.subjects.some((x) => x.toLowerCase() === s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patch({ subjects: on ? role.subjects.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...role.subjects, s] })}
                    className={`px-3 py-1.5 rounded-full border text-sm font-semibold cursor-pointer ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-300'}`}
                  >
                    {s}
                  </button>
                );
              })}
              {subjects.length === 0 && <p className="text-sm text-slate-500">Add subjects to your school first. Until then this job covers every subject.</p>}
            </div>
          </div>
          <label className="block text-sm font-medium text-slate-700">Name of the job
            <input value={role.name} maxLength={60} onChange={(e) => patch({ name: e.target.value })} placeholder={role.grades.length ? suggestion : 'We will suggest one once you choose the grades'} className={`${inputClass} mt-1`} />
            <span className="block mt-1 text-sm font-normal text-slate-500">You can leave this empty. We will call it “{role.grades.length ? displayName(role) : '…'}”.</span>
          </label>
        </section>

        {/* 2 */}
        <section className="space-y-4">
          <Heading n={2} title="What do you pay each month?" hint="Rupees a month, before deductions. Type the usual pay for each level of experience. We fill in a lowest and highest around it, and you can change them." />
          <div className="space-y-3">
            {role.tiers.map((t, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{i === 0 ? 'A fresher, ' : ''}{levelLabel(t).toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setEditYears((v) => !v)} className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer">{editYears ? 'Hide years' : 'Change the years'}</button>
                    <button type="button" onClick={() => patch({ tiers: role.tiers.filter((_, at) => at !== i) })} disabled={role.tiers.length <= 1} aria-label={`Remove ${levelLabel(t)}`} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {editYears && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    From <input type="number" min={0} value={t.from} onChange={(e) => setTier(i, { ...t, from: e.target.value })} aria-label="From years" className={`${cell} w-20`} />
                    to <input type="number" min={0} value={t.to} placeholder="and above" onChange={(e) => setTier(i, { ...t, to: e.target.value })} aria-label="To years" className={`${cell} w-28`} /> years
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="block text-sm font-medium text-slate-700">Usual pay (₹ a month)
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={t.ideal} onChange={(e) => setTier(i, setUsual(t, digitsOnly(e.target.value)))} placeholder="e.g. 30000" className={`${inputClass} mt-1 !text-lg !font-semibold tabular-nums`} />
                    <span className="mt-1 block text-xs font-normal text-slate-500">Monthly, in rupees, numbers only (e.g. 30000).</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:w-72">
                    <label className="block text-xs font-medium text-slate-600">Lowest
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={t.min} onChange={(e) => setTier(i, setEdge(t, 'min', digitsOnly(e.target.value)))} className={`${cell} mt-1`} />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">Highest
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={t.max} onChange={(e) => setTier(i, setEdge(t, 'max', digitsOnly(e.target.value)))} className={`${cell} mt-1`} />
                    </label>
                  </div>
                </div>
                {t.auto && t.ideal && <p className="text-xs text-slate-500">Lowest and highest were filled in for you from the usual pay.</p>}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const last = role.tiers[role.tiers.length - 1];
                const next = last?.to ? Number(last.to) : last ? Number(last.from) + 3 : 0;
                patch({ tiers: [...role.tiers.map((t, i) => (i === role.tiers.length - 1 && t.to === '' ? { ...t, to: String(next) } : t)), { from: String(next), to: '', min: '', ideal: '', max: '', auto: true }] });
              }}
              disabled={role.tiers.length >= 8}
              className={buttonClass('secondary', 'sm')}
            >
              <Plus className="w-4 h-4" /> Add another level of experience
            </button>
          </div>
        </section>

        {/* 3 */}
        <section className="space-y-3">
          <Heading n={3} title="Anything extra?" hint="All optional. Skip this if you do not need it." />
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Extra pay for a B.Ed or a master’s degree {(role.bed || role.masters) && <span className="text-indigo-700 font-medium">· set</span>}</summary>
            <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">With a B.Ed, add (₹ a month)
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={role.bed} onChange={(e) => patch({ bed: digitsOnly(e.target.value) })} placeholder="None" className={`${inputClass} mt-1`} />
              </label>
              <label className="block text-sm font-medium text-slate-700">With a master’s degree, add (₹ a month)
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={role.masters} onChange={(e) => patch({ masters: digitsOnly(e.target.value) })} placeholder="None" className={`${inputClass} mt-1`} />
              </label>
            </div>
          </details>
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">A budget for this job {(role.positions || role.budget) && <span className="text-indigo-700 font-medium">· set</span>}</summary>
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-slate-600">For example: 3 posts, and no more than ₹90,000 a month in total. An offer that would go over it waits for your approval.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">How many posts to fill
                  <input type="number" min={1} value={role.positions} onChange={(e) => patch({ positions: e.target.value })} placeholder="e.g. 3" className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-sm font-medium text-slate-700">The most you can spend a month in total (₹)
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={role.budget} onChange={(e) => patch({ budget: digitsOnly(e.target.value) })} placeholder="e.g. 90000" className={`${inputClass} mt-1`} />
                </label>
              </div>
              {pot && <p className="text-sm text-slate-600">So far: {pot.filled} of {pot.positions} posts filled, {inr(pot.used_monthly)} of {inr(pot.monthly_budget)} used.</p>}
            </div>
          </details>
          <details className="rounded-2xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Someone else takes the final call for this job {role.decider && <span className="text-indigo-700 font-medium">· {decidesName ?? 'set'}</span>}</summary>
            <div className="px-4 pb-4 space-y-2">
              <p className="text-sm text-slate-600">By default this is {campusDecider}. Pick someone only if this job is decided by a different person.</p>
              <select value={role.decider} onChange={(e) => patch({ decider: e.target.value })} aria-label="Who takes the final call for this job" className={`${selectClass} block w-full sm:w-80`}>
                <option value="">{campusDecider} (the usual)</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role_name}</option>)}
              </select>
            </div>
          </details>
        </section>

        {/* Preview */}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5 space-y-3">
          <p className="text-sm font-semibold text-emerald-950">Try it: what will the decision-maker see?</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-800">
            <label className="flex items-center gap-2">A teacher with
              <input type="number" min={0} max={40} value={years} onChange={(e) => setYears(Math.max(0, Number(e.target.value) || 0))} aria-label="Years of experience" className={`${cell} w-20`} /> years
            </label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={bed} onChange={(e) => setBed(e.target.checked)} className="accent-indigo-600" /> has a B.Ed</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={masters} onChange={(e) => setMasters(e.target.checked)} className="accent-indigo-600" /> has a master’s</label>
          </div>
          {preview ? (
            <p className="text-sm text-slate-800">
              They may be offered <strong className="tabular-nums">{inr(preview.min)} to {inr(preview.max)}</strong> a month, usually <strong className="tabular-nums">{inr(preview.ideal)}</strong>
              <span className="text-slate-500"> ({preview.level.toLowerCase()}{preview.topup ? `, with ${inr(preview.topup)} extra for the degree` : ''}).</span>
              {' '}{role.decider ? decidesName : campusDecider} takes the final call. Anything above {inr(preview.max)} comes to you for approval.
            </p>
          ) : (
            <p className="text-sm text-slate-600">Fill in the pay above to see this.</p>
          )}
        </section>

        {/* What is left */}
        <section className="space-y-2">
          <p className="text-sm font-semibold text-slate-900">{problems.length === 0 ? 'This job is ready.' : 'To finish this job'}</p>
          {problems.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 className="w-4 h-4" /> Press Done, then Save the Pay Guide at the bottom of the page.</p>
          ) : (
            <ul className="space-y-1">
              {problems.map((p) => <li key={p} className="flex items-start gap-2 text-sm text-slate-700"><Circle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" /> {p}</li>)}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 hover:underline cursor-pointer"><Trash2 className="w-4 h-4" /> Remove this job</button>
          <button type="button" onClick={onDone} className={buttonClass('primary')}>Done</button>
        </div>
      </div>
    </Card>
  );
}
