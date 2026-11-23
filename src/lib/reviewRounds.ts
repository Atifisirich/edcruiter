/**
 * The review rounds a shortlisted teacher goes through, set by the school
 * admin: their names, their order, and which roles decide each one. The last
 * round is the final yes or no.
 *
 * Until a school sets its own, it has the standard three, whose ids match the
 * ones older candidates and interviews already carry. Their results were kept
 * in rm_clearance / ih_clearance / coo_clearance, which are still read here.
 */

import { accessOf, isAdmin } from './permissions';
import { rolesOf } from './roles';
import type { Candidate, ReviewRound, RoleDef, RoundResult, School, User } from './types';

export const MAX_ROUNDS = 6;

export const DEFAULT_ROUNDS: ReviewRound[] = [
  { id: 'subject_lead', name: 'Subject lead', role_ids: ['REPORTING_MANAGER'] },
  { id: 'principal', name: 'Principal', role_ids: ['INSTITUTE_HEAD'] },
  { id: 'management', name: 'Management', role_ids: ['FINAL_DECISION_MAKER'] },
];

const LEGACY_FIELD: Record<string, 'rm_clearance' | 'ih_clearance' | 'coo_clearance'> = {
  subject_lead: 'rm_clearance',
  principal: 'ih_clearance',
  management: 'coo_clearance',
};

/**
 * The school's rounds. The standard rounds go to every role at the level that
 * used to decide them, so a school that renamed "Subject lead (HOD)" to
 * "Science HOD" still has that role reviewing the subject-lead round.
 */
export function roundsOf(school: Pick<School, 'review_rounds' | 'roles'> | null | undefined): ReviewRound[] {
  if (school?.review_rounds?.length) return school.review_rounds;
  const roles = rolesOf(school);
  return DEFAULT_ROUNDS.map((r) => {
    const level = r.role_ids[0];
    const ids = roles.filter((role) => role.level === level).map((role) => role.id);
    return { ...r, role_ids: ids.length ? ids : r.role_ids };
  });
}

/** A teacher's own rounds: their campus's flow when the school set one, else the school's. */
export function roundsForCandidate(
  base: ReviewRound[],
  branchRounds: Record<string, ReviewRound[]> | undefined,
  c: Pick<Candidate, 'target_branch_id'> | null | undefined
): ReviewRound[] {
  const own = c?.target_branch_id ? branchRounds?.[c.target_branch_id] : undefined;
  return own?.length ? own : base;
}

/** The rounds that apply to this candidate, for use on the server. */
export function roundsFor(
  school: Pick<School, 'review_rounds' | 'roles' | 'branch_review_rounds'> | null | undefined,
  c: Pick<Candidate, 'target_branch_id'> | null | undefined
): ReviewRound[] {
  return roundsForCandidate(roundsOf(school), school?.branch_review_rounds, c);
}

/** Every round any flow uses, once each (by id), the school's own order first. For tabs and name lookups. */
export function allRoundsOf(base: ReviewRound[], branchRounds: Record<string, ReviewRound[]> | undefined): ReviewRound[] {
  const seen = new Set(base.map((r) => r.id));
  const extra: ReviewRound[] = [];
  for (const list of Object.values(branchRounds ?? {})) {
    for (const r of list) if (!seen.has(r.id)) { seen.add(r.id); extra.push(r); }
  }
  return [...base, ...extra];
}

type WithResults = Pick<Candidate, 'round_results' | 'rm_clearance' | 'ih_clearance' | 'coo_clearance'>;

/** What was decided at this round, or undefined while it is still open. */
export function roundResultOf(c: WithResults, roundId: string): RoundResult | undefined {
  const saved = c.round_results?.[roundId];
  if (saved) return saved;
  const field = LEGACY_FIELD[roundId];
  const old = field ? c[field] : undefined;
  if (!old || (old.status !== 'cleared' && old.status !== 'rejected')) return undefined;
  return {
    status: old.status,
    notes: old.notes,
    reviewer_name: old.reviewer_name,
    completed_at: old.completed_at || '',
    gmeet_link: old.gmeet_link,
  };
}

/** The round a shortlisted teacher is waiting on: the first one not yet cleared. Null when every round is cleared. */
export function currentRound(c: WithResults, rounds: ReviewRound[]): ReviewRound | null {
  return rounds.find((r) => roundResultOf(c, r.id)?.status !== 'cleared') ?? null;
}

/** Selected: the final round said yes (or the school marked it before rounds were recorded this way). */
export function isSelected(c: WithResults & Pick<Candidate, 'selected_at' | 'status'>, rounds: ReviewRound[]): boolean {
  if (c.selected_at || c.status === 'hired') return true;
  return rounds.length > 0 && currentRound(c, rounds) === null;
}

/** May this person give the yes or no at this round? The school admin always may. */
export function canDecideRound(user: Pick<User, 'role' | 'role_id'>, round: ReviewRound): boolean {
  if (isAdmin(user.role)) return true;
  if (accessOf(user.role) !== 'reviewer') return false;
  return round.role_ids.includes(user.role_id ?? user.role);
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Checks the admin's list of rounds before it is saved. Returns the cleaned
 * list, or a plain-language reason it cannot be used.
 */
export function parseRounds(
  input: unknown,
  roles: RoleDef[],
  newId: () => string = () => `round_${Math.random().toString(36).slice(2, 8)}`
): { ok: true; rounds: ReviewRound[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Add at least one review round.' };
  if (input.length > MAX_ROUNDS) return { ok: false, error: `A school can have up to ${MAX_ROUNDS} review rounds.` };

  const reviewerRoles = new Map(roles.filter((r) => accessOf(r.level) === 'reviewer').map((r) => [r.id, r]));
  const rounds: ReviewRound[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  for (const raw of input as Record<string, unknown>[]) {
    const name = cleanName(raw?.name);
    if (name.length < 2 || name.length > 40) return { ok: false, error: 'Each round name needs 2 to 40 characters.' };
    if (/[<>]/.test(name)) return { ok: false, error: 'Round names cannot contain < or >.' };
    const key = name.toLowerCase();
    if (seenNames.has(key)) return { ok: false, error: `You have two rounds called "${name}".` };
    seenNames.add(key);

    const wanted = Array.isArray(raw?.role_ids) ? (raw.role_ids as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    const role_ids = [...new Set(wanted)].filter((id) => reviewerRoles.has(id));
    if (role_ids.length === 0) return { ok: false, error: `Choose who reviews the "${name}" round.` };

    let id = typeof raw?.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(raw.id) ? raw.id : newId();
    if (seenIds.has(id)) id = newId();
    seenIds.add(id);
    rounds.push({ id, name, role_ids });
  }

  return { ok: true, rounds };
}
