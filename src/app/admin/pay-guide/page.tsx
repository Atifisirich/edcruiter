'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, SaveBar, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import GradePicker from '@/components/admin/GradePicker';
import { isAdmin } from '@/lib/permissions';
import type { FinalOffer, PayGuide, PayRole, PayTier } from '@/lib/types';
import type { PotState } from '@/lib/payGuide';

/** A tier while it is being edited: every box is text until it is saved. */
interface EditTier { id?: string; from: string; to: string; min: string; ideal: string; max: string }
interface EditRole {
  id?: string;
  name: string;
  grades: string[];
  subjects: string[];
  decider: string;
  tiers: EditTier[];
  campus: Record<string, EditTier[]>;
  bed: string;
  masters: string;
  positions: string;
  budget: string;
}
type Person = { id: string; name: string; role_name: string };
type Pending = { id: string; name: string; offer: FinalOffer };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const toTier = (t: PayTier): EditTier => ({ id: t.id, from: String(t.from_years), to: t.to_years === null ? '' : String(t.to_years), min: String(t.min), ideal: String(t.ideal), max: String(t.max) });
const blankTier = (from = 0): EditTier => ({ from: String(from), to: '', min: '', ideal: '', max: '' });
const toEdit = (r: PayRole): EditRole => ({
  id: r.id, name: r.name, grades: r.grades, subjects: r.subjects, decider: r.decider_user_id ?? '',
  tiers: r.tiers.map(toTier),
  campus: Object.fromEntries(Object.entries(r.branch_tiers ?? {}).map(([b, t]) => [b, t.map(toTier)])),
  bed: r.bed_topup ? String(r.bed_topup) : '', masters: r.masters_topup ? String(r.masters_topup) : '',
  positions: r.pot ? String(r.pot.positions) : '', budget: r.pot ? String(r.pot.monthly_budget) : '',
});
const sendTiers = (tiers: EditTier[]) => tiers.map((t) => ({ id: t.id, from_years: Number(t.from), to_years: t.to === '' ? null : Number(t.to), min: Number(t.min), ideal: Number(t.ideal), max: Number(t.max) }));
const send = (r: EditRole) => ({
  id: r.id, name: r.name, grades: r.grades, subjects: r.subjects, decider_user_id: r.decider || undefined,
  tiers: sendTiers(r.tiers),
  branch_tiers: Object.fromEntries(Object.entries(r.campus).filter(([, t]) => t.length).map(([b, t]) => [b, sendTiers(t)])),
  bed_topup: r.bed ? Number(r.bed) : undefined, masters_topup: r.masters ? Number(r.masters) : undefined,
  pot: r.positions || r.budget ? { positions: Number(r.positions), monthly_budget: Number(r.budget) } : undefined,
});

function TierEditor({ tiers, onChange, label }: { tiers: EditTier[]; onChange: (t: EditTier[]) => void; label: string }) {
  const set = (i: number, patch: Partial<EditTier>) => onChange(tiers.map((t, at) => (at === i ? { ...t, ...patch } : t)));
  const cell = `${inputClass} !py-2 !px-2.5 tabular-nums`;
  return (
    <div className="space-y-2">
      <div className="hidden sm:grid grid-cols-[4.5rem_4.5rem_1fr_1fr_1fr_2.5rem] gap-2 text-xs font-semibold text-slate-500 px-1">
        <span>From (years)</span><span>To (years)</span><span>Lowest ₹ a month</span><span>Ideal ₹ a month</span><span>Highest ₹ a month</span><span />
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-2 sm:grid-cols-[4.5rem_4.5rem_1fr_1fr_1fr_2.5rem] gap-2 items-center rounded-xl border border-slate-200 p-2 sm:border-0 sm:p-0">
          <input type="number" min={0} value={t.from} onChange={(e) => set(i, { from: e.target.value })} aria-label={`${label} tier ${i + 1} from years`} className={cell} />
          <input type="number" min={0} value={t.to} placeholder="and above" onChange={(e) => set(i, { to: e.target.value })} aria-label={`${label} tier ${i + 1} to years`} className={cell} />
          <input type="number" min={0} value={t.min} placeholder="Lowest" onChange={(e) => set(i, { min: e.target.value })} aria-label={`${label} tier ${i + 1} lowest pay`} className={cell} />
          <input type="number" min={0} value={t.ideal} placeholder="Ideal" onChange={(e) => set(i, { ideal: e.target.value })} aria-label={`${label} tier ${i + 1} ideal pay`} className={cell} />
          <input type="number" min={0} value={t.max} placeholder="Highest" onChange={(e) => set(i, { max: e.target.value })} aria-label={`${label} tier ${i + 1} highest pay`} className={cell} />
          <button type="button" onClick={() => onChange(tiers.filter((_, at) => at !== i))} disabled={tiers.length <= 1} aria-label={`Remove tier ${i + 1}`} className={buttonClass('ghost', 'sm')}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const last = tiers[tiers.length - 1];
          const next = last?.to ? Number(last.to) : (last ? Number(last.from) + 2 : 0);
          // The previous tier closes where the new one starts.
          onChange([...tiers.map((t, i) => (i === tiers.length - 1 && t.to === '' ? { ...t, to: String(next) } : t)), blankTier(next)]);
        }}
        className={buttonClass('secondary', 'sm')}
      >
        <Plus className="w-4 h-4" /> Add a tier
      </button>
    </div>
  );
}

export default function PayGuidePage() {
  const { schoolId, user, toast } = useAdmin();
  const [roles, setRoles] = useState<EditRole[] | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pots, setPots] = useState<Record<string, PotState | null>>({});
  const [pending, setPending] = useState<Pending[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [answering, setAnswering] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pay-guide?school_id=${encodeURIComponent(schoolId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(data.error || 'Could not load the Pay Guide.'); return; }
      setRoles((data.guide as PayGuide).roles.map(toEdit));
      setSubjects(data.subjects ?? []);
      setBranches(data.branches ?? []);
      setPeople(data.people ?? []);
      setPots(data.pots ?? {});
      setPending(data.pending ?? []);
      setDirty(false);
    } catch {
      setLoadError('Could not reach the server. Check your connection and refresh.');
    }
  }, [schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
    void load();
  }, [load]);

  if (user && !isAdmin(user.role)) return <PageHeader title="Pay Guide" description="Only the school admin can see this." />;

  const change = (next: EditRole[]) => { setRoles(next); setDirty(true); setError(''); };
  const patch = (i: number, p: Partial<EditRole>) => roles && change(roles.map((r, at) => (at === i ? { ...r, ...p } : r)));

  const save = async () => {
    if (!roles) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/pay-guide?school_id=${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide: { roles: roles.map(send) } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save the Pay Guide.'); return; }
      toast('Pay Guide saved.', 'success');
      await load();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const answer = async (p: Pending, action: 'approve' | 'refuse') => {
    setAnswering(`${p.id}:${action}`);
    try {
      const res = await fetch(`/api/candidates/${p.id}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'Could not save your answer.', 'error'); return; }
      toast(action === 'approve' ? `Approved the offer for ${p.name}.` : `Did not approve the offer for ${p.name}.`, 'success');
      await load();
    } finally {
      setAnswering('');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Pay Guide"
        description="Tell your decision-makers what they may offer. For each job role, set the pay for each stretch of experience, who takes the final call, and how many posts and how much a month you can spend."
      />

      {loadError && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{loadError}</p>}

      {pending.length > 0 && (
        <Card className="!border-amber-300 !bg-amber-50/60">
          <CardHeader title={`Offers waiting for you (${pending.length})`} description="These are outside the Pay Guide: above the highest pay for the tier, or over the pot. Read the reason, then answer." />
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.id} className="rounded-xl border border-amber-200 bg-white p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{p.name} <span className="font-normal text-slate-500">· {p.offer.role_name}</span></p>
                  <p className="text-lg font-bold tabular-nums text-slate-900">{inr(p.offer.monthly)}<span className="text-xs font-medium text-slate-400"> a month</span></p>
                </div>
                <p className="text-sm text-slate-600">
                  The range for {p.offer.tier_label} is {inr(p.offer.range.min)} to {inr(p.offer.range.max)}.
                  {p.offer.over_range ? ` This is ${inr(p.offer.monthly - p.offer.range.max)} above the highest pay.` : ''}
                  {p.offer.over_pot ? ' It also goes over the pot.' : ''}
                </p>
                {p.offer.reason && <p className="text-sm text-slate-800 border-l-2 border-amber-400 pl-3">{p.offer.decided_by}: {p.offer.reason}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" disabled={!!answering} onClick={() => void answer(p, 'approve')} className={buttonClass('primary', 'sm')}>
                    {answering === `${p.id}:approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
                  </button>
                  <button type="button" disabled={!!answering} onClick={() => void answer(p, 'refuse')} className={buttonClass('secondary', 'sm')}>
                    {answering === `${p.id}:refuse` ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Do not approve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!roles && !loadError && <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />}

      {roles && roles.length === 0 && (
        <Card>
          <EmptyState
            Icon={Wallet}
            title="No pay roles yet"
            description="Add a role such as “Social Studies teacher, Grades 6 to 8” and set what it pays at each level of experience. A teacher is matched to a role from the grades and subject they applied for."
            action={<button type="button" onClick={() => change([{ name: '', grades: [], subjects: [], decider: '', tiers: [blankTier(0)], campus: {}, bed: '', masters: '', positions: '', budget: '' }])} className={buttonClass('primary')}><Plus className="w-4 h-4" /> Add the first role</button>}
          />
        </Card>
      )}

      {roles?.map((r, i) => {
        const pot = r.id ? pots[r.id] : null;
        return (
          <Card key={r.id ?? `new-${i}`}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-sm font-medium text-slate-700" htmlFor={`role-name-${i}`}>Role name</label>
                <input id={`role-name-${i}`} value={r.name} maxLength={60} onChange={(e) => patch(i, { name: e.target.value })} placeholder="e.g. Social Studies teacher, Grades 6 to 8" className={inputClass} />
              </div>
              <button type="button" onClick={() => change(roles.filter((_, at) => at !== i))} aria-label={`Remove ${r.name || 'this role'}`} className={`${buttonClass('ghost', 'sm')} mt-6`}><Trash2 className="w-4 h-4" /></button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <GradePicker value={r.grades} onChange={(grades) => patch(i, { grades })} label="Grades this role teaches" required />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-700">Subjects <span className="font-normal text-slate-500">(leave empty for any subject)</span></p>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((s) => {
                      const on = r.subjects.some((x) => x.toLowerCase() === s.toLowerCase());
                      return (
                        <button key={s} type="button" aria-pressed={on} onClick={() => patch(i, { subjects: on ? r.subjects.filter((x) => x.toLowerCase() !== s.toLowerCase()) : [...r.subjects, s] })} className={`px-3 py-1.5 rounded-full border text-sm font-semibold cursor-pointer ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-300'}`}>{s}</button>
                      );
                    })}
                    {subjects.length === 0 && <p className="text-sm text-slate-500">Add subjects to your school first.</p>}
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700">Who takes the final call
                <select value={r.decider} onChange={(e) => patch(i, { decider: e.target.value })} className={`${selectClass} mt-1 block w-full sm:w-80`}>
                  <option value="">The school admin</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role_name}</option>)}
                </select>
                <span className="block mt-1 text-sm font-normal text-slate-500">This person sees the range below on the teacher&apos;s report and sets the salary offer. HR still passes the teacher on.</span>
              </label>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-900">Pay by experience <span className="font-normal text-slate-500">· rupees a month, before deductions</span></p>
                <TierEditor tiers={r.tiers} onChange={(tiers) => patch(i, { tiers })} label={r.name || 'Role'} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <div className="sm:col-span-2"><p className="text-sm font-semibold text-slate-900">Extra for a degree <span className="font-normal text-slate-500">· added to every tier</span></p></div>
                <label className="block text-sm font-medium text-slate-700">With a B.Ed (₹ a month)
                  <input type="number" min={0} value={r.bed} onChange={(e) => patch(i, { bed: e.target.value })} placeholder="None" className={`${inputClass} mt-1`} />
                </label>
                <label className="block text-sm font-medium text-slate-700">With a master&apos;s degree (₹ a month)
                  <input type="number" min={0} value={r.masters} onChange={(e) => patch(i, { masters: e.target.value })} placeholder="None" className={`${inputClass} mt-1`} />
                </label>
              </div>

              {branches.length > 1 && (
                <details className="rounded-xl border border-slate-200">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">Different pay at one campus {Object.values(r.campus).some((t) => t.length) && <Badge tone="indigo" className="ml-2">Set</Badge>}</summary>
                  <div className="px-4 pb-4 space-y-4">
                    {branches.map((b) => {
                      const own = r.campus[b.id];
                      return (
                        <div key={b.id} className="space-y-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
                            <input type="checkbox" checked={!!own?.length} onChange={(e) => patch(i, { campus: { ...r.campus, [b.id]: e.target.checked ? r.tiers.map((t) => ({ ...t, id: undefined })) : [] } })} className="accent-indigo-600" />
                            {b.name} pays differently
                          </label>
                          {own?.length ? <TierEditor tiers={own} onChange={(t) => patch(i, { campus: { ...r.campus, [b.id]: t } })} label={b.name} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">The pot <span className="font-normal text-slate-500">· leave empty for no limit</span></p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">Posts to fill
                    <input type="number" min={1} value={r.positions} onChange={(e) => patch(i, { positions: e.target.value })} placeholder="e.g. 3" className={`${inputClass} mt-1`} />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">Most you can spend in total (₹ a month)
                    <input type="number" min={0} value={r.budget} onChange={(e) => patch(i, { budget: e.target.value })} placeholder="e.g. 90000" className={`${inputClass} mt-1`} />
                  </label>
                </div>
                {pot && (
                  <div className="space-y-1.5">
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={Math.min(100, Math.round((pot.used_monthly / pot.monthly_budget) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label="Pot used">
                      <div className={`h-full rounded-full ${pot.left_monthly < 0 ? 'bg-rose-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min(100, Math.round((pot.used_monthly / pot.monthly_budget) * 100))}%` }} />
                    </div>
                    <p className="text-sm text-slate-600">{pot.filled} of {pot.positions} posts filled · {inr(pot.used_monthly)} of {inr(pot.monthly_budget)} used · <strong className={pot.left_monthly < 0 ? 'text-rose-700' : 'text-slate-900'}>{inr(pot.left_monthly)} left</strong></p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {roles && roles.length > 0 && (
        <button type="button" onClick={() => change([...roles, { name: '', grades: [], subjects: [], decider: '', tiers: [blankTier(0)], campus: {}, bed: '', masters: '', positions: '', budget: '' }])} className={buttonClass('secondary')}>
          <Plus className="w-4 h-4" /> Add another role
        </button>
      )}

      {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
      {roles && <SaveBar onSave={() => void save()} saving={saving} dirty={dirty} label="Save the Pay Guide" />}
    </div>
  );
}
