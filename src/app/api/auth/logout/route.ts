import { NextResponse } from 'next/server';
import { appOrigin } from '@/lib/googleOAuth';
import { SESSION_COOKIE } from '@/lib/session';

export async function GET() {
  const res = NextResponse.redirect(`${appOrigin()}/login`);
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
