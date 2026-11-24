/**
 * One person as both school admin and management, for a small school.
 */
import { describe, expect, it } from 'vitest';
import { actsAsManagement, isAdmin } from './permissions';
import { heldRoleIds, managementRoleIds } from './roles';
import { DEFAULT_ROUNDS, canDecideRound, reviewsRound } from './reviewRounds';
import { managementChangeProblem } from './team';
import { seatProblem, seatUse } from './seats';
import { roundAudience } from './interviewNotify';
import type { RoleDef, User } from './types';

const school = { roles: [
  { id: 'SCHOOL_ADMIN', name: 'School admin', level: 'SCHOOL_ADMIN' },
  { id: 'HR', name: 'Recruiter (HR)', level: 'HR' },
  { id: 'REPORTING_MANAGER', name: 'Subject head', level: 'REPORTING_MANAGER' },
  { id: 'INSTITUTE_HEAD', name: 'Principal', level: 'INSTITUTE_HEAD' },
  { id: 'role_board', name: 'Board', level: 'FINAL_DECISION_MAKER' },
] as RoleDef[] };

const [subjectLead, principal, management] = DEFAULT_ROUNDS;
const managementRound = { ...management, role_ids: ['role_board'] };

const user = (id: string, role: User['role'], extra: Partial<User> = {}): User =>
  ({ id, school_id: 's1', name: id, email: `${id}@school.in`, role, role_id: role, ...extra });

describe('who acts as management', () => {
  it('only a school admin with the tick', () => {
    expect(actsAsManagement(user('a', 'SCHOOL_ADMIN', { also_management: true }))).toBe(true);
    expect(actsAsManagement(user('a', 'SCHOOL_ADMIN'))).toBe(false);
    // The flag on anyone else gives nothing, so no one gains powers by carrying it.
    expect(actsAsManagement(user('h', 'HR', { also_management: true }))).toBe(false);
    expect(actsAsManagement(user('r', 'REPORTING_MANAGER', { also_management: true }))).toBe(false);
    expect(actsAsManagement(user('p', 'SUPER_ADMIN', { also_management: true }))).toBe(false);
    expect(actsAsManagement(null)).toBe(false);
  });

  it('only an admin can be ticked; anyone can be unticked', () => {
    expect(managementChangeProblem({ role: 'SCHOOL_ADMIN' }, true)).toBeNull();
    expect(managementChangeProblem({ role: 'HR' }, true)).toMatch(/Only a school admin/);
    expect(managementChangeProblem({ role: 'INSTITUTE_HEAD' }, true)).toMatch(/Only a school admin/);
    expect(managementChangeProblem({ role: 'HR' }, false)).toBeNull();
    expect(managementChangeProblem({ role: 'SUPER_ADMIN' }, true)).toMatch(/cannot be changed/);
  });
});

describe('the management roles they hold', () => {
  it("are the school's own management role names, plus the bare level for older rounds", () => {
    expect(managementRoleIds(school)).toEqual(['FINAL_DECISION_MAKER', 'role_board']);
    expect(heldRoleIds(school, user('a', 'SCHOOL_ADMIN', { also_management: true }))).toEqual(['SCHOOL_ADMIN', 'FINAL_DECISION_MAKER', 'role_board']);
    expect(heldRoleIds(school, user('a', 'SCHOOL_ADMIN'))).toEqual(['SCHOOL_ADMIN']);
  });

  it('make them a reviewer HR can give teachers to in the management round only', () => {
    const both = user('a', 'SCHOOL_ADMIN', { also_management: true });
    expect(reviewsRound(school, both, managementRound)).toBe(true);
    expect(reviewsRound(school, both, management)).toBe(true); // the standard round, by level
    expect(reviewsRound(school, both, subjectLead)).toBe(false);
    expect(reviewsRound(school, both, principal)).toBe(false);
    // And they keep every admin power.
    expect(isAdmin(both.role)).toBe(true);
    expect(canDecideRound(both, subjectLead)).toBe(true);
  });

  it('leave a plain admin and HR out of the reviewer lists, and reviewers as they were', () => {
    expect(reviewsRound(school, user('a', 'SCHOOL_ADMIN'), managementRound)).toBe(false);
    expect(reviewsRound(school, user('h', 'HR'), managementRound)).toBe(false);
    expect(reviewsRound(school, user('b', 'FINAL_DECISION_MAKER', { role_id: 'role_board' }), managementRound)).toBe(true);
    expect(reviewsRound(school, user('r', 'REPORTING_MANAGER'), managementRound)).toBe(false);
    expect(reviewsRound(school, user('r', 'REPORTING_MANAGER'), subjectLead)).toBe(true);
  });
});

describe('seats', () => {
  it('an admin acting as management uses one admin seat, never a management seat', () => {
    const members = [user('a', 'SCHOOL_ADMIN', { also_management: true }), user('h', 'HR')];
    const use = Object.fromEntries(seatUse(school, members).map((s) => [s.level, s.used]));
    expect(use.SCHOOL_ADMIN).toBe(1);
    expect(use.FINAL_DECISION_MAKER).toBe(0);
    // So a separate management person can still be added within the limit.
    expect(seatProblem(school, members, 'FINAL_DECISION_MAKER')).toBeNull();
  });
});

describe('who is told about the management round', () => {
  it('includes the admin acting as management, not a plain admin', () => {
    const both = user('a', 'SCHOOL_ADMIN', { also_management: true });
    const plain = user('b', 'SCHOOL_ADMIN');
    const hr = user('h', 'HR');
    const { team } = roundAudience([both, plain, hr], managementRound, { school });
    expect(team.map((u) => u.id)).toEqual(['a']);
  });
});
