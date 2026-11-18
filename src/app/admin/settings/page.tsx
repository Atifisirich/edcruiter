'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, MapPin, Plus, Trash2 } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, PageHeader, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import type { ReviewRound, RoleDef } from '@/lib/types';
import { accessOf } from '@/lib/permissions';
import { DEFAULT_SHORTLIST_BANDS, normalizeBands, type ShortlistBand } from '@/lib/shortlistBands';
import { reportSettingsOf } from '@/lib/teachingProfile';
import ScreeningCallSettingsCard from '@/components/admin/ScreeningCallSettingsCard';

const BAND_STYLE: Record<ShortlistBand['tone'], { box: string; name: string }> = {
  danger: { box: 'border-rose-200 bg-rose-50/60', name: 'Needs work' },
  warning: { box: 'border-amber-200 bg-amber-50/60', name: 'Borderline' },
  success: { box: 'border-emerald-200 bg-emerald-50/60', name: 'Strong' },
};

/** Returns a plain-language problem with the bands, or null when they are fine. */
function bandProblem(bands: ShortlistBand[]): string | null {
  for (const b of bands) {
    if (!Number.isFinite(b.min) || !Number.isFinite(b.max) || b.min < 0 || b.max > 100) return 'Scores must be between 0 and 100.';
    if (b.min > b.max) return 'In each colour, the first number must not be higher than the second.';
  }
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min <= sorted[i - 1].max) return 'The colours must not overlap.';
  }
  return null;
}

interface Level { level: RoleDef['level']; label: string; help: string }

/** The school's own role names. Each one sits on one of the five seat types (seats.ts). */
function RolesCard() {
  const { schoolId, toast } = useAdmin();
  const [roles, setRoles] = useState<RoleDef[] | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [max, setMax] = useState(25);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/roles?school_id=${schoolId}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setRoles(data.roles);
        setLevels(data.levels);
        setMax(data.max);
      } catch { /* the card stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  const update = (id: string, patch: Partial<RoleDef>) => {
    setRoles((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...patch } : r)) : rs));
    setDirty(true);
  };
  const add = () => {
    setRoles((rs) => [...(rs ?? []), { id: `new_${Date.now()}`, name: '', level: 'REPORTING_MANAGER' }]);
    setDirty(true);
  };
  const remove = (id: string) => {
    setRoles((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));
    setDirty(true);
  };

  const save = async () => {
    if (!roles) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/roles?school_id=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // A role added here has a temporary id; the server gives it a real one.
        body: JSON.stringify({ roles: roles.map((r) => (r.id.startsWith('new_') ? { name: r.name, level: r.level } : r)) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Could not save the roles.', 'error');
        return;
      }
      setRoles(data.roles);
      setDirty(false);
      toast('Role names saved.', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Role names"
        description="Names only, not people. Give roles your school's own names, such as Maths Coordinator or Vice Principal, and choose which seat each one uses. How many people you can have of each seat is shown on the Team page."
        action={
          <button type="button" onClick={save} disabled={saving || !dirty} className={buttonClass('primary', 'sm')}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />
      {!roles ? (
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="space-y-3">
          {roles.map((r) => (
            <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[1fr_16rem_auto] gap-2 items-center">
              <input
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                placeholder="e.g. Science HOD"
                aria-label="Role name"
                maxLength={40}
                className={inputClass}
              />
              <select
                value={r.level}
                onChange={(e) => update(r.id, { level: e.target.value as RoleDef['level'] })}
                aria-label="Seat type"
                className={`${selectClass} w-full`}
              >
                {levels.map((l) => <option key={l.level} value={l.level}>{l.label}</option>)}
              </select>
              <button type="button" onClick={() => remove(r.id)} aria-label={`Remove ${r.name || 'role'}`} className={buttonClass('ghost', 'sm')}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button type="button" onClick={add} disabled={roles.length >= max} className={buttonClass('secondary', 'sm')}>
              <Plus className="w-4 h-4" /> Add a role
            </button>
            <p className="text-sm text-slate-500">{roles.length} of {max} role names (names, not people)</p>
          </div>
          <p className="text-sm text-slate-500">
            {levels.map((l) => (
              <span key={l.level} className="block"><strong className="text-slate-700">{l.label}:</strong> {l.help}</span>
            ))}
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * The review rounds after the shortlist: their names, their order, and which
 * roles give the yes or no in each. The last round is the final decision.
 */
function RoundsCard() {
  const { schoolId, toast } = useAdmin();
  const [rounds, setRounds] = useState<ReviewRound[] | null>(null);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [max, setMax] = useState(6);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/review-rounds?school_id=${schoolId}`);
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setRounds(data.rounds);
        setRoles(data.roles);
        setMax(data.max);
      } catch { /* the card stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  const reviewerRoles = roles.filter((r) => accessOf(r.level) === 'reviewer');

  const change = (next: ReviewRound[]) => { setRounds(next); setDirty(true); };
  const update = (id: string, patch: Partial<ReviewRound>) => rounds && change(rounds.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toggleRole = (round: ReviewRound, roleId: string) =>
    update(round.id, { role_ids: round.role_ids.includes(roleId) ? round.role_ids.filter((x) => x !== roleId) : [...round.role_ids, roleId] });
  const move = (index: number, by: -1 | 1) => {
    if (!rounds) return;
    const next = [...rounds];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    change(next);
  };

  const save = async () => {
    if (!rounds) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/review-rounds?school_id=${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // A round added here has a temporary id; the server gives it a real one.
        body: JSON.stringify({ rounds: rounds.map((r) => (r.id.startsWith('new_') ? { name: r.name, role_ids: r.role_ids } : r)) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Could not save the review rounds.', 'error');
        return;
      }
      setRounds(data.rounds);
      setDirty(false);
      toast('Review rounds saved.', 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Review rounds"
        description="After HR shortlists a teacher, they go through these rounds in order. In each round, the roles you tick give their yes or no with their opinion. The last round is the final decision."
        action={
          <button type="button" onClick={save} disabled={saving || !dirty} className={buttonClass('primary', 'sm')}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        }
      />
      {!rounds ? (
        <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
      ) : (
        <div className="space-y-3">
          {reviewerRoles.length === 0 && (
            <p className="text-sm text-amber-700">No role has reviewer access yet. Add one under Role names first.</p>
          )}
          {rounds.map((r, i) => (
            <div key={r.id} className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <input
                  value={r.name}
                  onChange={(e) => update(r.id, { name: e.target.value })}
                  placeholder="e.g. Subject lead"
                  aria-label={`Round ${i + 1} name`}
                  maxLength={40}
                  className={`${inputClass} flex-1 min-w-[10rem]`}
                />
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className={buttonClass('ghost', 'sm')}>↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === rounds.length - 1} aria-label="Move later" className={buttonClass('ghost', 'sm')}>↓</button>
                  <button type="button" onClick={() => change(rounds.filter((x) => x.id !== r.id))} disabled={rounds.length === 1} aria-label={`Remove ${r.name || 'round'}`} className={buttonClass('ghost', 'sm')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <fieldset>
                <legend className="text-sm text-slate-500 mb-1.5">
                  Who gives the yes or no{i === rounds.length - 1 ? ' (final decision)' : ''}:
                </legend>
                <div className="flex flex-wrap gap-2">
                  {reviewerRoles.map((role) => (
                    <label key={role.id} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${r.role_ids.includes(role.id) ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600'}`}>
                      <input type="checkbox" checked={r.role_ids.includes(role.id)} onChange={() => toggleRole(r, role.id)} className="accent-indigo-600" />
                      {role.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => change([...rounds, { id: `new_${Date.now()}`, name: '', role_ids: [] }])}
              disabled={rounds.length >= max}
              className={buttonClass('secondary', 'sm')}
            >
              <Plus className="w-4 h-4" /> Add a round
            </button>
            <p className="text-sm text-slate-500">{rounds.length} of {max} rounds</p>
          </div>
          <p className="text-sm text-slate-500">The school admin can always give the yes or no in any round. Teachers already part-way through keep the rounds they have cleared.</p>
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const { school, schoolId, setSchool, toast } = useAdmin();

  // Edits are kept until saved; nothing is copied from the school into state in an effect.
  const [draft, setDraft] = useState<ShortlistBand[] | null>(null);
  const bands = draft ?? normalizeBands(school?.shortlist_bands);
  const [savingBands, setSavingBands] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const report = reportSettingsOf(school?.report_settings);

  const save = async (updates: Record<string, unknown>) => {
    const res = await fetch('/api/schools', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: school?.id || schoolId, updates }),
    });
    const data = await res.json();
    if (!res.ok || !data.school) throw new Error(data.error || 'Could not save');
    setSchool(data.school);
  };

  const saveBands = async () => {
    const problem = bandProblem(bands);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setSavingBands(true);
    try {
      await save({ shortlist_bands: normalizeBands(bands) });
      setDraft(null);
      toast('Score colours saved.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSavingBands(false);
    }
  };

  const saveReport = async (next: { delivery: boolean; appearance: boolean }) => {
    setSavingReport(true);
    try {
      await save({ report_settings: { delivery_observations: next.delivery, appearance_observations: next.appearance } });
      toast('Report settings saved.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSavingReport(false);
    }
  };

  const setBand = (key: ShortlistBand['key'], field: 'min' | 'max', value: string) =>
    setDraft(bands.map((b) => (b.key === key ? { ...b, [field]: value === '' ? NaN : Number(value) } : b)));

  const dirty = draft !== null;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="How your school’s reports and scores look." />

      <Card>
        <CardHeader title="Your school" description="Set when your school was created." />
        <div className="flex items-center gap-3 mb-4">
          <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
          <div>
            <p className="font-semibold text-slate-900">{school?.name || 'Your school'}</p>
            <p className="text-sm text-slate-500">{school?.curricula?.length ? school.curricula.join(' · ') : 'No boards listed'}</p>
          </div>
        </div>
        {school?.branches?.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {school.branches.map((b) => (
              <li key={b.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800">{b.name}</span>
                {b.location && <span className="text-slate-500 truncate">· {b.location}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No campuses are set up yet.</p>
        )}
        <p className="mt-4 text-sm text-slate-500">
          Need to change a campus or board? Write to{' '}
          <a href="mailto:edcruiterofficial@gmail.com" className="font-semibold text-indigo-600 hover:underline">edcruiterofficial@gmail.com</a>.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Score colours"
          description="Candidates are shown in a colour by their AI score. Set where each colour starts and ends."
          action={
            <div className="flex gap-2">
              {dirty && (
                <button type="button" onClick={() => setDraft(null)} className={buttonClass('ghost', 'sm')}>Undo</button>
              )}
              <button type="button" onClick={() => setDraft(DEFAULT_SHORTLIST_BANDS.map((b) => ({ ...b })))} className={buttonClass('secondary', 'sm')}>Use the standard</button>
              <button type="button" onClick={saveBands} disabled={savingBands || !dirty} className={buttonClass('primary', 'sm')}>
                {savingBands ? 'Saving…' : 'Save'}
              </button>
            </div>
          }
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {bands.map((b) => (
            <div key={b.key} className={`rounded-xl border p-4 space-y-3 ${BAND_STYLE[b.tone].box}`}>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={b.tone === 'danger' ? 'rose' : b.tone === 'warning' ? 'amber' : 'emerald'}>{BAND_STYLE[b.tone].name}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="number" min={0} max={100} aria-label={`${BAND_STYLE[b.tone].name} from`}
                  value={Number.isFinite(b.min) ? b.min : ''}
                  onChange={(e) => setBand(b.key, 'min', e.target.value)}
                  className="w-20 px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
                <span>to</span>
                <input
                  type="number" min={0} max={100} aria-label={`${BAND_STYLE[b.tone].name} to`}
                  value={Number.isFinite(b.max) ? b.max : ''}
                  onChange={(e) => setBand(b.key, 'max', e.target.value)}
                  className="w-20 px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Candidate reports"
          description="Choose which video impressions appear in each candidate’s report. They are indicative only and never change the overall score."
        />
        <div className="space-y-4">
          {([
            ['delivery', 'Delivery on video', 'Eye contact, body language, facial expression, energy and voice. On by default.'],
            ['appearance', 'Presentation on video', 'Attire and grooming (neat and classroom-suitable). Religious and cultural dress is never marked down. Off by default.'],
          ] as const).map(([key, title, help]) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={report[key]}
                disabled={savingReport}
                onChange={(e) => void saveReport({ ...report, [key]: e.target.checked })}
                className="mt-1 w-4 h-4 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{title}</span>
                <span className="block text-sm text-slate-500">{help}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-400">Applies to profiles written from now on. Use Refresh on a candidate to rewrite an existing one.</p>
      </Card>

      <ScreeningCallSettingsCard />

      <RolesCard />

      <RoundsCard />

      <Card>
        <CardHeader title="More" />
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm font-medium">
          {[
            { href: '/admin/team', label: 'Your team' },
            { href: '/admin/policies', label: 'School policies' },
            { href: '/admin/whatsapp', label: 'WhatsApp number' },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="block rounded-xl border border-slate-200 px-4 py-3 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                {l.label} →
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
