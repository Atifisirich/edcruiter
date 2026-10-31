/**
 * A school's own role names. Each name sits on top of one of the four access
 * levels the platform already enforces, so renaming "Principal" to "Head of
 * School", or adding "Science HOD", changes what people see and never what
 * they are allowed to do.
 */

import { ROLE_LABEL, TEAM_ROLES } from './team';
import { MAX_ROLE_NAMES } from './planLimits';
import type { RoleDef, School, User, UserRole } from './types';

/** The standard four, used until a school defines its own. Their id is their level, which is also what older members carry. */
export const DEFAULT_ROLES: RoleDef[] = TEAM_ROLES.map((level) => ({ id: level, name: ROLE_LABEL[level], level }));

export function rolesOf(school: Pick<School, 'roles'> | null | undefined): RoleDef[] {
  return school?.roles?.length ? school.roles : DEFAULT_ROLES;
}

/** The role a member holds, by the school's names. Older members carry no role id, so their level is used. */
export function roleDefFor(school: Pick<School, 'roles'> | null | undefined, user: Pick<User, 'role' | 'role_id'>): RoleDef {
  const roles = rolesOf(school);
  return (
    roles.find((r) => r.id === (user.role_id ?? user.role)) ??
    roles.find((r) => r.level === user.role) ??
    { id: user.role, name: ROLE_LABEL[user.role] ?? user.role, level: user.role }
  );
}

function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Checks a school's new list of roles before it is saved. Returns the cleaned
 * list, or a plain-language reason it cannot be used.
 */
export function parseRoles(
  input: unknown,
  members: Pick<User, 'role' | 'role_id' | 'name'>[],
  newId: () => string = () => `role_${Math.random().toString(36).slice(2, 8)}`
): { ok: true; roles: RoleDef[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Add at least one role.' };
  if (input.length > MAX_ROLE_NAMES) return { ok: false, error: `A school can have up to ${MAX_ROLE_NAMES} role names.` };

  const roles: RoleDef[] = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();

  for (const raw of input as Record<string, unknown>[]) {
    const name = cleanName(raw?.name);
    const level = raw?.level as UserRole;
    if (name.length < 2 || name.length > 40) return { ok: false, error: 'Each role name needs 2 to 40 characters.' };
    if (/[<>]/.test(name)) return { ok: false, error: 'Role names cannot contain < or >.' };
    if (!TEAM_ROLES.includes(level)) return { ok: false, error: `Choose what "${name}" can do.` };
    const key = name.toLowerCase();
    if (seenNames.has(key)) return { ok: false, error: `You have two roles called "${name}".` };
    seenNames.add(key);

    let id = typeof raw?.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(raw.id) ? raw.id : newId();
    if (seenIds.has(id)) id = newId();
    seenIds.add(id);
    roles.push({ id, name, level });
  }

  if (!roles.some((r) => r.level === 'SCHOOL_ADMIN')) {
    return { ok: false, error: 'At least one role must be able to manage the school (admin access).' };
  }

  for (const m of members) {
    const id = m.role_id ?? m.role;
    const stillThere = roles.find((r) => r.id === id);
    if (!stillThere) {
      const label = ROLE_LABEL[m.role] ?? m.role;
      return { ok: false, error: `${m.name} still has a role you removed (${label}). Move them to another role first.` };
    }
    // A role may be renamed freely, but a person in it must not quietly gain or lose access.
    if (stillThere.level !== m.role) {
      return { ok: false, error: `${m.name} holds "${stillThere.name}". Change who holds that role before changing what it can do.` };
    }
  }

  return { ok: true, roles };
}
