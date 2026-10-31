import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rateLimit';
import { hit } from '@/lib/loginThrottle';
import { isValidEmail, normalizeEmail } from '@/lib/password';
import { emailIsConfigured } from '@/lib/emailClient';
import { sendSetPasswordEmail } from '@/lib/accountEmails';

/**
 * Step one of creating an account: take a name and an email and send a link to
 * that address. The password is chosen on the other side of the link, once the
 * person has shown they own the email (see accountService.ts for why).
 */
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, 'signup', { max: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Please try again in a while.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const email = normalizeEmail(body?.email);
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'production' && !emailIsConfigured()) {
    return NextResponse.json(
      { error: 'Sign-up by email is not available right now. Please continue with Google instead.' },
      { status: 503 }
    );
  }

  if (db.getAccountByEmail(email)) {
    return NextResponse.json(
      { error: 'You already have an account with this email. Log in instead, or use "Forgot password" if you cannot remember it.', code: 'account_exists' },
      { status: 409 }
    );
  }

  // A cap per address so this form cannot be used to flood someone's inbox.
  if (!hit(`mail:${email}`, 3, 60 * 60_000)) {
    return NextResponse.json(
      { error: 'We already emailed this address a few times. Check your inbox and spam folder, then try again in an hour.' },
      { status: 429 }
    );
  }

  const sent = await sendSetPasswordEmail({ to: email, name, kind: 'signup' });
  if (!sent.ok) {
    if (sent.reason === 'not_configured' && sent.devLink) {
      return NextResponse.json({ ok: true, devLink: sent.devLink });
    }
    return NextResponse.json({ error: 'We could not send the email. Please try again in a moment.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
