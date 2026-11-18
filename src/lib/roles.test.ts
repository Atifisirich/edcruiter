import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLES, parseRoles, roleDefFor, rolesOf } from './roles';
import { MAX_ROLE_NAMES } from './planLimits';
import { parseSeatLimits, seatLimitsOf, seatProblem, seatUse, totalSeats } from './seats';

const ids = () => 'role_new';

describe('role names', () => {
  it('start as the standard roles, HR included', () => {
    expect(rolesOf(undefined).map((r) => r.id)).toEqual(['SCHOOL_ADMIN', 'HR', 'REPORTING_MANAGER', 'INSTITUTE_HEAD', 'FINAL_DECISION_MAKER']);
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

describe('team seats', () => {
  const person = (id: string, role: string, role_id?: string) => ({ id, role, role_id } as { id: string; role: 'SCHOOL_ADMIN'; role_id?: string });

  it('start at 2 admins, 5 principals, 15 subject heads, 2 recruiters and 2 management', () => {
    expect(seatLimitsOf(undefined)).toEqual({ SCHOOL_ADMIN: 2, INSTITUTE_HEAD: 5, REPORTING_MANAGER: 15, HR: 2, FINAL_DECISION_MAKER: 2 });
    expect(totalSeats(undefined)).toBe(26);
  });

  it('use the numbers the platform owner set for this school', () => {
    const school = { seat_limits: { INSTITUTE_HEAD: 1, HR: 0 } };
    expect(seatLimitsOf(school)).toMatchObject({ INSTITUTE_HEAD: 1, HR: 0, REPORTING_MANAGER: 15 });
  });

  it("count a school's own role names against the seat of their level", () => {
    const school = { roles: [...DEFAULT_ROLES, { id: 'role_vp', name: 'Vice Principal', level: 'INSTITUTE_HEAD' as const }] };
    const used = seatUse(school, [person('a', 'SCHOOL_ADMIN'), person('b', 'INSTITUTE_HEAD', 'role_vp'), person('c', 'INSTITUTE_HEAD')]);
    expect(used.find((s) => s.level === 'INSTITUTE_HEAD')).toMatchObject({ used: 2, limit: 5, label: 'Principal' });
  });

  it('refuse one more person once a seat type is full, but not someone already in it', () => {
    const school = { seat_limits: { INSTITUTE_HEAD: 1 } };
    const members = [person('a', 'SCHOOL_ADMIN'), person('p', 'INSTITUTE_HEAD')];
    expect(seatProblem(school, members, 'INSTITUTE_HEAD')).toMatch(/The 1 Principal seat is taken/);
    expect(seatProblem(school, members, 'INSTITUTE_HEAD', 'p')).toBeNull();
    expect(seatProblem(school, members, 'REPORTING_MANAGER')).toBeNull();
    expect(seatProblem({ seat_limits: { HR: 0 } }, members, 'HR')).toMatch(/no Recruiter \(HR\) seats/);
  });

  it('accept only whole numbers, with at least one admin seat', () => {
    const good = { SCHOOL_ADMIN: 2, INSTITUTE_HEAD: 5, REPORTING_MANAGER: 15, HR: 2, FINAL_DECISION_MAKER: 2 };
    expect(parseSeatLimits(good)).toEqual({ ok: true, limits: good });
    expect(parseSeatLimits({ ...good, HR: 1.5 }).ok).toBe(false);
    expect(parseSeatLimits({ ...good, HR: -1 }).ok).toBe(false);
    expect(parseSeatLimits({ ...good, SCHOOL_ADMIN: 0 }).ok).toBe(false);
    expect(parseSeatLimits(null).ok).toBe(false);
  });

  it('allow 25 role names, which are names and not people', () => {
    expect(MAX_ROLE_NAMES).toBe(25);
  });
});
