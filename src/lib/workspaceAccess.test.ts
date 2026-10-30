import { describe, expect, it } from 'vitest';
import { stripProtectedSchoolFields, workspaceBlockReason } from './schoolStatus';
import type { School } from './types';

const day = 86_400_000;
const NOW = Date.parse('2026-11-01T00:00:00Z');

function school(over: Partial<School>): School {
  return { id: 's', name: 'S', status: 'active', ...over } as School;
}

describe('workspaceBlockReason', () => {
  it('lets an approved school with no billing record in (schools from before plans)', () => {
    expect(workspaceBlockReason(school({}), NOW)).toBeNull();
  });

  it('keeps a self-signup out until approved, then until it has a plan', () => {
    const waiting = school({ status: 'onboarding', billing: { plan: 'none', updated_at: '' } });
    expect(workspaceBlockReason(waiting, NOW)).toMatch(/waiting for approval/i);

    const approvedNoPlan = school({ status: 'active', billing: { plan: 'none', updated_at: '' } });
    expect(workspaceBlockReason(approvedNoPlan, NOW)).toMatch(/no active plan/i);
  });

  it('opens on a paid plan and closes the moment it ends', () => {
    const live = school({ billing: { plan: 'starter', valid_until: new Date(NOW + 5 * day).toISOString(), updated_at: '' } });
    expect(workspaceBlockReason(live, NOW)).toBeNull();

    const ended = school({ billing: { plan: 'starter', valid_until: new Date(NOW - day).toISOString(), updated_at: '' } });
    expect(workspaceBlockReason(ended, NOW)).toMatch(/plan ended/i);
  });

  it('treats a plan with no end date as open', () => {
    expect(workspaceBlockReason(school({ billing: { plan: 'complimentary', updated_at: '' } }), NOW)).toBeNull();
  });

  it('blocks a suspended school even on a paid plan', () => {
    const paused = school({ status: 'suspended', billing: { plan: 'growth', valid_until: new Date(NOW + day).toISOString(), updated_at: '' } });
    expect(workspaceBlockReason(paused, NOW)).toMatch(/suspended/i);
  });

  it('blocks a school that does not exist', () => {
    expect(workspaceBlockReason(undefined, NOW)).not.toBeNull();
  });
});

describe('billing is not editable by a school', () => {
  it('drops billing from a school admin update but keeps it for the platform owner', () => {
    const update = { billing: { plan: 'growth' }, name: 'New name' };
    expect(stripProtectedSchoolFields(update, false)).toEqual({ name: 'New name' });
    expect(stripProtectedSchoolFields(update, true)).toEqual(update);
  });
});
