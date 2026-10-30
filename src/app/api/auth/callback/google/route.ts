import { NextRequest, NextResponse } from 'next/server';
import { appOrigin, googleOAuthClient } from '@/lib/googleOAuth';
import { createSessionToken, OAUTH_STATE_COOKIE, SESSION_COOKIE } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const origin = appOrigin();
  const fail = (reason: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const saved = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !saved || state !== saved) {
    return fail('google_signin_failed');
  }

  const nextPath = decodeURIComponent(state.split(':').slice(1).join(':') || '/teacher');
  const safeNext = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/teacher';

  try {
    const client = googleOAuthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) {
      return fail('google_signin_failed');
    }
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return fail('google_signin_failed');
    }
    // Roles are looked up by email, so an email Google has not verified must
    // never be accepted — someone could otherwise claim an admin's address.
    if (payload.email_verified !== true) {
      return fail('google_signin_failed');
    }

    const token = createSessionToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
    });

    // The sign-in button always asks for the school-setup page, which only
    // makes sense for someone with no account yet. People who already have
    // one go straight to their own workspace.
    let destination = safeNext;
    if (safeNext === '/school/setup') {
      const existing = db.getUserByEmail(payload.email);
      if (existing) {
        destination =
          existing.role === 'SUPER_ADMIN' ? '/superadmin'
          : existing.role === 'REPORTING_MANAGER' ? '/reviewer/rm'
          : existing.role === 'INSTITUTE_HEAD' ? '/reviewer/ih'
          : existing.role === 'FINAL_DECISION_MAKER' ? '/reviewer/coo'
          : '/admin';
      }
    }

    const res = NextResponse.redirect(`${origin}${destination}`);
    res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch {
    return fail('google_signin_failed');
  }
}
