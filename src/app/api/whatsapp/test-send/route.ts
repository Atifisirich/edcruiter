import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveCredentials, sendHelloWorld, WhatsAppConfigError } from '@/lib/whatsappClient';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Step 5 of the connect wizard: sends Meta's built-in hello_world template to
 * a number the admin types in, so they see a real message land before any
 * candidate invite ever goes out. Kept separate from the candidate-facing
 * send path in whatsappClient so a misconfigured test can never touch a
 * real applicant.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const rl = checkRateLimit(req, 'whatsapp-test-send', { max: 10, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many test sends this hour.' }, { status: 429 });
    }

    const to = String(body.to || '').trim();
    if (!to) {
      return NextResponse.json({ error: 'Enter a phone number to test with.' }, { status: 400 });
    }

    const school = db.getSchoolById(ctx.schoolId);
    if (!school?.whatsapp_hiring) {
      return NextResponse.json({ error: 'Save and verify WhatsApp credentials first.' }, { status: 400 });
    }

    let creds;
    try {
      creds = resolveCredentials(school);
    } catch (e) {
      return NextResponse.json({ error: e instanceof WhatsAppConfigError ? e.message : 'Not configured.' }, { status: 400 });
    }

    const result = await sendHelloWorld(creds, to);

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'WHATSAPP_TEST_SENT',
      resource: `WhatsApp test → ${to}`,
      details: result.ok ? `Sent, wamid ${result.waMessageId}.` : `Failed: ${result.title}`
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.title }, { status: 502 });
    }
    return NextResponse.json({ ok: true, wa_message_id: result.waMessageId });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to send test message' }, { status: 500 });
  }
}
