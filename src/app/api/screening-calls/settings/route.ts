import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { callPriceOf, parseScreeningSettings, sarvamEnv, screeningSettingsOf } from '@/lib/screeningCall';
import { callUsageThisMonth } from '@/lib/screeningCallService';

/**
 * A school's AI screening call settings: its questions, whether new applicants
 * are called automatically, the price per answered call, this month's usage,
 * and whether real calls are switched on for the platform (or it is in demo).
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'));
    const school = db.getSchoolById(ctx.schoolId);
    const usage = callUsageThisMonth(ctx.schoolId);
    return NextResponse.json({
      settings: screeningSettingsOf(school),
      custom: !!school?.screening_call,
      price_inr: callPriceOf(school),
      mode: sarvamEnv() ? 'live' : 'demo',
      usage: ctx.isSuperAdmin ? usage : { calls: usage.calls, amount_inr: usage.amount_inr },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the call settings.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const parsed = parseScreeningSettings(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = db.updateSchool(ctx.schoolId, { screening_call: parsed.settings });
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'SCREENING_CALL_SETTINGS_UPDATED',
      resource: `School: ${updated.name}`,
      details: `${parsed.settings.questions.length} screening questions; automatic calls for new applicants ${parsed.settings.auto_call_on_apply ? 'on' : 'off'}.`,
    });
    return NextResponse.json({ settings: parsed.settings });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the call settings.' }, { status: 500 });
  }
}
