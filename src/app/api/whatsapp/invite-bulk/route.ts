import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { sendAssessmentInvite } from '@/lib/assessmentInvite';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_PER_CALL = 500;

/**
 * Sends the test invite to a list of candidates (typically the ones just
 * imported from an ad-lead spreadsheet). One at a time, in order, stopping at
 * Meta's daily limit: everyone after that point is reported as "waiting" and
 * simply keeps no invite timestamp, so calling again tomorrow with the same
 * list sends only to those who never got one.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);

    const rl = checkRateLimit(req, 'whatsapp-invite-bulk', { max: 10, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many bulk sends this hour. Try again shortly.' }, { status: 429 });
    }

    const ids: string[] = Array.isArray(body.candidate_ids) ? body.candidate_ids.map(String) : [];
    if (ids.length === 0) return NextResponse.json({ error: 'candidate_ids is required.' }, { status: 400 });
    if (ids.length > MAX_PER_CALL) {
      return NextResponse.json({ error: `Send at most ${MAX_PER_CALL} invites at a time.` }, { status: 400 });
    }

    const school = db.getSchoolById(ctx.schoolId);
    if (!school?.whatsapp_hiring || school.whatsapp_hiring.status === 'not_connected') {
      return NextResponse.json({ error: 'Connect a WhatsApp number first (WhatsApp hiring line).' }, { status: 400 });
    }

    const summary = { sent: 0, already_invited: 0, no_phone: 0, no_consent: 0, waiting_for_daily_limit: 0, failed: 0 };
    let firstFailure: string | undefined;
    let limitReached = false;

    for (const id of ids) {
      const candidate = db.getCandidateById(ctx.schoolId, id);
      if (!candidate) continue;
      if (candidate.whatsapp_invite_sent_at && body.resend !== true) { summary.already_invited++; continue; }
      if (!candidate.phone) { summary.no_phone++; continue; }
      if (limitReached) { summary.waiting_for_daily_limit++; continue; }

      const result = await sendAssessmentInvite(school, candidate).catch(() => null);
      if (result?.ok) { summary.sent++; continue; }
      if (result && !result.ok && result.reason === 'no_consent') { summary.no_consent++; continue; }
      if (result && !result.ok && result.reason === 'rate_limited') { limitReached = true; summary.waiting_for_daily_limit++; continue; }
      summary.failed++;
      if (!firstFailure) firstFailure = result && !result.ok ? (result.detail || result.reason) : 'Could not reach WhatsApp.';
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'WHATSAPP_INVITE_BULK',
      resource: `${ids.length} candidates`,
      details: `Sent ${summary.sent}; already invited ${summary.already_invited}; no phone ${summary.no_phone}; no consent ${summary.no_consent}; waiting for daily limit ${summary.waiting_for_daily_limit}; failed ${summary.failed}${firstFailure ? ` (${firstFailure})` : ''}.`
    });

    return NextResponse.json({ success: true, summary, first_failure: firstFailure });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not send the invites' }, { status: 500 });
  }
}
