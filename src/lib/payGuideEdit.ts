/**
 * The Pay Guide as the admin edits it on screen: every box is text until it is
 * saved, a new job starts with sensible levels, typing one "usual" pay fills the
 * lowest and highest, and each job says plainly what it still needs. Pure, so it
 * is tested without a page.
 */

import { GRADES } from './grades';
import { suggestRoleName, TYPICAL_JOBS } from './payGuide';
import type { PayRole, PayTier } from './types';

export interface EditTier {
  id?: string;
  from: string;
  /** Empty means "and above". */
  to: string;
  min: string;
  ideal: string;
  max: string;
  /** The lowest and highest follow the usual pay until the admin changes one of them. */
  auto: boolean;
}

export interface EditRole {
  key: string;
  id?: string;
  /** The campus (branch id). Empty means every campus. */
  branch: string;
  name: string;
  grades: string[];
  subjects: string[];
  decider: string;
  tiers: EditTier[];
  bed: string;
  masters: string;
  positions: string;
  budget: string;
}

let counter = 0;
export const newKey = () => `k${Date.now().toString(36)}${counter++}`;

const to500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

/** From one "usual" pay: a little below, and a little above. */
export function autoRange(usual: number): { min: number; max: number } {
  return { min: to500(usual * 0.9), max: to500(usual * 1.15) };
}

/** The usual stretches of experience: a fresher, someone with a few years, someone experienced. */
export function defaultTiers(): EditTier[] {
  return [
    { from: '0', to: '2', min: '', ideal: '', max: '', auto: true },
    { from: '2', to: '5', min: '', ideal: '', max: '', auto: true },
    { from: '5', to: '', min: '', ideal: '', max: '', auto: true },
  ];
}

export function blankRole(branch = ''): EditRole {
  return { key: newKey(), branch, name: '', grades: [], subjects: [], decider: '', tiers: defaultTiers(), bed: '', masters: '', positions: '', budget: '' };
}

const fromTier = (t: PayTier): EditTier => ({
  id: t.id, from: String(t.from_years), to: t.to_years === null ? '' : String(t.to_years),
  min: String(t.min), ideal: String(t.ideal), max: String(t.max), auto: false,
});

export function fromServer(r: PayRole): EditRole {
  return {
    key: newKey(), id: r.id, branch: r.branch_id ?? '', name: r.name, grades: r.grades, subjects: r.subjects, decider: r.decider_user_id ?? '',
    tiers: r.tiers.map(fromTier),
    bed: r.bed_topup ? String(r.bed_topup) : '', masters: r.masters_topup ? String(r.masters_topup) : '',
    positions: r.pot ? String(r.pot.positions) : '', budget: r.pot ? String(r.pot.monthly_budget) : '',
  };
}

/** The job's own name, or one made from what it covers. */
export const displayName = (r: Pick<EditRole, 'name' | 'grades' | 'subjects'>): string => r.name.trim() || suggestRoleName(r.grades, r.subjects);

export function toServer(r: EditRole) {
  return {
    id: r.id,
    name: displayName(r),
    branch_id: r.branch || undefined,
    grades: r.grades,
    subjects: r.subjects,
    decider_user_id: r.decider || undefined,
    tiers: r.tiers.map((t) => ({ id: t.id, from_years: Number(t.from), to_years: t.to === '' ? null : Number(t.to), min: Number(t.min), ideal: Number(t.ideal), max: Number(t.max) })),
    bed_topup: r.bed ? Number(r.bed) : undefined,
    masters_topup: r.masters ? Number(r.masters) : undefined,
    pot: r.positions || r.budget ? { positions: Number(r.positions), monthly_budget: Number(r.budget) } : undefined,
  };
}

/** "Fresher · 0 to 2 years" style names for each level, in plain words. */
export function levelLabel(t: Pick<EditTier, 'from' | 'to'>): string {
  const from = Number(t.from);
  if (t.to === '') return `${from} years and above`;
  return from === 0 ? `Under ${t.to} years` : `${from} to ${t.to} years`;
}

/** The usual pay was typed: it becomes the ideal, and the lowest and highest follow it until the admin sets them. */
export function setUsual(t: EditTier, value: string): EditTier {
  const usual = Number(value);
  if (!t.auto || !Number.isFinite(usual) || usual <= 0) return { ...t, ideal: value };
  const r = autoRange(usual);
  return { ...t, ideal: value, min: String(r.min), max: String(r.max) };
}

/** Changing the lowest or highest takes them off automatic. */
export const setEdge = (t: EditTier, edge: 'min' | 'max', value: string): EditTier => ({ ...t, [edge]: value, auto: false });

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** What this job still needs before it can be saved, in plain words. Empty means it is ready. */
export function problemsOf(r: EditRole): string[] {
  const out: string[] = [];
  if (r.grades.length === 0) out.push('Choose the grades this job teaches.');
  if (displayName(r).length > 60) out.push('The job name is too long (60 characters at most).');

  const tiers = r.tiers;
  tiers.forEach((t) => {
    const label = levelLabel(t);
    const [min, ideal, max] = [num(t.min), num(t.ideal), num(t.max)];
    if (![min, ideal, max].every(Number.isFinite)) out.push(`Fill in the pay for ${label}.`);
    else if (!(min <= ideal && ideal <= max)) out.push(`For ${label}, the lowest must be under the usual pay, and the usual pay under the highest.`);
    else if (min < 1000 || max > 1_000_000) out.push(`For ${label}, pay is rupees a month, between ₹1,000 and ₹10,00,000.`);
  });

  const years = tiers.map((t) => ({ from: Number(t.from), to: t.to === '' ? Infinity : Number(t.to) })).sort((a, b) => a.from - b.from);
  for (let i = 1; i < years.length; i++) {
    if (years[i - 1].to === Infinity) out.push('Only the last level can be "and above".');
    else if (years[i].from < years[i - 1].to) out.push('Two experience levels overlap. Change the years.');
  }
  if ((r.positions && !r.budget) || (!r.positions && r.budget)) out.push('For the budget, fill in both the number of posts and the most you can spend a month.');
  return out;
}

export const isComplete = (r: EditRole): boolean => problemsOf(r).length === 0;

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** One line for the card: the lowest and highest pay across all the levels. */
export function payRangeText(r: EditRole): string {
  const mins = r.tiers.map((t) => num(t.min)).filter(Number.isFinite);
  const maxs = r.tiers.map((t) => num(t.max)).filter(Number.isFinite);
  if (!mins.length || !maxs.length) return 'No pay set yet';
  return `${rupees(Math.min(...mins))} to ${rupees(Math.max(...maxs))} a month`;
}

export interface Preview { level: string; min: number; ideal: number; max: number; topup: number }

/** What the decision-maker would see for a teacher with this much experience and these degrees. Null if the pay is not filled in. */
export function previewRange(r: EditRole, years: number, bed: boolean, masters: boolean): Preview | null {
  const ready = r.tiers.filter((t) => [num(t.min), num(t.ideal), num(t.max)].every(Number.isFinite));
  if (ready.length === 0) return null;
  const sorted = [...ready].sort((a, b) => Number(a.from) - Number(b.from));
  const tier = [...sorted].reverse().find((t) => Number(t.from) <= years && (t.to === '' || years < Number(t.to))) ?? sorted[0];
  const topup = (bed ? Number(r.bed) || 0 : 0) + (masters ? Number(r.masters) || 0 : 0);
  return { level: levelLabel(tier), min: num(tier.min) + topup, ideal: num(tier.ideal) + topup, max: num(tier.max) + topup, topup };
}

/** A copy of a job for another campus (or the same one), without the saved ids, so it is a new job. */
export function copyRole(r: EditRole, branch: string, name?: string): EditRole {
  return { ...r, key: newKey(), id: undefined, branch, decider: branch === r.branch ? r.decider : '', name: name ?? r.name, tiers: r.tiers.map((t) => ({ ...t, id: undefined })) };
}

/** The usual stages of a school as jobs for one campus, with the pay still to fill in. */
export function typicalRoles(branch: string): EditRole[] {
  return TYPICAL_JOBS.map((j) => ({ ...blankRole(branch), name: j.name, grades: j.grades.filter((g) => GRADES.some((x) => x.id === g)) }));
}

/** Does every job in this list use the same experience levels? Then they can be filled in as one table. */
export function sharesLevels(roles: EditRole[]): boolean {
  if (roles.length === 0) return false;
  const shape = (r: EditRole) => r.tiers.map((t) => `${t.from}-${t.to}`).join('|');
  return roles.every((r) => shape(r) === shape(roles[0]));
}
