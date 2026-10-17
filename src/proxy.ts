import { NextRequest, NextResponse } from 'next/server';
import { readSessionToken, readCandidateToken, SESSION_COOKIE, CANDIDATE_COOKIE } from '@/lib/session';

/**
 * Page-level gate. This is a convenience that keeps a signed-out visitor from
 * staring at an empty admin shell — it is NOT the security boundary. Every API
 * route re-checks access itself (see src/lib/auth.ts), because a proxy check
 * can be bypassed by calling the API directly and must never be the only lock
 * on tenant data.
 */

const STAFF_PREFIXES = ['/admin', '/superadmin', '/reviewer', '/school/setup'];
const CANDIDATE_PREFIX = '/candidate/';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STAFF_PREFIXES.some((p) => pathname.startsWith(p))) {
    const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = new URL('/login', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  // /candidate/login is the public login page itself, not a per-candidate
  // page — without this exclusion its own "login" segment gets read as a
  // candidate id, the (correctly missing) session never matches it, and the
  // gate redirects to /candidate/login, which runs straight into the same
  // check again: an infinite redirect loop, not a login page.
  if (pathname.startsWith(CANDIDATE_PREFIX) && pathname !== '/candidate/login') {
    const candidateId = pathname.slice(CANDIDATE_PREFIX.length).split('/')[0];
    const session = readCandidateToken(request.cookies.get(CANDIDATE_COOKIE)?.value);
    // Not signed in as this candidate: send to login, preserving where they meant to go.
    if (!session || session.cid !== candidateId) {
      const url = new URL('/candidate/login', request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/superadmin/:path*', '/reviewer/:path*', '/school/setup/:path*', '/candidate/:path*'],
};
