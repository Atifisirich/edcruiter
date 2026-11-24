import type { UserRole } from './types';

/**
 * Who may do what inside a school.
 *
 *   School admin  management. Everything, and the only one who deletes or
 *                 changes existing data, manages the team, and sets up rounds.
 *   HR            the day-to-day hiring work: vacancies, adding and inviting
 *                 candidates, tests, scheduling, the shortlist, the offer.
 *   Reviewer      reads reports and gives a yes or no, with their opinion, in
 *                 the rounds their role is assigned to (see reviewRounds.ts).
 */
export type Access = 'admin' | 'hr' | 'reviewer';

export function accessOf(role: UserRole | string | undefined): Access | null {
  switch (role) {
    case 'SCHOOL_ADMIN':
    case 'SUPER_ADMIN':
      return 'admin';
    case 'HR':
      return 'hr';
    case 'REPORTING_MANAGER':
    case 'INSTITUTE_HEAD':
    case 'FINAL_DECISION_MAKER':
      return 'reviewer';
    default:
      return null;
  }
}

/** For requireSchoolAccess({ anyOf }) on the hiring work HR shares with the admin. */
export const HIRING_TEAM: UserRole[] = ['SCHOOL_ADMIN', 'HR'];

export const REVIEWER_LEVELS: UserRole[] = ['REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER'];

export function isAdmin(role: UserRole | string | undefined): boolean {
  return accessOf(role) === 'admin';
}

export function isHiringTeam(role: UserRole | string | undefined): boolean {
  const a = accessOf(role);
  return a === 'admin' || a === 'hr';
}

export function isReviewer(role: UserRole | string | undefined): boolean {
  return accessOf(role) === 'reviewer';
}

/**
 * A school admin who is also the school's management (the final decision), so
 * a small school can run with one person. The admin already has every power;
 * this makes them count as management wherever management is asked for: the
 * management review round, the reviewer lists, the Pay Guide decision-maker.
 * Only a school admin can carry it, and only an admin can set it (team route).
 */
export function actsAsManagement(user: { role?: UserRole | string; also_management?: boolean } | null | undefined): boolean {
  return !!user && user.role === 'SCHOOL_ADMIN' && user.also_management === true;
}
