import { isValidEmail, normalizeEmail } from './emailAddress';
import type { User, UserRole } from './types';

/**
 * The levels a school admin can hand out. The platform owner role is never one
 * of them. INSTITUTE_HEAD and FINAL_DECISION_MAKER are older reviewer levels:
 * still valid for the people and roles that carry them, so a school's standard
 * Principal and Management roles keep working. See permissions.ts.
 */
export const TEAM_ROLES: UserRole[] = ['SCHOOL_ADMIN', 'HR', 'REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER'];

/** The three kinds of access a school chooses between when it names a role. */
export const ACCESS_CHOICES: { level: UserRole; label: string; help: string }[] = [
  { level: 'SCHOOL_ADMIN', label: 'School admin', help: 'Management. Everything, including deleting or changing data, the team, settings and review rounds, and seeing everyone’s work.' },
  { level: 'HR', label: 'HR', help: 'Posts vacancies, adds and invites candidates, creates tests, schedules interviews, shortlists, and sends offers. Cannot delete or change data.' },
  { level: 'REPORTING_MANAGER', label: 'Reviewer', help: 'Reads candidate reports and gives a yes or no with their opinion, in the review rounds their role is assigned to.' },
];

export const MAX_TEAM_SIZE = 25;

/** The standard role names, which are also the names used before a school renames them. */
export const ROLE_LABEL: Record<string, string> = {
  SCHOOL_ADMIN: 'School admin',
  HR: 'HR',
  REPORTING_MANAGER: 'Subject lead (HOD)',
  INSTITUTE_HEAD: 'Principal',
  FINAL_DECISION_MAKER: 'Management',
  SUPER_ADMIN: 'Platform owner',
};

const ACCESS_HELP = Object.fromEntries(ACCESS_CHOICES.map((c) => [c.level, c.help]));

/** What a role at this level can do, in a sentence. */
export const ROLE_HELP: Record<string, string> = {
  SCHOOL_ADMIN: ACCESS_HELP.SCHOOL_ADMIN,
  HR: ACCESS_HELP.HR,
  REPORTING_MANAGER: ACCESS_HELP.REPORTING_MANAGER,
  INSTITUTE_HEAD: ACCESS_HELP.REPORTING_MANAGER,
  FINAL_DECISION_MAKER: ACCESS_HELP.REPORTING_MANAGER,
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
