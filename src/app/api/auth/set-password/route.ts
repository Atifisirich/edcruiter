import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { completeSetPassword } from '@/lib/accountService';
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from '@/lib/session';
import { destinationAfterSignIn } from '@/lib/postLogin';

/**
 * Spends the link from a sign-up, reset or invitation email: sets the password,
 * then signs the person in so they do not have to type it straight back in.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'set-password', { max: 20, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again in a while.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  const result = await completeSetPassword(token, body?.password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { account } = result;
  const user = db.getUserByEmail(account.email);
  db.recordSignIn(account.email);

  const res = NextResponse.json({ ok: true, redirect: destinationAfterSignIn(user) });
  res.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: account.id, email: account.email, name: user?.name || account.name }),
    sessionCookieOptions()
  );
  return res;
}
