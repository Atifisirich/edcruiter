import { describe, expect, it } from 'vitest';
import { memberStatus, parseTeamInput, removalProblem, roleChangeProblem, TEAM_ROLES } from './team';

const admin = { id: 'a1', role: 'SCHOOL_ADMIN' as const };
const admin2 = { id: 'a2', role: 'SCHOOL_ADMIN' as const };
const hod = { id: 'h1', role: 'REPORTING_MANAGER' as const };

describe('parseTeamInput', () => {
  it('cleans up a good entry', () => {
    const r = parseTeamInput({ name: '  Anita   Rao ', email: ' Anita@School.EDU ', role: 'INSTITUTE_HEAD' });
    expect(r).toEqual({ ok: true, value: { name: 'Anita Rao', email: 'anita@school.edu', role: 'INSTITUTE_HEAD' } });
  });

  it('rejects a missing name, a bad email and an unknown role', () => {
    expect(parseTeamInput({ name: '', email: 'a@b.in', role: 'SCHOOL_ADMIN' }).ok).toBe(false);
    expect(parseTeamInput({ name: 'Anita', email: 'nope', role: 'SCHOOL_ADMIN' }).ok).toBe(false);
    expect(parseTeamInput({ name: 'Anita', email: 'a@b.in', role: 'WIZARD' }).ok).toBe(false);
    expect(parseTeamInput(null).ok).toBe(false);
  });

  it('never lets a school hand out the platform owner role', () => {
    expect(TEAM_ROLES).not.toContain('SUPER_ADMIN');
    expect(parseTeamInput({ name: 'Anita', email: 'a@b.in', role: 'SUPER_ADMIN' }).ok).toBe(false);
  });
});

describe('roleChangeProblem', () => {
  it('stops the only admin being demoted', () => {
    expect(roleChangeProblem([admin, hod], admin, 'REPORTING_MANAGER')).toMatch(/at least one admin/);
  });

  it('allows demoting an admin when another remains, and promoting anyone', () => {
    expect(roleChangeProblem([admin, admin2], admin, 'REPORTING_MANAGER')).toBeNull();
    expect(roleChangeProblem([admin, hod], hod, 'SCHOOL_ADMIN')).toBeNull();
  });

  it('leaves the platform owner account alone', () => {
    expect(roleChangeProblem([admin], { role: 'SUPER_ADMIN' }, 'SCHOOL_ADMIN')).not.toBeNull();
  });
});

describe('removalProblem', () => {
  it('stops you removing yourself and the last admin', () => {
    expect(removalProblem([admin, admin2], admin, 'a1')).toMatch(/yourself/);
    expect(removalProblem([admin, hod], admin, 'h1')).toMatch(/at least one admin/);
  });

  it('allows removing a reviewer, or one of two admins', () => {
    expect(removalProblem([admin, hod], hod, 'a1')).toBeNull();
    expect(removalProblem([admin, admin2], admin2, 'a1')).toBeNull();
  });

  it('never removes the platform owner', () => {
    expect(removalProblem([admin], { id: 'su', role: 'SUPER_ADMIN' }, 'a1')).not.toBeNull();
  });
});

describe('memberStatus', () => {
  it('is invited only for someone added by an admin who has not signed in', () => {
    expect(memberStatus({ invited_at: '2026-10-01', last_login_at: undefined })).toBe('invited');
    expect(memberStatus({ invited_at: '2026-10-01', last_login_at: '2026-10-02' })).toBe('active');
  });

  it('treats everyone who was not invited (the founder, older accounts) as active', () => {
    expect(memberStatus({ invited_at: undefined, last_login_at: undefined })).toBe('active');
  });
});
