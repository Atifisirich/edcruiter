import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, User } from './types';

const accounts: Account[] = [];
const users: User[] = [];
vi.mock('./db', () => ({
  db: {
    getAccountByEmail: (e: string) => accounts.find((a) => a.email === e.trim().toLowerCase()),
    createAccount: (a: Account) => { accounts.push(a); return a; },
    updateAccount: (id: string, u: Partial<Account>) => {
      const a = accounts.find((x) => x.id === id);
      if (a) Object.assign(a, u);
      return a;
    },
    getUserByEmail: (e: string) => users.find((u) => u.email.toLowerCase() === e.trim().toLowerCase()),
  },
}));

import { authenticate, completeSetPassword, setPasswordLinkFor } from './accountService';

function tokenFrom(link: string): string {
  return decodeURIComponent(new URL(link).searchParams.get('token') || '');
}

beforeEach(() => {
  process.env.AUTH_SECRET = 'test-secret-for-account-tests-1234567890';
  accounts.length = 0;
  users.length = 0;
});

describe('choosing a password from an emailed link', () => {
  it('creates a verified account for a new email', async () => {
    const link = setPasswordLinkFor('Radhika@School.edu', 'Radhika Rao', 'signup');
    expect(link).toContain('/reset-password?token=');
    expect(link).toContain('mode=signup');

    const result = await completeSetPassword(tokenFrom(link), 'plum-train-42');
    expect(result.ok).toBe(true);
    expect(accounts).toHaveLength(1);
    expect(accounts[0].email).toBe('radhika@school.edu');
    expect(accounts[0].name).toBe('Radhika Rao');
    expect(accounts[0].email_verified_at).toBeTruthy();
    expect(accounts[0].password_hash).not.toContain('plum-train-42');
  });

  it('works only once: the same link cannot be used to set a password again', async () => {
    const token = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup'));
    expect((await completeSetPassword(token, 'plum-train-42')).ok).toBe(true);
    const again = await completeSetPassword(token, 'another-pass-77');
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(410);
    expect(accounts).toHaveLength(1);
  });

  it('a reset link changes the password and stops the old one working', async () => {
    const first = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup'));
    await completeSetPassword(first, 'plum-train-42');

    const reset = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'reset'));
    expect((await completeSetPassword(reset, 'new-river-88')).ok).toBe(true);
    expect(await authenticate('a@school.edu', 'plum-train-42')).toBeNull();
    expect(await authenticate('a@school.edu', 'new-river-88')).not.toBeNull();
  });

  it('an older reset link dies once a newer password is set', async () => {
    await completeSetPassword(tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup')), 'plum-train-42');
    const oldLink = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'reset'));
    await completeSetPassword(tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'reset')), 'new-river-88');
    const result = await completeSetPassword(oldLink, 'attacker-pass-9');
    expect(result.ok).toBe(false);
  });

  it('rejects a weak password without using up the link', async () => {
    const token = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup'));
    const weak = await completeSetPassword(token, 'short');
    expect(weak.ok).toBe(false);
    if (!weak.ok) expect(weak.status).toBe(400);
    expect(accounts).toHaveLength(0);
    expect((await completeSetPassword(token, 'plum-train-42')).ok).toBe(true);
  });

  it('rejects a tampered, empty or wrong-purpose token', async () => {
    const token = tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup'));
    const [payload] = token.split('.');
    expect((await completeSetPassword(`${payload}.forged`, 'plum-train-42')).ok).toBe(false);
    expect((await completeSetPassword('', 'plum-train-42')).ok).toBe(false);

    const { createPurposeToken } = await import('./session');
    const other = createPurposeToken('something_else', { email: 'a@school.edu', pf: 'none' }, 600);
    expect((await completeSetPassword(other, 'plum-train-42')).ok).toBe(false);
  });

  it('an invited colleague keeps the name the admin gave them', async () => {
    users.push({ id: 'u1', school_id: 's1', name: 'Dr. Anita Rao', email: 'anita@school.edu', role: 'REPORTING_MANAGER' });
    const token = tokenFrom(setPasswordLinkFor('anita@school.edu', '', 'invite'));
    await completeSetPassword(token, 'plum-train-42');
    expect(accounts[0].name).toBe('Dr. Anita Rao');
  });
});

describe('authenticate', () => {
  beforeEach(async () => {
    await completeSetPassword(tokenFrom(setPasswordLinkFor('a@school.edu', 'A', 'signup')), 'plum-train-42');
  });

  it('accepts the right password, whatever the email capitalisation', async () => {
    const account = await authenticate('  A@School.EDU ', 'plum-train-42');
    expect(account?.email).toBe('a@school.edu');
  });

  it('refuses a wrong password, an unknown email and non-text input', async () => {
    expect(await authenticate('a@school.edu', 'plum-train-43')).toBeNull();
    expect(await authenticate('nobody@school.edu', 'plum-train-42')).toBeNull();
    expect(await authenticate('a@school.edu', undefined)).toBeNull();
    expect(await authenticate(undefined, 'plum-train-42')).toBeNull();
  });
});
