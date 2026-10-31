import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto';

/**
 * Password hashing with scrypt from Node's own crypto, so there is no extra
 * dependency to keep patched. The cost settings are stored inside each hash,
 * which means they can be raised later without locking anyone out: old hashes
 * keep verifying with the settings they were made under.
 */

const COST = { N: 1 << 15, r: 8, p: 3 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, keyLength, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function maxMemory(N: number, r: number) {
  // scrypt needs about 128 * N * r bytes; allow double so the limit never trips on it.
  return 128 * N * r * 2;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, KEY_LENGTH, { ...COST, maxmem: maxMemory(COST.N, COST.r) });
  return ['scrypt', COST.N, COST.r, COST.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const parts = (stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 2 || r < 1 || p < 1) return false;
  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (!salt.length || !expected.length) return false;
    const actual = await derive(password, salt, expected.length, { N, r, p, maxmem: maxMemory(N, r) });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Burns about the same time as a real check. Used when there is no such account,
 * so the response time does not reveal whether an email is registered.
 */
export async function spendTimeLikeAPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', '12345678', '123456789', '1234567890',
  '11111111', '00000000', 'qwerty123', 'qwertyuiop', 'abcd1234', 'abc12345', 'iloveyou', 'welcome1',
  'welcome123', 'admin123', 'letmein1', 'school123', 'teacher123', 'edcruiter', 'edcruiter123', 'india123',
  'changeme', 'asdfghjkl', 'zxcvbnm123', 'monkey123', 'dragon123',
]);

/** Returns a message the person can act on, or null when the password is acceptable. */
export function passwordProblem(password: string, email?: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess.';
  if (/^(.)\1+$/.test(password)) return 'Do not use one character repeated.';
  const local = (email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'Do not use your email address in your password.';
  if (/^\d+$/.test(password)) return 'Add some letters or symbols, not only numbers.';
  return null;
}

export { isValidEmail, normalizeEmail } from './emailAddress';
