'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronRight, Copy, Loader2, MapPin, Pencil, Plus, Sparkles, Table2, Trash2, UploadCloud, Wallet, X } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, SaveBar, buttonClass, selectClass } from '@/components/admin/ui';
import JobEditor, { type Person } from '@/components/admin/payguide/JobEditor';
import PayGuideImport from '@/components/admin/payguide/PayGuideImport';
import { combineRoles } from '@/lib/payGuideImport';
import { isAdmin } from '@/lib/permissions';
import { gradeSummary, type PotState } from '@/lib/payGuide';
import {
  blankRole, copyRole, displayName, fromServer, isComplete, levelLabel, payRangeText, problemsOf, setUsual, sharesLevels, toServer, typicalRoles, type EditRole,
} from '@/lib/payGuideEdit';
import type { FinalOffer, PayGuide } from '@/lib/types';

type Branch = { id: string; name: string };
type Pending = { id: string; name: string; offer: FinalOffer };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const ALL = '';

/** The three steps, in the order the admin does them. */
function Steps({ done }: { done: [boolean, boolean, boolean] }) {
  const items = [
    ['Pick a campus', 'Each campus can pay differently.'],
    ['Add its jobs and what each pays', 'Start from the usual stages, then type the pay.'],
    ['Say who takes the final call', 'Usually that campus’s Principal.'],
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {items.map(([title, hint], i) => (
        <li key={title} className={`rounded-2xl border p-4 flex gap-3 ${done[i] ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
          <span className={`w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center shrink-0 ${done[i] ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}>{done[i] ? <Check className="w-4 h-4" /> : i + 1}</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{hint}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function PayGuidePage() {
  const { schoolId, user, toast } = useAdmin();
  const [roles, setRoles] = useState<EditRole[] | null>(null);
  const [campusDeciders, setCampusDeciders] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [pots, setPots] = useState<Record<string, PotState | null>>({});
  const [pending, setPending] = useState<Pending[]>([]);
  // Which campus is open. Null until the admin picks one; then the first campus is shown.
  const [campus, setCampus] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [view, setView] = useState<'jobs' | 'table'>('jobs');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [answering, setAnswering] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pay-guide?school_id=${encodeURIComponent(schoolId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(data.error || 'Could not load the Pay Guide.'); return; }
      const guide = data.guide as PayGuide;
      const loaded = guide.roles.map(fromServer);
      setRoles(loaded);
      setCampusDeciders(guide.campus_deciders ?? {});
      setSubjects(data.subjects ?? []);
      setBranches(data.branches ?? []);
      setPeople(data.people ?? []);
      setPots(data.pots ?? {});
      setPending(data.pending ?? []);
      setDirty(false);
      setEditing(null);
    } catch {
      setLoadError('Could not reach the server. Check your connection and refresh.');
    }
  }, [schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
    void load();
  }, [load]);

  const multi = branches.length > 1;
  const everyCampusJobs = useMemo(() => (roles ?? []).filter((r) => !r.branch), [roles]);
  // A school with one campus has no tabs; its jobs apply to every campus.
  const showAllTab = multi && everyCampusJobs.length > 0;
  const current = multi ? campus ?? branches[0]?.id ?? ALL : ALL;
  const jobs = useMemo(() => (roles ?? []).filter((r) => (multi ? r.branch === current : true)), [roles, multi, current]);
  const campusName = !multi ? 'your school' : current === ALL ? 'every campus' : branches.find((b) => b.id === current)?.name ?? 'this campus';
  const deciderFor = (branch: string) => campusDeciders[branch] ? people.find((p) => p.id === campusDeciders[branch])?.name ?? 'the school admin' : 'the school admin';

  if (user && !isAdmin(user.role)) return <PageHeader title="Pay Guide" description="Only the school admin can see this." />;

  const change = (next: EditRole[]) => { setRoles(next); setDirty(true); setError(''); };
  const update = (key: string, next: EditRole) => roles && change(roles.map((r) => (r.key === key ? next : r)));
  const remove = (key: string) => { if (roles) { change(roles.filter((r) => r.key !== key)); setEditing(null); } };
  const addJob = () => {
    if (!roles) return;
    const r = blankRole(multi ? current : ALL);
    change([...roles, r]);
    setEditing(r.key);
  };
  const startWithUsual = () => {
    if (!roles) return;
    const made = typicalRoles(multi ? current : ALL);
    change([...roles, ...made]);
    setView('table');
  };
  const applyImport = (imported: EditRole[], mode: 'add' | 'replace') => {
    if (!roles) return;
    change(combineRoles(roles, imported, mode));
    setImporting(false);
    setView('jobs');
    setEditing(null);
    toast(`Brought in ${imported.length} ${imported.length === 1 ? 'job' : 'jobs'}. Check them, then press Save the Pay Guide.`, 'success');
  };
  const copyFrom = (branch: string) => {
    if (!roles) return;
    const source = roles.filter((r) => r.branch === branch);
    change([...roles, ...source.map((r) => copyRole(r, multi ? current : ALL))]);
    setCampusDeciders((d) => ({ ...d }));
  };
  const duplicate = (r: EditRole) => {
    if (!roles) return;
    const c = copyRole(r, r.branch, `${displayName(r)} (copy)`);
    change([...roles, c]);
    setEditing(c.key);
  };

  const campusStatus = (branch: string) => {
    const list = (roles ?? []).filter((r) => (multi ? r.branch === branch : true));
    const ready = list.filter(isComplete).length;
    return { count: list.length, ready, left: list.length - ready };
  };
  const campusesReady = multi ? branches.filter((b) => { const s = campusStatus(b.id); return s.count > 0 && s.left === 0; }).length : 0;
  const here = campusStatus(current);
  const steps: [boolean, boolean, boolean] = [
    !multi || branches.some((b) => campusStatus(b.id).count > 0),
    here.count > 0 && here.left === 0,
    multi ? !!campusDeciders[current] || jobs.some((j) => j.decider) : jobs.some((j) => j.decider),
  ];

  const save = async () => {
    if (!roles) return;
    const broken = roles.find((r) => !isComplete(r));
    if (broken) {
      setCampus(broken.branch || ALL);
      setEditing(broken.key);
      setError(`“${displayName(broken)}” is not finished yet: ${problemsOf(broken)[0]} Finish it, or remove it, then save.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/pay-guide?school_id=${encodeURIComponent(schoolId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guide: { roles: roles.map(toServer), campus_deciders: campusDeciders } }),
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

  const otherCampuses = branches.filter((b) => b.id !== current && campusStatus(b.id).count > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Pay Guide"
        description="Tell your decision-makers what they may offer. Set it campus by campus, job by job. It takes a few minutes, and you can change it any time."
        badge={multi && roles ? <Badge tone={campusesReady === branches.length ? 'emerald' : 'amber'}>{campusesReady} of {branches.length} campuses ready</Badge> : undefined}
      />

      {loadError && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{loadError}</p>}

      {pending.length > 0 && (
        <Card className="!border-amber-300 !bg-amber-50/60">
          <CardHeader title={`Offers waiting for you (${pending.length})`} description="These are outside the Pay Guide: above the highest pay, or over a budget. Read the reason, then answer." />
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
                  {p.offer.over_pot ? ' It also goes over the budget.' : ''}
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

      {roles && (
        <>
          {roles.length === 0 && <Steps done={steps} />}

          {/* 1. Campus first */}
          {multi && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Choose a campus</p>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Campuses">
                {branches.map((b) => {
                  const s = campusStatus(b.id);
                  const active = current === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setCampus(b.id); setEditing(null); setView('jobs'); }}
                      className={`text-left px-4 py-2.5 rounded-2xl border cursor-pointer ${active ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="w-3.5 h-3.5" /> {b.name}</span>
                      <span className={`block text-xs ${active ? 'text-indigo-100' : s.count === 0 ? 'text-amber-700' : s.left ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {s.count === 0 ? 'Not set up yet' : s.left ? `${s.left} of ${s.count} ${s.count === 1 ? 'job needs' : 'jobs need'} pay` : `${s.count} ${s.count === 1 ? 'job' : 'jobs'} ready`}
                      </span>
                    </button>
                  );
                })}
                {showAllTab && (
                  <button type="button" role="tab" aria-selected={current === ALL} onClick={() => { setCampus(ALL); setEditing(null); setView('jobs'); }} className={`text-left px-4 py-2.5 rounded-2xl border cursor-pointer ${current === ALL ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                    <span className="block text-sm font-semibold">Every campus</span>
                    <span className={`block text-xs ${current === ALL ? 'text-indigo-100' : 'text-slate-500'}`}>{everyCampusJobs.length} {everyCampusJobs.length === 1 ? 'job' : 'jobs'} set earlier</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <Card>
            <CardHeader
              title={multi ? `${campusName}` : 'Your jobs'}
              description={multi ? (current === ALL ? 'These jobs were set before pay could be set campus by campus. They still apply to every campus that has no job of its own.' : 'The jobs at this campus, what each pays, and who takes the final call.') : 'Add each kind of teaching job and what it pays.'}
            />

            {/* 3 (set once per campus, shown first because it is one choice) */}
            {multi && current !== ALL && (
              <div className="mb-5 rounded-2xl bg-slate-50 border border-slate-200 p-4">
                <label className="block text-sm font-semibold text-slate-900">Who takes the final call at {campusName}?
                  <select
                    value={campusDeciders[current] ?? ''}
                    onChange={(e) => { setCampusDeciders((d) => ({ ...d, [current]: e.target.value })); setDirty(true); }}
                    className={`${selectClass} mt-2 block w-full sm:w-96`}
                  >
                    <option value="">The school admin (you)</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role_name}</option>)}
                  </select>
                </label>
                <p className="mt-2 text-sm text-slate-500">Usually the Principal of this campus. They see the pay range on the teacher’s report and make the offer. You can pick someone else for a single job later.</p>
              </div>
            )}

            {jobs.length === 0 ? (
              <EmptyState
                Icon={Wallet}
                title={multi ? `No jobs at ${campusName} yet` : 'No jobs yet'}
                description="The fastest way: start from the usual stages of a school, then just type the pay for each."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => setImporting(true)} className={buttonClass('primary')}><UploadCloud className="w-4 h-4" /> Bring in my pay sheet (Excel or PDF)</button>
                    <button type="button" onClick={startWithUsual} className={buttonClass('secondary')}><Sparkles className="w-4 h-4" /> Start with the usual stages</button>
                    <button type="button" onClick={addJob} className={buttonClass('secondary')}><Plus className="w-4 h-4" /> Add one job myself</button>
                    {multi && otherCampuses.map((b) => (
                      <button key={b.id} type="button" onClick={() => copyFrom(b.id)} className={buttonClass('secondary')}><Copy className="w-4 h-4" /> Copy jobs from {b.name}</button>
                    ))}
                  </div>
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
                    {([['jobs', 'Jobs', Pencil], ['table', 'Quick pay table', Table2]] as const).map(([k, label, Icon]) => (
                      <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => { setView(k); setEditing(null); }} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold cursor-pointer ${view === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                  </div>
                  {here.left > 0 && <p className="flex items-center gap-1.5 text-sm text-amber-800"><AlertCircle className="w-4 h-4" /> {here.left} {here.left === 1 ? 'job still needs' : 'jobs still need'} its pay</p>}
                  {here.left === 0 && here.count > 0 && <p className="flex items-center gap-1.5 text-sm text-emerald-800"><CheckCircle2 className="w-4 h-4" /> Every job here has its pay</p>}
                </div>

                {view === 'table' ? (
                  sharesLevels(jobs) ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-600">Type the <strong>usual pay a month</strong> for each job and level. We fill in a lowest and highest around it. Open a job to change those or to add extras.</p>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="py-2.5 px-3 font-semibold">Job</th>
                              {jobs[0].tiers.map((t, i) => <th key={i} className="py-2.5 px-3 font-semibold whitespace-nowrap">{levelLabel(t)}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {jobs.map((r) => (
                              <tr key={r.key}>
                                <td className="py-2.5 px-3 min-w-[12rem]">
                                  <button type="button" onClick={() => { setView('jobs'); setEditing(r.key); }} className="text-left cursor-pointer">
                                    <span className="block font-semibold text-slate-900">{displayName(r)}</span>
                                    <span className="block text-xs text-slate-500">{gradeSummary(r.grades)}</span>
                                  </button>
                                </td>
                                {r.tiers.map((t, i) => (
                                  <td key={i} className="py-2 px-3">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                                      <input
                                        type="number"
                                        min={0}
                                        value={t.ideal}
                                        onChange={(e) => update(r.key, { ...r, tiers: r.tiers.map((x, at) => (at === i ? setUsual(x, e.target.value) : x)) })}
                                        aria-label={`${displayName(r)}, ${levelLabel(t)}, usual pay a month`}
                                        placeholder="Pay"
                                        className="w-28 pl-6 pr-2 py-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                      />
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 rounded-xl bg-slate-50 border border-slate-200 p-4">The quick table needs every job to use the same levels of experience. Some of these were changed, so open each job to edit it.</p>
                  )
                ) : (
                  <ul className="space-y-3">
                    {jobs.map((r) => {
                      if (editing === r.key) {
                        return (
                          <li key={r.key}>
                            <JobEditor
                              role={r}
                              subjects={subjects}
                              people={people}
                              campusName={campusName}
                              campusDecider={multi ? deciderFor(r.branch) : 'the school admin'}
                              pot={r.id ? pots[r.id] ?? null : null}
                              onChange={(next) => update(r.key, next)}
                              onDone={() => setEditing(null)}
                              onRemove={() => remove(r.key)}
                            />
                          </li>
                        );
                      }
                      const problems = problemsOf(r);
                      const ready = problems.length === 0;
                      const pot = r.id ? pots[r.id] : null;
                      const decider = r.decider ? people.find((p) => p.id === r.decider)?.name : multi ? deciderFor(r.branch) : 'the school admin';
                      return (
                        <li key={r.key} className={`rounded-2xl border p-4 sm:p-5 ${ready ? 'border-slate-200 bg-white' : 'border-amber-300 bg-amber-50/40'}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <button type="button" onClick={() => setEditing(r.key)} className="text-left min-w-0 flex-1 cursor-pointer">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-semibold text-slate-900">{displayName(r)}</span>
                                {ready ? <Badge tone="emerald">Ready</Badge> : <Badge tone="amber">Needs {problems[0].startsWith('Fill in') ? 'pay' : 'a look'}</Badge>}
                              </span>
                              <span className="mt-1 block text-sm text-slate-600">
                                {gradeSummary(r.grades)} · {r.subjects.length ? r.subjects.join(', ') : 'every subject'}
                              </span>
                              <span className="mt-1 block text-sm text-slate-800 font-medium tabular-nums">{payRangeText(r)}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {r.tiers.length} {r.tiers.length === 1 ? 'level' : 'levels'} of experience · {decider} takes the final call
                                {pot ? ` · ${pot.filled} of ${pot.positions} posts filled, ${inr(pot.left_monthly)} left` : ''}
                              </span>
                              {!ready && <span className="mt-1.5 block text-sm text-amber-900">{problems[0]}</span>}
                            </button>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setEditing(r.key)} className={buttonClass('secondary', 'sm')}><Pencil className="w-4 h-4" /> Edit</button>
                              <button type="button" onClick={() => duplicate(r)} aria-label={`Copy ${displayName(r)}`} title="Make a copy" className={buttonClass('ghost', 'sm')}><Copy className="w-4 h-4" /></button>
                              <button type="button" onClick={() => { if (window.confirm(`Remove “${displayName(r)}”?`)) remove(r.key); }} aria-label={`Remove ${displayName(r)}`} className={buttonClass('ghost', 'sm')}><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={addJob} className={buttonClass('secondary', 'sm')}><Plus className="w-4 h-4" /> Add another job</button>
                  <button type="button" onClick={() => setImporting(true)} className={buttonClass('secondary', 'sm')}><UploadCloud className="w-4 h-4" /> Bring in a pay sheet</button>
                </div>
              </div>
            )}
          </Card>

          {/* Next campus nudge */}
          {multi && here.count > 0 && here.left === 0 && (() => {
            const next = branches.find((b) => b.id !== current && campusStatus(b.id).count === 0);
            return next ? (
              <button type="button" onClick={() => { setCampus(next.id); setEditing(null); setView('jobs'); }} className="w-full flex items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-left hover:bg-indigo-100/70 cursor-pointer">
                <span className="text-sm text-indigo-950"><strong className="font-semibold">{campusName} is ready.</strong> Next: set up {next.name}. You can copy these jobs across and change the pay.</span>
                <ChevronRight className="w-5 h-5 text-indigo-700 shrink-0" />
              </button>
            ) : null;
          })()}

          {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
          <SaveBar onSave={() => void save()} saving={saving} dirty={dirty} label="Save the Pay Guide" />
          {importing && (
            <PayGuideImport
              schoolId={schoolId}
              campusId={multi ? current : ALL}
              campusName={campusName}
              hasJobsHere={jobs.length > 0}
              onApply={applyImport}
              onClose={() => setImporting(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
