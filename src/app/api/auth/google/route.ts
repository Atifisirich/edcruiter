import { NextRequest, NextResponse } from 'next/server';
import { googleAuthUrl } from '@/lib/googleOAuth';
import { newOAuthState, OAUTH_STATE_COOKIE } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const nextPath = request.nextUrl.searchParams.get('next') || '/teacher';
    const state = `${newOAuthState()}:${encodeURIComponent(nextPath)}`;
    const url = googleAuthUrl(state);
    const res = NextResponse.redirect(url);
    res.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth is not configured';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
