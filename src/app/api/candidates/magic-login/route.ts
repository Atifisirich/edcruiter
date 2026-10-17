import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appOrigin } from '@/lib/googleOAuth';
import { CANDIDATE_COOKIE, createCandidateToken, readCandidateToken } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * The actual reason a candidate has to retype an identifier + invite code
 * every time isn't that two factors are wrong — a code alone would be a
 * ~1.7M-combination secret with no second check, worse than what exists now.
 * The real problem was that the WhatsApp invite's button never logged
 * anyone in at all: it linked straight to /candidate/[id], which the
 * candidate gate then bounced to a login screen with nothing pre-filled —
 * so *every* click, not just a lost-device recovery, demanded the manual
 * flow.
 *
 * This route is what a WhatsApp (or email) button should link to instead: a
 * short-lived, single-purpose token that logs the candidate in the moment
 * they tap it, no typing required. It deliberately expires in 30 minutes —
 * short enough that a screenshotted or forwarded WhatsApp message stops
 * being useful quickly — and on success mints a normal-duration session
 * cookie for the rest of their visit, rather than reusing the link token
 * itself as that cookie. The identifier+code screen remains exactly as
 * strict as before for the case this doesn't cover: a new device, or a link
 * that's gone stale.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin();
  const token = req.nextUrl.searchParams.get('token');

  // Public by design (that's the whole point of a tap-to-login link), so
  // this is the one route in the app an unauthenticated caller can hit
  // freely — forging a valid token isn't feasible (it's HMAC-signed), but
  // there's no reason to let it be hammered with garbage values either.
  const rl = checkRateLimit(req, 'magic-login', { max: 30, windowMs: 5 * 60_000 });
  if (!rl.allowed) {
    return NextResponse.redirect(`${origin}/candidate/login?error=link_expired`);
  }

  const session = readCandidateToken(token || undefined);
  if (!session) {
    return NextResponse.redirect(`${origin}/candidate/login?error=link_expired`);
  }

  const candidate = db.getCandidateById(session.school_id, session.cid);
  if (!candidate) {
    return NextResponse.redirect(`${origin}/candidate/login?error=link_expired`);
  }

  const sessionToken = createCandidateToken({ cid: candidate.id, school_id: candidate.school_id });
  const res = NextResponse.redirect(`${origin}/candidate/${candidate.id}`);
  res.cookies.set(CANDIDATE_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 3,
  });
  return res;
}
