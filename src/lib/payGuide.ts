/**
 * The Pay Guide: what management tells the final decision-maker they may offer.
 *
 * Management defines job roles by grades (and, if they want, subjects). Each
 * role has experience tiers with a minimum, ideal and maximum monthly gross
 * salary, optional top-ups for a B.Ed or a master's degree, optional ranges
 * for one campus, a named decision-maker, and a pot (how many posts and how
 * much a month in total). A candidate is matched to a role from the grades and
 * subject they applied for; the decision-maker then offers a figure, and an
 * offer above the range or the pot waits for the school admin.
 *
 * All pure, so the rules are tested without a page or a server.
 */

import { cleanGrades, gradesFromSegment, GRADES } from './grades';
import { normalizeSubject } from './subjectMatch';
import { credentialsFromCandidate } from './credentials';
import { hasMastersCredential } from './hiringRequirements';
import type { Candidate, PayGuide, PayRole, PayTier } from './types';

export const MAX_ROLES = 30;
export const MAX_TIERS = 8;
export const MIN_MONTHLY = 1_000;
export const MAX_MONTHLY = 1_000_000;

const newId = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------------
// Checking what the admin saved
// ---------------------------------------------------------------------------

export interface GuideContext {
  subjects: string[];
  branchIds: string[];
  /** Ids of the people who may take a final call. */
  deciderIds: string[];
}

function money(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= MIN_MONTHLY && n <= MAX_MONTHLY ? n : null;
}

function cleanTiers(input: unknown, where: string): { ok: true; tiers: PayTier[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: `${where}: add at least one experience tier.` };
  if (input.length > MAX_TIERS) return { ok: false, error: `${where}: up to ${MAX_TIERS} tiers.` };
  const tiers: PayTier[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const from = Number(raw?.from_years);
    const toRaw = raw?.to_years;
    const to = toRaw === null || toRaw === undefined || toRaw === '' ? null : Number(toRaw);
    if (!Number.isFinite(from) || from < 0 || from > 50) return { ok: false, error: `${where}: each tier needs a starting number of years.` };
    if (to !== null && (!Number.isFinite(to) || to <= from || to > 60)) return { ok: false, error: `${where}: a tier must end after it starts.` };
    const min = money(raw?.min);
    const ideal = money(raw?.ideal);
    const max = money(raw?.max);
    if (min === null || ideal === null || max === null) return { ok: false, error: `${where}: pay must be rupees a month, between ₹${MIN_MONTHLY.toLocaleString('en-IN')} and ₹${MAX_MONTHLY.toLocaleString('en-IN')}.` };
    if (!(min <= ideal && ideal <= max)) return { ok: false, error: `${where}: the minimum, ideal and maximum must go up in that order.` };
    const label = to === null ? `${from}+ years` : `${from} to ${to} years`;
    tiers.push({ id: typeof raw?.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(raw.id) ? raw.id : newId('tier'), from_years: from, to_years: to, min, ideal, max, label });
  }
  tiers.sort((a, b) => a.from_years - b.from_years);
  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1];
    if (prev.to_years === null) return { ok: false, error: `${where}: only the last tier can be open-ended ("and above").` };
    if (tiers[i].from_years < prev.to_years) return { ok: false, error: `${where}: the tiers "${prev.label}" and "${tiers[i].label}" overlap.` };
  }
  return { ok: true, tiers };
}

/** Checks the admin's Pay Guide before it is saved. Returns the cleaned guide, or a plain-language reason. */
export function parsePayGuide(input: unknown, ctx: GuideContext): { ok: true; guide: PayGuide } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as { roles?: unknown; campus_deciders?: unknown };
  if (!Array.isArray(raw.roles)) return { ok: false, error: 'The Pay Guide was not in the right form.' };
  if (raw.roles.length > MAX_ROLES) return { ok: false, error: `A school can have up to ${MAX_ROLES} pay roles.` };

  const gradeIds = new Set(GRADES.map((g) => g.id));
  const subjectSet = new Set(ctx.subjects.map((s) => s.toLowerCase()));
  const roles: PayRole[] = [];
  const names = new Set<string>();

  for (const r of raw.roles as Record<string, unknown>[]) {
    const name = typeof r?.name === 'string' ? r.name.replace(/\s+/g, ' ').trim() : '';
    if (name.length < 2 || name.length > 60) return { ok: false, error: 'Each role needs a name of 2 to 60 characters.' };
    if (/[<>]/.test(name)) return { ok: false, error: 'Role names cannot contain < or >.' };
    const branchId = typeof r?.branch_id === 'string' && r.branch_id ? r.branch_id : undefined;
    if (branchId && !ctx.branchIds.includes(branchId)) return { ok: false, error: `${name}: that campus was not found.` };
    const nameKey = `${branchId ?? ''}|${name.toLowerCase()}`;
    if (names.has(nameKey)) return { ok: false, error: `You have two jobs called "${name}"${branchId ? ' at the same campus' : ''}.` };
    names.add(nameKey);

    const grades = cleanGrades(r?.grades);
    if (grades.length === 0 || !grades.every((g) => gradeIds.has(g))) return { ok: false, error: `${name}: choose the grades this role teaches.` };

    const subjects = (Array.isArray(r?.subjects) ? (r.subjects as unknown[]) : [])
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim())
      .filter((s, i, all) => all.findIndex((x) => x.toLowerCase() === s.toLowerCase()) === i);
    if (subjects.some((s) => !subjectSet.has(s.toLowerCase()))) return { ok: false, error: `${name}: choose subjects from your school's list.` };

    const base = cleanTiers(r?.tiers, name);
    if (!base.ok) return base;

    const branchTiers: Record<string, PayTier[]> = {};
    const bt = (r?.branch_tiers && typeof r.branch_tiers === 'object' ? r.branch_tiers : {}) as Record<string, unknown>;
    for (const [branchId, tiers] of Object.entries(bt)) {
      if (!ctx.branchIds.includes(branchId)) return { ok: false, error: `${name}: that campus was not found.` };
      if (Array.isArray(tiers) && tiers.length === 0) continue;
      const cleaned = cleanTiers(tiers, `${name} (campus)`);
      if (!cleaned.ok) return cleaned;
      branchTiers[branchId] = cleaned.tiers;
    }

    const topup = (v: unknown): number | undefined => {
      if (v === undefined || v === null || v === '' || Number(v) === 0) return undefined;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n <= MAX_MONTHLY ? n : NaN;
    };
    const bed = topup(r?.bed_topup);
    const masters = topup(r?.masters_topup);
    if (Number.isNaN(bed) || Number.isNaN(masters)) return { ok: false, error: `${name}: a top-up must be a rupee amount a month.` };

    let pot: PayRole['pot'];
    const p = r?.pot as Record<string, unknown> | undefined;
    if (p && (p.positions || p.monthly_budget)) {
      const positions = Math.round(Number(p.positions));
      const budget = Math.round(Number(p.monthly_budget));
      if (!Number.isFinite(positions) || positions < 1 || positions > 500) return { ok: false, error: `${name}: the number of posts must be 1 or more.` };
      if (!Number.isFinite(budget) || budget < MIN_MONTHLY || budget > 100_000_000) return { ok: false, error: `${name}: the monthly budget must be a rupee amount.` };
      pot = { positions, monthly_budget: budget };
    }

    const decider = typeof r?.decider_user_id === 'string' && r.decider_user_id ? r.decider_user_id : undefined;
    if (decider && !ctx.deciderIds.includes(decider)) return { ok: false, error: `${name}: the decision-maker must be a reviewer or the school admin.` };

    roles.push({
      id: typeof r?.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(r.id) ? r.id : newId('role'),
      name, grades, subjects, tiers: base.tiers,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(Object.keys(branchTiers).length ? { branch_tiers: branchTiers } : {}),
      ...(bed ? { bed_topup: bed } : {}),
      ...(masters ? { masters_topup: masters } : {}),
      ...(decider ? { decider_user_id: decider } : {}),
      ...(pot ? { pot } : {}),
    });
  }
  // Who decides at each campus unless a job names someone else.
  const campus_deciders: Record<string, string> = {};
  const cd = (raw.campus_deciders && typeof raw.campus_deciders === 'object' ? raw.campus_deciders : {}) as Record<string, unknown>;
  for (const [branchId, userId] of Object.entries(cd)) {
    if (!userId) continue;
    if (!ctx.branchIds.includes(branchId)) return { ok: false, error: 'A campus decision-maker was set for a campus that was not found.' };
    if (typeof userId !== 'string' || !ctx.deciderIds.includes(userId)) return { ok: false, error: 'The decision-maker for a campus must be a reviewer or the school admin.' };
    campus_deciders[branchId] = userId;
  }
  return { ok: true, guide: { roles, ...(Object.keys(campus_deciders).length ? { campus_deciders } : {}) } };
}

// ---------------------------------------------------------------------------
// Matching a candidate to a role
// ---------------------------------------------------------------------------

/** The grades a candidate applied for. */
function gradesOf(c: Pick<Candidate, 'applied_grades' | 'applied_segment'>): string[] {
  const own = cleanGrades(c.applied_grades);
  return own.length ? own : gradesFromSegment(c.applied_segment);
}

/**
 * The role whose grades (and subject, when it names any) fit this candidate. A
 * role that names the subject beats one that covers any subject; after that,
 * the role sharing the most grades wins. Null when nothing fits.
 */
export function matchRole(guide: PayGuide | undefined, c: Pick<Candidate, 'applied_grades' | 'applied_segment' | 'applied_subject'> & { target_branch_id?: string }): PayRole | null {
  if (!guide?.roles.length) return null;
  const grades = gradesOf(c);
  const subject = normalizeSubject(c.applied_subject);
  let best: { role: PayRole; score: number } | null = null;
  for (const role of guide.roles) {
    // A job set for one campus is only for teachers who applied to that campus.
    if (role.branch_id && role.branch_id !== c.target_branch_id) continue;
    const shared = role.grades.filter((g) => grades.includes(g)).length;
    if (shared === 0) continue;
    const named = role.subjects.length > 0;
    if (named && !role.subjects.some((s) => normalizeSubject(s) === subject)) continue;
    // The campus's own job beats a job for every campus; then the one naming the subject; then the most grades shared.
    const score = (role.branch_id ? 5000 : 0) + (named ? 1000 : 0) + shared * 10 - role.grades.length / 100;
    if (!best || score > best.score) best = { role, score };
  }
  return best ? withDecider(guide, best.role) : null;
}

/** The person who takes the final call for a job: the one named on the job, else the one named for its campus. */
export function effectiveDecider(guide: Pick<PayGuide, 'campus_deciders'> | undefined, role: Pick<PayRole, 'decider_user_id' | 'branch_id'>): string | undefined {
  return role.decider_user_id || (role.branch_id ? guide?.campus_deciders?.[role.branch_id] : undefined) || undefined;
}

/** The role with its decision-maker worked out, so everything downstream reads one field. */
export function withDecider(guide: Pick<PayGuide, 'campus_deciders'> | undefined, role: PayRole): PayRole {
  const decider = effectiveDecider(guide, role);
  return decider === role.decider_user_id ? role : { ...role, ...(decider ? { decider_user_id: decider } : {}) };
}

// ---------------------------------------------------------------------------
// Names and starting points, so the admin types as little as possible
// ---------------------------------------------------------------------------

const GRADE_LABEL = new Map(GRADES.map((g) => [g.id, g.label]));

/** "Nursery to UKG", "Grades 1 to 5", "Grades 1, 2 and 5". */
export function gradeSummary(grades: string[]): string {
  const ordered = GRADES.filter((g) => grades.includes(g.id));
  if (ordered.length === 0) return 'No grades';
  const runs: typeof ordered[] = [];
  for (const g of ordered) {
    const run = runs[runs.length - 1];
    if (run && g.order === run[run.length - 1].order + 1) run.push(g); else runs.push([g]);
  }
  const numericAll = ordered.every((g) => /^\d+$/.test(g.id));
  const named = (g: { id: string; label: string }) => (/^\d+$/.test(g.id) && !numericAll ? `Grade ${g.label}` : g.label);
  const parts = runs.map((r) => (r.length === 1 ? named(r[0]) : `${named(r[0])} to ${named(r[r.length - 1])}`));
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return numericAll ? `Grade${ordered.length === 1 ? '' : 's'} ${text}` : text;
}

/** A name for a job from what it covers, for when the admin does not type one. */
export function suggestRoleName(grades: string[], subjects: string[]): string {
  const who = subjects.length === 0 ? 'teacher' : subjects.length <= 2 ? `${subjects.join(' and ')} teacher` : `${subjects.slice(0, 2).join(', ')} and more teacher`;
  return `${gradeSummary(grades)} · ${who}`;
}

/** The usual stages of a school, to start from. The admin only has to fill in the pay. */
export const TYPICAL_JOBS: { name: string; grades: string[] }[] = [
  { name: 'Pre-primary teacher', grades: ['nursery', 'lkg', 'ukg'] },
  { name: 'Primary teacher', grades: ['1', '2', '3', '4', '5'] },
  { name: 'Middle school teacher', grades: ['6', '7', '8'] },
  { name: 'Secondary teacher', grades: ['9', '10'] },
  { name: 'Senior secondary teacher', grades: ['11', '12'] },
];

export function labelOfGrade(id: string): string {
  return GRADE_LABEL.get(id) ?? id;
}

// ---------------------------------------------------------------------------
// Experience, ranges and salary figures
// ---------------------------------------------------------------------------

/** Years of experience, from the CV when it has them, else from the band on the application. */
export function yearsOf(c: Pick<Candidate, 'experience_band' | 'resume_analysis'>): { years: number; source: 'cv' | 'application' } {
  const cv = Number(c.resume_analysis?.total_experience_years);
  if (Number.isFinite(cv) && cv > 0) return { years: Math.round(cv * 10) / 10, source: 'cv' };
  const band = (c.experience_band || '').toLowerCase();
  if (!band || band.includes('fresh')) return { years: 0, source: 'application' };
  const first = band.match(/\d+(\.\d+)?/);
  return { years: first ? Number(first[0]) : 0, source: 'application' };
}

/**
 * A salary somebody typed, as rupees a month. "35000", "35k" and "₹ 30,000/month" are monthly;
 * "8 LPA" and "6 lakh" are yearly. A bare small number is taken as lakhs a year, and says so.
 */
export function parseMonthly(text: string | undefined | null): { monthly: number | null; note?: string } {
  const t = (text || '').toLowerCase().replace(/,/g, '').trim();
  if (!t) return { monthly: null };
  const num = t.match(/\d+(\.\d+)?/);
  if (!num) return { monthly: null };
  const value = Number(num[0]);
  if (!Number.isFinite(value) || value <= 0) return { monthly: null };
  if (/lpa|lakh|lac|\bl\b|per annum|p\.a|annual|yearly|\/\s*year/.test(t)) return { monthly: Math.round((value * 100_000) / 12) };
  if (/\d\s*k\b/.test(t)) return { monthly: Math.round(value * 1000) };
  if (/month|\/\s*m\b|pm\b|p\.m/.test(t)) return { monthly: Math.round(value) };
  if (value >= 1_000_000) return { monthly: Math.round(value / 12), note: 'read as a yearly figure' };
  if (value >= 1_000) return { monthly: Math.round(value) };
  return { monthly: Math.round((value * 100_000) / 12), note: 'read as lakhs a year' };
}

/** The tiers that apply at a campus: its own when the role has set them, else the role's. */
export function tiersFor(role: PayRole, branchId?: string): PayTier[] {
  const own = branchId ? role.branch_tiers?.[branchId] : undefined;
  return own?.length ? own : role.tiers;
}

export interface PayRange {
  tier_id: string;
  tier_label: string;
  min: number;
  ideal: number;
  max: number;
  /** What was added for a B.Ed or master's degree. */
  topup: number;
  topups: { bed: boolean; masters: boolean };
  /** Whether the campus's own tiers were used. */
  campus_specific: boolean;
}

/** The pay range for this candidate in this role: the tier for their years, plus any degree top-ups. */
export function rangeFor(role: PayRole, c: Pick<Candidate, 'experience_band' | 'resume_analysis' | 'qualification' | 'target_branch_id'>): PayRange {
  const { years } = yearsOf(c);
  const tiers = tiersFor(role, c.target_branch_id);
  const tier = [...tiers].reverse().find((t) => t.from_years <= years && (t.to_years === null || years < t.to_years)) ?? tiers[0];
  const degrees = c.resume_analysis?.qualifications_match?.degrees_found;
  const bed = credentialsFromCandidate(c).hasBEd;
  const masters = hasMastersCredential(c.qualification, degrees);
  const topup = (bed ? role.bed_topup ?? 0 : 0) + (masters ? role.masters_topup ?? 0 : 0);
  return {
    tier_id: tier.id,
    tier_label: tier.label ?? (tier.to_years === null ? `${tier.from_years}+ years` : `${tier.from_years} to ${tier.to_years} years`),
    min: tier.min + topup,
    ideal: tier.ideal + topup,
    max: tier.max + topup,
    topup,
    topups: { bed: bed && !!role.bed_topup, masters: masters && !!role.masters_topup },
    campus_specific: !!(c.target_branch_id && role.branch_tiers?.[c.target_branch_id]?.length),
  };
}

// ---------------------------------------------------------------------------
// The pot and checking an offer
// ---------------------------------------------------------------------------

type WithOffer = Pick<Candidate, 'id' | 'final_offer' | 'rejected_by_candidate_at'>;

/** Offers that count against a role's pot: made, approved, and not turned down by the teacher. */
export function countedOffers(role: Pick<PayRole, 'id'>, candidates: WithOffer[], exceptId?: string): { monthly: number; count: number } {
  let monthly = 0;
  let count = 0;
  for (const c of candidates) {
    const o = c.final_offer;
    if (!o || o.role_id !== role.id || c.id === exceptId) continue;
    if (o.status !== 'approved' || c.rejected_by_candidate_at) continue;
    monthly += o.monthly;
    count += 1;
  }
  return { monthly, count };
}

export interface PotState {
  positions: number;
  monthly_budget: number;
  used_monthly: number;
  filled: number;
  left_monthly: number;
  posts_left: number;
}

export function potOf(role: PayRole, candidates: WithOffer[], exceptId?: string): PotState | null {
  if (!role.pot) return null;
  const used = countedOffers(role, candidates, exceptId);
  return {
    positions: role.pot.positions,
    monthly_budget: role.pot.monthly_budget,
    used_monthly: used.monthly,
    filled: used.count,
    left_monthly: role.pot.monthly_budget - used.monthly,
    posts_left: role.pot.positions - used.count,
  };
}

export interface OfferCheck {
  below_min: boolean;
  over_range: boolean;
  over_pot: boolean;
  /** Plain-language reasons the offer needs the admin, empty when it can go ahead. */
  needs_approval: string[];
}

/** Does this figure sit inside the range and the pot? Anything outside needs the school admin. */
export function checkOffer(monthly: number, range: Pick<PayRange, 'min' | 'max'>, pot: PotState | null): OfferCheck {
  const over_range = monthly > range.max;
  const below_min = monthly < range.min;
  const over_pot = !!pot && (monthly > pot.left_monthly || pot.posts_left < 1);
  const needs: string[] = [];
  if (over_range) needs.push(`₹${(monthly - range.max).toLocaleString('en-IN')} a month above the highest pay for this tier.`);
  if (over_pot && pot) {
    needs.push(pot.posts_left < 1 ? 'All the posts in this role are already filled.' : `₹${(monthly - pot.left_monthly).toLocaleString('en-IN')} a month more than is left in the budget.`);
  }
  return { below_min, over_range, over_pot, needs_approval: needs };
}

export function validMonthly(v: unknown): number | null {
  return money(v);
}
