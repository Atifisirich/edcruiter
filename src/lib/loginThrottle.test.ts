import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear, hit, isBlocked, resetAllForTests } from './loginThrottle';

beforeEach(() => {
  resetAllForTests();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('loginThrottle', () => {
  it('allows hits up to the limit, then refuses', () => {
    expect(hit('k', 3, 60_000)).toBe(true);
    expect(hit('k', 3, 60_000)).toBe(true);
    expect(hit('k', 3, 60_000)).toBe(true);
    expect(hit('k', 3, 60_000)).toBe(false);
  });

  it('reports blocked only once the limit is used up, and checking does not count', () => {
    for (let i = 0; i < 5; i++) expect(isBlocked('k', 3)).toBe(false);
    hit('k', 3, 60_000); hit('k', 3, 60_000);
    expect(isBlocked('k', 3)).toBe(false);
    hit('k', 3, 60_000);
    expect(isBlocked('k', 3)).toBe(true);
  });

  it('keeps names apart and forgets them when the window ends', () => {
    hit('a', 1, 60_000);
    expect(hit('a', 1, 60_000)).toBe(false);
    expect(hit('b', 1, 60_000)).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(isBlocked('a', 1)).toBe(false);
    expect(hit('a', 1, 60_000)).toBe(true);
  });

  it('clear() lets a name start again, as after a successful login', () => {
    hit('k', 1, 60_000);
    expect(isBlocked('k', 1)).toBe(true);
    clear('k');
    expect(isBlocked('k', 1)).toBe(false);
  });
});
