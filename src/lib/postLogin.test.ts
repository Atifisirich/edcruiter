import { describe, expect, it } from 'vitest';
import { destinationAfterSignIn, roleHome, safeNextPath } from './postLogin';

describe('destinationAfterSignIn', () => {
  it('sends someone with no school to school setup', () => {
    expect(destinationAfterSignIn(undefined)).toBe('/school/setup');
    expect(destinationAfterSignIn(undefined, '/admin/jobs')).toBe('/school/setup');
  });

  it('sends a member to their own home for their role', () => {
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' })).toBe('/admin');
    expect(destinationAfterSignIn({ role: 'SUPER_ADMIN' })).toBe('/superadmin');
    expect(destinationAfterSignIn({ role: 'REPORTING_MANAGER' })).toBe('/reviewer/rm');
    expect(destinationAfterSignIn({ role: 'INSTITUTE_HEAD' })).toBe('/reviewer/ih');
    expect(destinationAfterSignIn({ role: 'FINAL_DECISION_MAKER' })).toBe('/reviewer/coo');
  });

  it('returns a member to the page they were trying to open', () => {
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, '/admin/jobs')).toBe('/admin/jobs');
  });

  it('never sends a member back to setup or a sign-in page', () => {
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, '/school/setup')).toBe('/admin');
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, '/login?next=/admin')).toBe('/admin');
  });

  it('ignores a next link that points off the site', () => {
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, 'https://evil.example/x')).toBe('/admin');
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, '//evil.example/x')).toBe('/admin');
    expect(destinationAfterSignIn({ role: 'SCHOOL_ADMIN' }, '/\\evil.example')).toBe('/admin');
  });
});

describe('safeNextPath / roleHome', () => {
  it('only allows same-site paths', () => {
    expect(safeNextPath('/admin')).toBe('/admin');
    expect(safeNextPath('admin')).toBeNull();
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(5)).toBeNull();
  });

  it('defaults an unknown role to the admin home', () => {
    expect(roleHome('SCHOOL_ADMIN')).toBe('/admin');
  });
});
