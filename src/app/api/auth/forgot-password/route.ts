import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { hit } from '@/lib/loginThrottle';
import { isValidEmail, normalizeEmail } from '@/lib/password';
import { emailIsConfigured } from '@/lib/emailClient';
import { sendSetPasswordEmail } from '@/lib/accountEmails';

/**
 * Emails a link to choose a new password. The answer is the same whether or not
 * the address is registered, so this form cannot be used to find out who has an
 * account. Someone who only ever signed in with Google, or was invited but never
 * set a password, gets the same kind of link and so can add a password this way.
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'forgot-password', { max: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again in a while.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'production' && !emailIsConfigured()) {
    return NextResponse.json(
      { error: 'Password reset by email is not available right now. Please continue with Google instead.' },
      { status: 503 }
    );
  }

  const account = db.getAccountByEmail(email);
  const user = db.getUserByEmail(email);
  if ((account || user) && hit(`mail:${email}`, 3, 60 * 60_000)) {
    const sent = await sendSetPasswordEmail({
      to: email,
      name: account?.name || user?.name || '',
      kind: account ? 'reset' : 'signup',
    });
    if (!sent.ok && sent.reason === 'not_configured' && sent.devLink) {
      return NextResponse.json({ ok: true, devLink: sent.devLink });
    }
  }
  return NextResponse.json({ ok: true });
}
