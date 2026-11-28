/**
 * The final call, on the server: what the decision-maker sees for one
 * candidate (their role, range, what they asked for, the pot), and the offer
 * they make. The rules are in payGuide.ts; this joins them to the school's data.
 */

import { db } from './db';
import { accessOf, isAdmin } from './permissions';
import { currentRound, roundsFor } from './reviewRounds';
import { checkOffer, matchRole, potOf, rangeFor, yearsOf, type OfferCheck, type PayRange, type PotState } from './payGuide';
import { salaryOf } from './salary';
import type { Candidate, FinalOffer, PayRole, School, User } from './types';

export interface PayInfo {
  /** A role in the Pay Guide fits this candidate. */
  matched: boolean;
  /** The candidate is on the school's last review round, where the final call is taken. */
  final_round: boolean;
  role?: { id: string; name: string; decider_user_id?: string; decider_name?: string };
  range?: PayRange;
  years?: { value: number; source: 'cv' | 'application' };
  /** What the teacher asked for and earns now, in rupees a month. `from_text` when read from an older free-text answer (kept in `text`). Current 0 = not working now. */
  expected?: { text: string; monthly: number | null; from_text?: boolean; note?: string };
  current?: { text: string; monthly: number | null; from_text?: boolean; note?: string };
  pot?: PotState | null;
  offer?: FinalOffer;
  /** The campus the teacher applied to, by name. */
  campus_name?: string;
}

/** The person who takes the final call for a role: the one management named, else the school admin(s). */
export function deciderOf(role: Pick<PayRole, 'decider_user_id'>, users: User[]): { id?: string; name: string } {
  const named = role.decider_user_id ? users.find((u) => u.id === role.decider_user_id) : undefined;
  if (named) return { id: named.id, name: named.name };
  return { name: 'the school admin' };
}

/** May this person set the offer for this role? The named decision-maker, else the school admin. The admin may always. */
export function mayDecidePay(user: Pick<User, 'id' | 'role'>, role: Pick<PayRole, 'decider_user_id'>): boolean {
  if (isAdmin(user.role)) return true;
  return !!role.decider_user_id && role.decider_user_id === user.id;
}

function campusName(school: School | undefined, branchId?: string): string | undefined {
  return branchId ? school?.branches?.find((b) => b.id === branchId)?.name : undefined;
}

export function payInfoFor(school: School | undefined, candidate: Candidate, users: User[]): PayInfo {
  const rounds = roundsFor(school, candidate);
  const now = currentRound(candidate, rounds);
  const final_round = !!now && rounds.length > 0 && rounds[rounds.length - 1].id === now.id;
  const role = matchRole(school?.pay_guide, candidate);
  if (!role) return { matched: false, final_round };

  const all = db.getCandidatesBySchool(candidate.school_id, { notResponding: 'include' });
  const years = yearsOf(candidate);
  const asked = salaryOf(candidate, 'expected');
  const has = salaryOf(candidate, 'current');
  return {
    matched: true,
    final_round,
    role: { id: role.id, name: role.name, decider_user_id: role.decider_user_id, decider_name: deciderOf(role, users).name },
    range: rangeFor(role, candidate),
    years: { value: years.years, source: years.source },
    expected: { text: asked.fromText ?? '', monthly: asked.monthly, ...(asked.fromText ? { from_text: true } : {}), ...(asked.note ? { note: asked.note } : {}) },
    current: { text: has.fromText ?? '', monthly: has.monthly, ...(has.fromText ? { from_text: true } : {}), ...(has.note ? { note: has.note } : {}) },
    pot: potOf(role, all, candidate.id),
    ...(campusName(school, candidate.target_branch_id) ? { campus_name: campusName(school, candidate.target_branch_id) } : {}),
    ...(candidate.final_offer ? { offer: candidate.final_offer } : {}),
  };
}

/** Builds the final offer record from the decision-maker's figure. An offer outside the range or pot waits for the admin. */
export function buildFinalOffer(input: {
  monthly: number;
  reason?: string;
  role: PayRole;
  range: PayRange;
  years: number;
  pot: PotState | null;
  by: Pick<User, 'id' | 'name'>;
  previous?: FinalOffer;
  nowIso?: string;
}): { offer: FinalOffer; check: OfferCheck } {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const check = checkOffer(input.monthly, input.range, input.pot);
  const needsAdmin = check.over_range || check.over_pot;
  const reason = (input.reason ?? '').trim().slice(0, 1000);
  const history = [...(input.previous?.history ?? [])];
  if (input.previous) history.push({ at: input.previous.decided_at, by: input.previous.decided_by, monthly: input.previous.monthly, status: input.previous.status });
  return {
    check,
    offer: {
      role_id: input.role.id,
      role_name: input.role.name,
      monthly: input.monthly,
      tier_label: input.range.tier_label,
      range: { min: input.range.min, ideal: input.range.ideal, max: input.range.max },
      years: input.years,
      over_range: check.over_range,
      over_pot: check.over_pot,
      ...(reason ? { reason } : {}),
      status: needsAdmin ? 'pending_approval' : 'approved',
      decided_by_id: input.by.id,
      decided_by: input.by.name,
      decided_at: nowIso,
      ...(input.previous?.counters?.length ? { counters: input.previous.counters } : {}),
      ...(history.length ? { history } : {}),
    },
  };
}

const newId = () => `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function tell(schoolId: string, user: User, kind: 'pay_approval' | 'pay_decided', title: string, body: string, href: string) {
  db.addNotification({ id: newId(), school_id: schoolId, user_id: user.id, kind, title, body, href, created_at: new Date().toISOString() });
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** The school admins are told an offer is waiting for them. */
export function notifyPayApproval(schoolId: string, candidate: Pick<Candidate, 'id' | 'name'>, offer: FinalOffer, why: string[]): string[] {
  const admins = db.getUsersBySchool(schoolId).filter((u) => accessOf(u.role) === 'admin' && u.role !== 'SUPER_ADMIN' && u.id !== offer.decided_by_id);
  for (const a of admins) {
    tell(schoolId, a, 'pay_approval', `Offer for ${candidate.name} needs your approval`,
      `${offer.decided_by} wants to offer ${rupees(offer.monthly)} a month as ${offer.role_name}. ${why.join(' ')}${offer.reason ? ` Their reason: ${offer.reason}` : ''}`,
      `/admin/candidates/${candidate.id}`);
  }
  return admins.map((a) => a.name);
}

/** The decision-maker and HR are told how the admin answered. */
export function notifyPayDecided(schoolId: string, candidate: Pick<Candidate, 'id' | 'name'>, offer: FinalOffer, approved: boolean, byName: string, note?: string): void {
  const users = db.getUsersBySchool(schoolId).filter((u) => u.name !== byName);
  const people = users.filter((u) => u.id === offer.decided_by_id || accessOf(u.role) === 'hr');
  for (const p of people) {
    tell(schoolId, p, 'pay_decided', `${byName} ${approved ? 'approved' : 'did not approve'} the offer for ${candidate.name}`,
      `${rupees(offer.monthly)} a month as ${offer.role_name}.${note ? ` ${note}` : ''}${approved ? ' HR can now select the teacher and send the offer letter.' : ' The decision-maker can make a new offer.'}`,
      accessOf(p.role) === 'hr' ? `/admin/candidates/${candidate.id}` : '/reviewer/home');
  }
}
