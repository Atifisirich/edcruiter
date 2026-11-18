import { describe, expect, it } from 'vitest';
import { resolveSchoolId, roleAllowed, AuthError, StaffContext } from './auth';
import { HIRING_TEAM } from './permissions';
import { User } from './types';

function staffCtx(overrides: Partial<StaffContext> = {}): StaffContext {
  const user: User = {
    id: 'user_1',
    school_id: 'school_a',
    name: 'Test Admin',
    email: 'admin@school-a.example',
    role: 'SCHOOL_ADMIN',
  };
  return { user, schoolId: 'school_a', role: 'SCHOOL_ADMIN', isSuperAdmin: false, ...overrides };
}

describe('resolveSchoolId', () => {
  it('pins an ordinary staff member to their own school regardless of what is requested', () => {
    // Regression: every route previously trusted a client-supplied
    // school_id verbatim, which let any signed-in (or, before auth existed
    // at all, any unauthenticated) caller read or write another tenant's
    // data by simply passing a different school_id.
    const ctx = staffCtx({ schoolId: 'school_a' });
    expect(resolveSchoolId(ctx, 'school_b')).toBe('school_a');
    expect(resolveSchoolId(ctx, null)).toBe('school_a');
    expect(resolveSchoolId(ctx, undefined)).toBe('school_a');
  });

  it('throws if a staff account has no school and is not a super admin', () => {
    const ctx = staffCtx({ schoolId: null });
    expect(() => resolveSchoolId(ctx, 'school_a')).toThrow(AuthError);
  });

  it('lets a super admin act on whichever school they explicitly name', () => {
    const ctx = staffCtx({ isSuperAdmin: true, schoolId: null, role: 'SUPER_ADMIN' });
    expect(resolveSchoolId(ctx, 'school_b')).toBe('school_b');
  });

  it('requires a super admin to name a school explicitly rather than defaulting to one', () => {
    const ctx = staffCtx({ isSuperAdmin: true, schoolId: null, role: 'SUPER_ADMIN' });
    expect(() => resolveSchoolId(ctx, null)).toThrow(AuthError);
    expect(() => resolveSchoolId(ctx, '')).toThrow(AuthError);
  });
});

describe('roleAllowed (support mode)', () => {
  it('lets the platform owner do what the school admin and HR may', () => {
    expect(roleAllowed('SUPER_ADMIN', { anyOf: HIRING_TEAM })).toBe(true);
    expect(roleAllowed('SUPER_ADMIN', { minRole: 'SCHOOL_ADMIN' })).toBe(true);
  });

  it('still keeps reviewers out of hiring-team work and HR out of admin-only work', () => {
    expect(roleAllowed('REPORTING_MANAGER', { anyOf: HIRING_TEAM })).toBe(false);
    expect(roleAllowed('HR', { anyOf: HIRING_TEAM })).toBe(true);
    expect(roleAllowed('HR', { minRole: 'SCHOOL_ADMIN' })).toBe(false);
  });

  it('does not widen a rule the school admin is not on', () => {
    expect(roleAllowed('SUPER_ADMIN', { anyOf: ['HR'] })).toBe(false);
  });
});
