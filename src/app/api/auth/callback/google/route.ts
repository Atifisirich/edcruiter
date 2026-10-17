import { NextRequest, NextResponse } from 'next/server';
import { appOrigin, googleOAuthClient } from '@/lib/googleOAuth';
import { createSessionToken, OAUTH_STATE_COOKIE, SESSION_COOKIE } from '@/lib/session';

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

    const token = createSessionToken({
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
    });

    const res = NextResponse.redirect(`${origin}${safeNext}`);
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
