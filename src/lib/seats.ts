/**
 * Team seats: how many people of each kind a school may have.
 *
 * Every school gets the standard allowance below. The platform owner can raise
 * or lower any number for one school from the super admin page; the school
 * itself cannot. A seat is counted by the access level behind a person's role,
 * so a school's own role names ("Maths Coordinator", "Vice Principal") use the
 * seat of the level they sit on.
 *
 * Pure: the caller passes the school and its members.
 */

import { roleDefFor } from './roles';
import { ACCESS_CHOICES } from './team';
import type { School, User, UserRole } from './types';

export interface SeatType {
  level: UserRole;
  label: string;
  /** What someone in this seat can do, in a sentence. */
  help: string;
  standard: number;
}

/** The standard allowance every school starts with: 26 people. */
const STANDARD: Record<string, number> = {
  SCHOOL_ADMIN: 2,
  INSTITUTE_HEAD: 5,
  REPORTING_MANAGER: 15,
  HR: 2,
  FINAL_DECISION_MAKER: 2,
};

export const SEAT_TYPES: SeatType[] = ACCESS_CHOICES.map((c) => ({ ...c, standard: STANDARD[c.level] ?? 0 }));

/** The most seats of one kind the platform owner can give a school. A guard against typos, not a plan feature. */
export const MAX_SEATS_PER_TYPE = 100;

export type SeatLimits = Partial<Record<UserRole, number>>;

const SEAT_OF = new Map(SEAT_TYPES.map((s) => [s.level, s]));

export function seatType(level: UserRole | string): SeatType | undefined {
  return SEAT_OF.get(level as UserRole);
}

/** This school's allowance for every seat type: the platform owner's numbers where set, the standard elsewhere. */
export function seatLimitsOf(school: Pick<School, 'seat_limits'> | null | undefined): Record<string, number> {
  const own = school?.seat_limits ?? {};
  return Object.fromEntries(SEAT_TYPES.map((s) => {
    const n = own[s.level];
    return [s.level, typeof n === 'number' && Number.isFinite(n) ? n : s.standard];
  }));
}

/** The seat a member uses: the level of the role they hold, by the school's own role names. */
export function seatOf(school: Pick<School, 'roles'> | null | undefined, user: Pick<User, 'role' | 'role_id'>): UserRole {
  return roleDefFor(school, user).level;
}

export interface SeatUse { level: UserRole; label: string; help: string; used: number; limit: number }

/** How many of each seat the school has used, in the standard order. */
export function seatUse(school: Pick<School, 'roles' | 'seat_limits'> | null | undefined, members: Pick<User, 'role' | 'role_id'>[]): SeatUse[] {
  const limits = seatLimitsOf(school);
  const used = new Map<string, number>();
  for (const m of members) {
    const level = seatOf(school, m);
    used.set(level, (used.get(level) ?? 0) + 1);
  }
  return SEAT_TYPES.map((s) => ({ level: s.level, label: s.label, help: s.help, used: used.get(s.level) ?? 0, limit: limits[s.level] }));
}

/**
 * Why one more person cannot take a seat at this level, or null when they can.
 * `movingId` is a member changing seat, who does not count against the new one.
 */
export function seatProblem(
  school: Pick<School, 'roles' | 'seat_limits'> | null | undefined,
  members: Pick<User, 'id' | 'role' | 'role_id'>[],
  level: UserRole,
  movingId?: string
): string | null {
  const type = seatType(level);
  if (!type) return 'Choose a role.';
  const limit = seatLimitsOf(school)[level];
  const used = members.filter((m) => m.id !== movingId && seatOf(school, m) === level).length;
  if (used < limit) return null;
  return limit === 0
    ? `This school has no ${type.label} seats. Write to edcruiterofficial@gmail.com to add some.`
    : `${limit === 1 ? `The 1 ${type.label} seat is` : `All ${limit} ${type.label} seats are`} taken. Remove someone in that role first, or write to edcruiterofficial@gmail.com for more seats.`;
}

/** Checks the numbers the platform owner typed. Returns the cleaned allowance, or a plain reason it cannot be used. */
export function parseSeatLimits(input: unknown): { ok: true; limits: SeatLimits } | { ok: false; error: string } {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Give a number for each kind of seat.' };
  const raw = input as Record<string, unknown>;
  const limits: SeatLimits = {};
  for (const s of SEAT_TYPES) {
    const n = Number(raw[s.level]);
    if (!Number.isInteger(n) || n < 0 || n > MAX_SEATS_PER_TYPE) {
      return { ok: false, error: `${s.label} seats must be a whole number from 0 to ${MAX_SEATS_PER_TYPE}.` };
    }
    limits[s.level] = n;
  }
  if ((limits.SCHOOL_ADMIN ?? 0) < 1) return { ok: false, error: 'A school needs at least one school admin seat.' };
  return { ok: true, limits };
}

/** Total people a school may have, all seats together. */
export function totalSeats(school: Pick<School, 'seat_limits'> | null | undefined): number {
  return Object.values(seatLimitsOf(school)).reduce((a, b) => a + b, 0);
}
