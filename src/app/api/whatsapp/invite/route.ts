import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { sendTemplateMessage } from '@/lib/whatsappClient';
import { checkRateLimit } from '@/lib/rateLimit';
import { createCandidateMagicLinkToken } from '@/lib/session';

/**
 * Sends the assessment_invite template to a candidate at this school.
 *
 * The previous version sent free-form `type: 'text'` to any phone number and
 * any link supplied in the request body, with no auth and no consent check —
 * an unauthenticated caller could make the school's number message anyone
 * with any link, billed to the school's Meta account. This version:
 *   - requires a signed-in staff session scoped to the school,
 *   - only ever messages a real candidate record at that school,
 *   - only ever links to that candidate's own assessment page,
 *   - and only sends when consent has been recorded.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const rl = checkRateLimit(req, 'whatsapp-invite', { max: 100, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Invite rate limit reached for this hour. Try again shortly.' }, { status: 429 });
    }

    const candidateId = String(body.candidate_id || '').trim();
    if (!candidateId) {
      return NextResponse.json({ error: 'candidate_id is required.' }, { status: 400 });
    }

    const candidate = db.getCandidateById(ctx.schoolId, candidateId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found at this school.' }, { status: 404 });
    }
    if (!candidate.phone) {
      return NextResponse.json({ error: 'This candidate has no phone number on file.' }, { status: 400 });
    }

    const school = db.getSchoolById(ctx.schoolId);
    if (!school?.whatsapp_hiring || school.whatsapp_hiring.status === 'not_connected') {
      return NextResponse.json({ error: 'Connect a school WhatsApp number first.' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://edcruiter.ai';
    const code = candidate.invite_code || candidate.id;

    // The button parameter is the only dynamic piece of a WhatsApp template
    // URL button — Meta appends it to whatever base URL was registered for
    // this template. That base must be registered as
    // "<origin>/api/candidates/magic-login?token=" so the full link becomes
    // .../magic-login?token=<this>. Tapping it logs the candidate in and
    // lands them straight on their assessment — previously this param was
    // just the bare candidate id, which pointed at a page requiring a
    // session that clicking the link never created, so every tap still
    // demanded the manual identifier+code screen.
    const magicToken = createCandidateMagicLinkToken(candidate.id, candidate.school_id);

    const result = await sendTemplateMessage({
      school,
      candidateId: candidate.id,
      toRaw: candidate.phone,
      template: 'assessment_invite',
      bodyParams: [candidate.name, school.name, candidate.applied_subject, code],
      buttonParam: magicToken
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'WHATSAPP_INVITE',
      resource: candidate.name,
      details: result.ok
        ? `Invite sent, wamid ${result.waMessageId}.`
        : `Invite not sent: ${result.reason}${result.detail ? ` (${result.detail})` : ''}.`
    });

    if (!result.ok) {
      const status = result.reason === 'no_consent' ? 403 : result.reason === 'rate_limited' ? 429 : 502;
      return NextResponse.json({ success: false, reason: result.reason, error: result.detail || result.reason }, { status });
    }

    return NextResponse.json({
      success: true,
      wa_message_id: result.waMessageId,
      to: candidate.phone,
      assessment_url: `${origin}/candidate/${candidate.id}`
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not send WhatsApp invite' }, { status: 500 });
  }
}
