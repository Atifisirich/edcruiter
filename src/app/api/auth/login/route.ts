import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { clear, hit, isBlocked } from '@/lib/loginThrottle';
import { authenticate } from '@/lib/accountService';
import { normalizeEmail } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { destinationAfterSignIn } from '@/lib/postLogin';

const MAX_WRONG_PER_EMAIL = 10;
const LOCK_WINDOW_MS = 15 * 60_000;

/** Staff sign-in with an email and password. Google sign-in is separate (/api/auth/google). */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'login', { max: 30, windowMs: LOCK_WINDOW_MS });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!email || typeof body?.password !== 'string' || !body.password) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  // Counted by email, not just by IP, so changing address does not reset the guessing.
  const key = `login:${email}`;
  if (isBlocked(key, MAX_WRONG_PER_EMAIL)) {
    return NextResponse.json(
      { error: 'Too many wrong passwords. Wait 15 minutes, or choose "Forgot password" to set a new one.' },
      { status: 429 }
    );
  }

  const account = await authenticate(email, body.password);
  if (!account) {
    hit(key, MAX_WRONG_PER_EMAIL, LOCK_WINDOW_MS);
    return NextResponse.json({ error: 'The email or password is not right.' }, { status: 401 });
  }
  clear(key);

  const user = db.getUserByEmail(account.email);
  db.recordSignIn(account.email);

  const res = NextResponse.json({ ok: true, redirect: destinationAfterSignIn(user, body?.next) });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: account.id, email: account.email, name: user?.name || account.name }),
    sessionCookieOptions()
  );
  return res;
}
