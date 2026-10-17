import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { checkRateLimit } from './rateLimit';

function reqFrom(ip: string) {
  return new NextRequest('http://localhost/api/test', {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('checkRateLimit', () => {
  it('allows requests up to the configured max', () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 100000)}`;
    const label = 'test-allow';
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit(reqFrom(ip), label, { max: 3, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the max within the window', () => {
    const ip = `10.0.1.${Math.floor(Math.random() * 100000)}`;
    const label = 'test-block';
    for (let i = 0; i < 3; i++) {
      checkRateLimit(reqFrom(ip), label, { max: 3, windowMs: 60_000 });
    }
    const fourth = checkRateLimit(reqFrom(ip), label, { max: 3, windowMs: 60_000 });
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('tracks separate IPs independently', () => {
    const label = 'test-separate';
    const a = checkRateLimit(reqFrom('10.0.2.1'), label, { max: 1, windowMs: 60_000 });
    const b = checkRateLimit(reqFrom('10.0.2.2'), label, { max: 1, windowMs: 60_000 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it('tracks separate labels independently for the same IP', () => {
    const ip = `10.0.3.${Math.floor(Math.random() * 100000)}`;
    const a = checkRateLimit(reqFrom(ip), 'label-a', { max: 1, windowMs: 60_000 });
    const b = checkRateLimit(reqFrom(ip), 'label-b', { max: 1, windowMs: 60_000 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});
