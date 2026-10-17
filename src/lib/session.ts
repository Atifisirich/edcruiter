import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'edcruiter_session';
export const OAUTH_STATE_COOKIE = 'edcruiter_oauth_state';
export const CANDIDATE_COOKIE = 'edcruiter_candidate';

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  exp: number;
};

/**
 * A candidate's own session. Deliberately narrow: it carries the single
 * application it grants access to, so possession of the cookie can never be
 * used to read another candidate's record.
 */
export type CandidateSession = {
  cid: string;
  school_id: string;
  exp: number;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set');
  }
  return secret;
}

function sign(value: string) {
  return createHmac('sha256', authSecret()).update(value).digest('base64url');
}

export function createSessionToken(user: Omit<SessionUser, 'exp'>, maxAgeSec = 60 * 60 * 24 * 7) {
  const payload: SessionUser = { ...user, exp: Math.floor(Date.now() / 1000) + maxAgeSec };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionUser;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.email || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function newOAuthState() {
  return randomBytes(16).toString('hex');
}

/**
 * Signs a candidate session token the same way as the staff session: an
 * HMAC-SHA256-signed, base64url payload with an expiry, checked with a
 * constant-time comparison so cookie forgery and timing attacks both fail.
 */
export function createCandidateToken(session: Omit<CandidateSession, 'exp'>, maxAgeSec = 60 * 60 * 24 * 3) {
  const payload: CandidateSession = { ...session, exp: Math.floor(Date.now() / 1000) + maxAgeSec };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Mints the short-lived token a WhatsApp/email invite button links to
 * (see /api/candidates/magic-login). 30 minutes: long enough to click a
 * message shortly after it arrives, short enough that a forwarded or
 * screenshotted WhatsApp message stops being useful quickly. On successful
 * use the magic-login route issues a normal 3-day session cookie — this
 * token is never itself persisted as one.
 */
export function createCandidateMagicLinkToken(candidateId: string, schoolId: string): string {
  return createCandidateToken({ cid: candidateId, school_id: schoolId }, 30 * 60);
}

export function readCandidateToken(token: string | undefined): CandidateSession | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CandidateSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.cid || !payload.school_id) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCandidateSession() {
  const jar = await cookies();
  return readCandidateToken(jar.get(CANDIDATE_COOKIE)?.value);
}
