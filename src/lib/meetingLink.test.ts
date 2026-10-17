import { describe, expect, it } from 'vitest';
import { generateMeetingLink } from './meetingLink';

describe('generateMeetingLink', () => {
  it('produces a valid jit.si URL', () => {
    const link = generateMeetingLink('cand_123', 'subject_lead');
    expect(link).toMatch(/^https:\/\/meet\.jit\.si\/[A-Za-z0-9-]+$/);
  });

  it('produces a different room each time, even for the same candidate and round', () => {
    // Otherwise two scheduled interviews for the same candidate at the same
    // round would collide on the same room.
    const a = generateMeetingLink('cand_123', 'subject_lead');
    const b = generateMeetingLink('cand_123', 'subject_lead');
    expect(a).not.toBe(b);
  });

  it('strips characters that are not safe in a URL path segment', () => {
    const link = generateMeetingLink('cand 123/../etc', 'subject_lead');
    expect(link).toMatch(/^https:\/\/meet\.jit\.si\/[A-Za-z0-9-]+$/);
  });
});
