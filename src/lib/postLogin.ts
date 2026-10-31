import type { User, UserRole } from './types';

/** Where each kind of staff member lands after signing in. */
export function roleHome(role: UserRole): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/superadmin';
    case 'REPORTING_MANAGER': return '/reviewer/rm';
    case 'INSTITUTE_HEAD': return '/reviewer/ih';
    case 'FINAL_DECISION_MAKER': return '/reviewer/coo';
    default: return '/admin';
  }
}

/** Only same-site paths. A `next` pointing at another host would turn sign-in into an open redirect. */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  return next;
}

/**
 * Where to send someone who has just proven who they are. A person who already
 * belongs to a school goes to their own workspace (or the page they were trying
 * to open); everyone else is new and goes to school setup.
 */
export function destinationAfterSignIn(user: Pick<User, 'role'> | undefined, next?: unknown): string {
  if (!user) return '/school/setup';
  const wanted = safeNextPath(next);
  if (wanted && wanted !== '/school/setup' && !wanted.startsWith('/login') && !wanted.startsWith('/signup')) return wanted;
  return roleHome(user.role);
}
