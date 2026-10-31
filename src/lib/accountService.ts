import { createHash } from 'crypto';
import { db } from './db';
import { appOrigin } from './googleOAuth';
import { createPurposeToken, readPurposeToken } from './session';
import { hashPassword, normalizeEmail, passwordProblem, spendTimeLikeAPasswordCheck, verifyPassword } from './password';
import type { Account } from './types';

/**
 * Email-and-password accounts.
 *
 * The password is chosen only AFTER the person has proved they own the email, by
 * opening a link we sent there. That order is deliberate. If sign-up took a
 * password straight away, someone could register a stranger's email with a
 * password they know, and the stranger would later confirm it and hand over the
 * account. Here the only thing an outsider can cause is an email asking the
 * owner to choose their own password, which is harmless.
 *
 * One kind of link serves three jobs: finishing sign-up, resetting a forgotten
 * password, and accepting an invitation to a school. They differ only in wording
 * and in how long they last.
 */

export type PasswordLinkKind = 'signup' | 'reset' | 'invite';

const PURPOSE = 'set_password';
const LINK_LIFETIME_SEC: Record<PasswordLinkKind, number> = {
  signup: 24 * 60 * 60,
  reset: 60 * 60,
  invite: 7 * 24 * 60 * 60,
};

/**
 * A short fingerprint of the password the account has right now ("none" when it
 * has no account yet). It travels inside the link, so the moment a password is
 * set the link stops matching and cannot be used a second time.
 */
export function passwordFingerprint(hash: string | undefined): string {
  return hash ? createHash('sha256').update(hash).digest('hex').slice(0, 16) : 'none';
}

export function setPasswordLinkFor(emailRaw: string, name: string, kind: PasswordLinkKind): string {
  const email = normalizeEmail(emailRaw);
  const token = createPurposeToken(
    PURPOSE,
    { email, name: name.trim().slice(0, 120), pf: passwordFingerprint(db.getAccountByEmail(email)?.password_hash) },
    LINK_LIFETIME_SEC[kind]
  );
  return `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}&mode=${kind}`;
}

export type SetPasswordResult =
  | { ok: true; account: Account }
  | { ok: false; status: 400 | 410; error: string };

/** Spends a link from setPasswordLinkFor: checks it, then creates the account or changes its password. */
export async function completeSetPassword(token: string, password: unknown): Promise<SetPasswordResult> {
  const data = readPurposeToken(token, PURPOSE);
  if (!data?.email) {
    return { ok: false, status: 410, error: 'This link has expired or was already used. Ask for a new one.' };
  }
  if (typeof password !== 'string') {
    return { ok: false, status: 400, error: 'Enter a password.' };
  }
  const problem = passwordProblem(password, data.email);
  if (problem) return { ok: false, status: 400, error: problem };

  const existing = db.getAccountByEmail(data.email);
  if (passwordFingerprint(existing?.password_hash) !== data.pf) {
    return { ok: false, status: 410, error: 'This link has expired or was already used. Ask for a new one.' };
  }

  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  if (existing) {
    const updated = db.updateAccount(existing.id, { password_hash: hash, password_changed_at: now, email_verified_at: existing.email_verified_at || now });
    return { ok: true, account: updated ?? existing };
  }

  const user = db.getUserByEmail(data.email);
  const account = db.createAccount({
    id: `acct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: data.email,
    name: data.name || user?.name || data.email.split('@')[0],
    password_hash: hash,
    email_verified_at: now,
    created_at: now,
  });
  return { ok: true, account };
}

/** Checks an email and password. Takes the same time whether or not the email is registered. */
export async function authenticate(emailRaw: unknown, password: unknown): Promise<Account | null> {
  const email = normalizeEmail(emailRaw);
  const attempt = typeof password === 'string' ? password : '';
  const account = email ? db.getAccountByEmail(email) : undefined;
  if (!account) {
    await spendTimeLikeAPasswordCheck(attempt);
    return null;
  }
  return (await verifyPassword(attempt, account.password_hash)) ? account : null;
}
