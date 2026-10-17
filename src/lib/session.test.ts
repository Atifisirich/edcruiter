import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createCandidateToken, createCandidateMagicLinkToken, readCandidateToken } from './session';

describe('candidate session tokens', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-for-session-signing';
  });

  it('round-trips a normal candidate session token', () => {
    const token = createCandidateToken({ cid: 'cand_123', school_id: 'school_1' });
    const decoded = readCandidateToken(token);
    expect(decoded?.cid).toBe('cand_123');
    expect(decoded?.school_id).toBe('school_1');
  });

  it('rejects a tampered token', () => {
    const token = createCandidateToken({ cid: 'cand_123', school_id: 'school_1' });
    const [encoded] = token.split('.');
    const tampered = `${encoded}.notarealsignature`;
    expect(readCandidateToken(tampered)).toBeNull();
  });

  it('rejects a token signed under a different secret', () => {
    const token = createCandidateToken({ cid: 'cand_123', school_id: 'school_1' });
    process.env.AUTH_SECRET = 'a-different-secret';
    expect(readCandidateToken(token)).toBeNull();
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    try {
      const token = createCandidateToken({ cid: 'cand_123', school_id: 'school_1' }, 60); // 1 minute
      vi.advanceTimersByTime(61_000);
      expect(readCandidateToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null for garbage input', () => {
    expect(readCandidateToken(undefined)).toBeNull();
    expect(readCandidateToken('not-a-real-token')).toBeNull();
    expect(readCandidateToken('')).toBeNull();
  });
});

describe('createCandidateMagicLinkToken', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret-for-session-signing';
  });

  it('produces a token that verifies to the right candidate and school', () => {
    const token = createCandidateMagicLinkToken('cand_456', 'school_2');
    const decoded = readCandidateToken(token);
    expect(decoded?.cid).toBe('cand_456');
    expect(decoded?.school_id).toBe('school_2');
  });

  it('expires well before a normal 3-day session token would', () => {
    // Regression guard for the actual security property this token relies
    // on: a WhatsApp message can be forwarded or screenshotted, so the
    // magic-login link must stop working long before a real session cookie
    // would — 30 minutes, not 3 days.
    vi.useFakeTimers();
    try {
      const token = createCandidateMagicLinkToken('cand_456', 'school_2');
      vi.advanceTimersByTime(31 * 60_000);
      expect(readCandidateToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is still valid comfortably within its 30-minute window', () => {
    vi.useFakeTimers();
    try {
      const token = createCandidateMagicLinkToken('cand_456', 'school_2');
      vi.advanceTimersByTime(10 * 60_000);
      expect(readCandidateToken(token)?.cid).toBe('cand_456');
    } finally {
      vi.useRealTimers();
    }
  });
});
