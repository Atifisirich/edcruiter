import { isValidEmail, normalizeEmail } from './emailAddress';
import type { User, UserRole } from './types';

/** The roles a school admin can hand out. The platform owner role is never one of them. */
export const TEAM_ROLES: UserRole[] = ['SCHOOL_ADMIN', 'REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER'];

export const MAX_TEAM_SIZE = 25;

export const ROLE_LABEL: Record<string, string> = {
  SCHOOL_ADMIN: 'School admin',
  REPORTING_MANAGER: 'Reporting manager (HOD)',
  INSTITUTE_HEAD: 'Institute head (Principal)',
  FINAL_DECISION_MAKER: 'Final decision maker',
  SUPER_ADMIN: 'Platform owner',
};

export const ROLE_HELP: Record<string, string> = {
  SCHOOL_ADMIN: 'Full access: vacancies, candidates, tests, WhatsApp, and managing this team.',
  REPORTING_MANAGER: 'Reviews candidates in the subject-lead round.',
  INSTITUTE_HEAD: 'Reviews candidates in the principal round.',
  FINAL_DECISION_MAKER: 'Makes the final hiring decision.',
};

export type TeamInput = { name: string; email: string; role: UserRole };

export function parseTeamInput(body: unknown): { ok: true; value: TeamInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  const email = normalizeEmail(b.email);
  const role = b.role as UserRole;
  if (name.length < 2 || name.length > 80) return { ok: false, error: 'Enter the person\'s name.' };
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
  if (!TEAM_ROLES.includes(role)) return { ok: false, error: 'Choose a role.' };
  return { ok: true, value: { name, email, role } };
}

function adminCount(members: Pick<User, 'role'>[]): number {
  return members.filter((m) => m.role === 'SCHOOL_ADMIN').length;
}

/** Returns why this role change is not allowed, or null when it is. */
export function roleChangeProblem(members: Pick<User, 'role'>[], target: Pick<User, 'role'>, newRole: UserRole): string | null {
  if (!TEAM_ROLES.includes(newRole)) return 'Choose a role.';
  if (target.role === 'SUPER_ADMIN') return 'That account cannot be changed here.';
  if (target.role === 'SCHOOL_ADMIN' && newRole !== 'SCHOOL_ADMIN' && adminCount(members) <= 1) {
    return 'A school needs at least one admin. Make someone else an admin first.';
  }
  return null;
}

/** Returns why this person cannot be removed, or null when they can. */
export function removalProblem(members: Pick<User, 'role'>[], target: Pick<User, 'id' | 'role'>, actorId: string): string | null {
  if (target.role === 'SUPER_ADMIN') return 'That account cannot be removed here.';
  if (target.id === actorId) return 'You cannot remove yourself. Ask another admin to do it.';
  if (target.role === 'SCHOOL_ADMIN' && adminCount(members) <= 1) {
    return 'A school needs at least one admin.';
  }
  return null;
}

/** "invited" only while someone added by an admin has never signed in. Everyone else is active. */
export function memberStatus(user: Pick<User, 'invited_at' | 'last_login_at'>): 'invited' | 'active' {
  return user.invited_at && !user.last_login_at ? 'invited' : 'active';
}
