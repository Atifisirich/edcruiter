import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLES, parseRoles, roleDefFor, rolesOf } from './roles';
import { MAX_ROLE_NAMES, teamLimit, teamLimitMessage } from './planLimits';

const ids = () => 'role_new';

describe('role names', () => {
  it('start as the four standard roles', () => {
    expect(rolesOf(undefined).map((r) => r.id)).toEqual(['SCHOOL_ADMIN', 'REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER']);
    expect(rolesOf({ roles: [] })).toBe(DEFAULT_ROLES);
  });

  it('show a member under the school\'s own name for their role', () => {
    const school = { roles: [{ id: 'REPORTING_MANAGER', name: 'Science HOD', level: 'REPORTING_MANAGER' as const }, ...DEFAULT_ROLES.slice(0, 1)] };
    expect(roleDefFor(school, { role: 'REPORTING_MANAGER' }).name).toBe('Science HOD');
    expect(roleDefFor(school, { role: 'REPORTING_MANAGER', role_id: 'REPORTING_MANAGER' }).name).toBe('Science HOD');
  });

  it('fall back to the standard name for a role the school no longer lists', () => {
    expect(roleDefFor({ roles: [DEFAULT_ROLES[0]] }, { role: 'INSTITUTE_HEAD' }).level).toBe('INSTITUTE_HEAD');
  });
});

describe('parseRoles', () => {
  const admin = { id: 'SCHOOL_ADMIN', name: 'Head of School', level: 'SCHOOL_ADMIN' };
  const members = [{ name: 'Anita', role: 'SCHOOL_ADMIN' as const }, { name: 'Ravi', role: 'REPORTING_MANAGER' as const }];

  it('accepts renamed roles and a new role, and gives the new one an id', () => {
    const out = parseRoles(
      [admin, { id: 'REPORTING_MANAGER', name: '  Science   HOD ', level: 'REPORTING_MANAGER' }, { name: 'Coordinator', level: 'INSTITUTE_HEAD' }],
      members,
      ids
    );
    expect(out).toEqual({
      ok: true,
      roles: [
        admin,
        { id: 'REPORTING_MANAGER', name: 'Science HOD', level: 'REPORTING_MANAGER' },
        { id: 'role_new', name: 'Coordinator', level: 'INSTITUTE_HEAD' },
      ],
    });
  });

  it('needs at least one role with admin access', () => {
    const out = parseRoles([{ id: 'REPORTING_MANAGER', name: 'HOD', level: 'REPORTING_MANAGER' }], [], ids);
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/admin access/) });
  });

  it('rejects empty, short, long, duplicate and unsafe names', () => {
    const base = (name: string) => parseRoles([admin, { name, level: 'REPORTING_MANAGER' }], [], ids);
    expect(base('A')).toMatchObject({ ok: false });
    expect(base('x'.repeat(41))).toMatchObject({ ok: false });
    expect(base('head of school')).toMatchObject({ ok: false, error: expect.stringMatching(/two roles/) });
    expect(base('<b>x</b>')).toMatchObject({ ok: false });
  });

  it('rejects a level that is not one of the four', () => {
    expect(parseRoles([admin, { name: 'Owner', level: 'SUPER_ADMIN' }], [], ids)).toMatchObject({ ok: false });
  });

  it('caps how many role names a school can have', () => {
    const many = Array.from({ length: MAX_ROLE_NAMES + 1 }, (_, i) => ({ name: `Role ${i}`, level: i === 0 ? 'SCHOOL_ADMIN' : 'REPORTING_MANAGER' }));
    expect(parseRoles(many, [], ids)).toMatchObject({ ok: false });
  });

  it('will not remove a role that someone still holds', () => {
    const out = parseRoles([admin], members, ids);
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/Ravi/) });
  });

  it('will not change what a role can do while someone holds it', () => {
    const out = parseRoles([admin, { id: 'REPORTING_MANAGER', name: 'HOD', level: 'SCHOOL_ADMIN' }], members, ids);
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/Ravi/) });
  });
});

describe('team limits by plan', () => {
  it('grow with the plan', () => {
    expect(teamLimit({ billing: { plan: 'trial' } })).toBe(3);
    expect(teamLimit({ billing: { plan: 'starter' } })).toBe(5);
    expect(teamLimit({ billing: { plan: 'growth' } })).toBe(15);
    expect(teamLimit({ billing: { plan: 'complimentary' } })).toBe(25);
  });

  it('gives a school with no plan record the full allowance, and an unknown plan the Starter one', () => {
    expect(teamLimit({})).toBe(25);
    expect(teamLimit(undefined)).toBe(25);
    expect(teamLimit({ billing: { plan: 'mystery' } })).toBe(5);
  });

  it('says what the plan allows and how to get more', () => {
    expect(teamLimitMessage({ billing: { plan: 'starter' } })).toMatch(/Starter plan includes up to 5 team members/);
  });
});
