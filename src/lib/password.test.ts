import { describe, expect, it } from 'vitest';
import { hashPassword, isValidEmail, normalizeEmail, passwordProblem, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batter', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('never stores the password and salts every hash differently', async () => {
    const a = await hashPassword('same-password-1');
    const b = await hashPassword('same-password-1');
    expect(a).not.toContain('same-password-1');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password-1', a)).toBe(true);
    expect(await verifyPassword('same-password-1', b)).toBe(true);
  });

  it('treats a missing or damaged stored hash as a failed check, not a crash', async () => {
    expect(await verifyPassword('anything', undefined)).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', 'scrypt$x$y$z$a$b')).toBe(false);
  });

  it('gives the same hash for the same text typed in composed or decomposed form', async () => {
    const hash = await hashPassword('café-password');
    expect(await verifyPassword('café-password', hash)).toBe(true);
  });
});

describe('passwordProblem', () => {
  it('asks for at least 8 characters', () => {
    expect(passwordProblem('short1')).toMatch(/at least 8/);
    expect(passwordProblem('longenough1')).toBeNull();
  });

  it('refuses very common passwords, repeated characters and all-digit passwords', () => {
    expect(passwordProblem('Password123')).toMatch(/too common/);
    expect(passwordProblem('aaaaaaaaaa')).toMatch(/repeated/);
    expect(passwordProblem('48392015738')).toMatch(/not only numbers/);
  });

  it('refuses a password built from the email name', () => {
    expect(passwordProblem('radhika-2026-x', 'radhika@school.edu')).toMatch(/email/);
    expect(passwordProblem('plum-train-42', 'radhika@school.edu')).toBeNull();
  });

  it('puts a ceiling on length so a huge input cannot be used to burn CPU', () => {
    expect(passwordProblem('x1'.repeat(70))).toMatch(/at most 128/);
  });
});

describe('email helpers', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmail('  Radhika@School.EDU ')).toBe('radhika@school.edu');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });

  it('accepts normal addresses and rejects obvious junk', () => {
    expect(isValidEmail('a@b.in')).toBe(true);
    expect(isValidEmail('first.last+tag@sub.school.edu')).toBe(true);
    expect(isValidEmail('no-at-sign')).toBe(false);
    expect(isValidEmail('two@@signs.com')).toBe(false);
    expect(isValidEmail('space in@x.com')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
});
