import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireStaff, authErrorResponse, resolveSchoolId } from '@/lib/auth';
import { CANDIDATE_COOKIE, createCandidateToken } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Candidate login is two-factor: the identifier (email/phone/application ID)
 * plus the invite_code issued at application time and delivered over
 * WhatsApp/email. Either alone is guessable or semi-public; both together is a
 * real shared secret without standing up an SMS/email OTP provider.
 *
 * Deliberately looks up the identifier across every school rather than one
 * passed in (or defaulted) by the client — this page is public and
 * unauthenticated, so there is no session to trust a school_id from, and a
 * candidate has no way to know which internal school_id their application
 * lives under anyway. This used to default to the seeded demo school's id
 * when the client didn't send one, which meant any candidate who applied to
 * a different school could never log in here no matter how correct their ID
 * and invite code were — the lookup was silently scoped to someone else's
 * candidate list. The invite_code is what keeps a global-by-identifier
 * lookup safe: an attacker still needs both factors to match one real
 * record, same as before.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, 'candidate-login', { max: 8, windowMs: 5 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
    }

    const body = await req.json();
    const { identifier, invite_code } = body;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return NextResponse.json({ error: 'Enter your mobile number or email.' }, { status: 400 });
    }
    if (!invite_code || typeof invite_code !== 'string' || !invite_code.trim()) {
      return NextResponse.json({ error: 'Enter your application ID. It is in the WhatsApp message or email we sent you.' }, { status: 400 });
    }

    const matched = db.findCandidateByIdentifierAndCode(identifier.trim(), invite_code.trim());

    // Deliberately identical response whether the identifier or the code was
    // wrong, and no candidate data of any kind is returned on failure — the
    // previous version listed four other applicants' names and phone numbers
    // to anyone who mistyped their own details.
    if (!matched) {
      return NextResponse.json(
        { success: false, error: 'Those details did not match an application. Check your mobile number or email and your application ID.' },
        { status: 401 }
      );
    }

    const token = createCandidateToken({ cid: matched.id, school_id: matched.school_id });
    const res = NextResponse.json({ success: true, redirectUrl: `/candidate/${matched.id}` });
    res.cookies.set(CANDIDATE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 3,
    });
    return res;
  } catch (error) {
    console.error('Candidate login error:', error);
    return NextResponse.json({ error: 'Server error during candidate login.' }, { status: 500 });
  }
}

/** Staff-only: was previously handing out 5 candidates' contact details with no auth at all. */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await requireStaff();
    const schoolId = resolveSchoolId(ctx, searchParams.get('school_id'));
    const candidates = db.getCandidatesBySchool(schoolId);

    return NextResponse.json({
      success: true,
      candidates: candidates.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        applied_subject: c.applied_subject,
        applied_segment: c.applied_segment,
        current_stage_key: c.current_stage_key || 'identity_verification'
      }))
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch candidate logins' }, { status: 500 });
  }
}
