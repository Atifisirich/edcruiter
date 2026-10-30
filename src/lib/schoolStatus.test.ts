import { describe, expect, it } from 'vitest';
import { schoolBlockReason, stripProtectedSchoolFields } from './schoolStatus';

describe('schoolBlockReason', () => {
  it('allows an approved school', () => {
    expect(schoolBlockReason('active')).toBeNull();
  });

  it('blocks a school that is still waiting for approval, and says why', () => {
    expect(schoolBlockReason('onboarding')).toMatch(/waiting for approval/i);
  });

  it('blocks a suspended school with a different message', () => {
    expect(schoolBlockReason('suspended')).toMatch(/suspended/i);
  });

  it('treats a school with no status as not approved', () => {
    expect(schoolBlockReason(undefined)).not.toBeNull();
  });
});

describe('stripProtectedSchoolFields', () => {
  const attempt = { status: 'active', id: 'other', created_at: 'x', whatsapp_hiring: { status: 'live' }, shortlist_bands: [1] };

  it('stops a school admin approving their own school or editing identity fields', () => {
    expect(stripProtectedSchoolFields(attempt, false)).toEqual({ shortlist_bands: [1] });
  });

  it('lets the platform owner change the status', () => {
    expect(stripProtectedSchoolFields({ status: 'active' }, true)).toEqual({ status: 'active' });
  });

  it('does not modify the object it was given', () => {
    const input = { status: 'active', name: 'A' };
    stripProtectedSchoolFields(input, false);
    expect(input.status).toBe('active');
  });
});
