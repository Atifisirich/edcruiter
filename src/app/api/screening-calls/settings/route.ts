import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { pricePerMinuteOf, parseScreeningSettings, sarvamEnv, screeningSettingsOf } from '@/lib/screeningCall';
import { callUsageThisMonth, ensureRetrySweeper } from '@/lib/screeningCallService';
import type { School } from '@/lib/types';

/**
 * A school's AI screening call settings: its questions, who is called and when,
 * what happens after, its limits, the price per answered call, this month's
 * usage, and whether real calls are switched on for the platform (or demo).
 * The platform owner also sees and sets the price and the owner's monthly limit.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'));
    ensureRetrySweeper();
    const school = db.getSchoolById(ctx.schoolId);
    const usage = callUsageThisMonth(ctx.schoolId);
    return NextResponse.json({
      settings: screeningSettingsOf(school),
      custom: !!school?.screening_call,
      price_per_min_inr: pricePerMinuteOf(school),
      owner_cap_inr: school?.screening_call_owner_cap_inr || 0,
      is_owner: ctx.isSuperAdmin,
      subjects: school?.subjects ?? [],
      mode: sarvamEnv() ? 'live' : 'demo',
      usage: ctx.isSuperAdmin ? usage : { calls: usage.calls, minutes: usage.minutes, amount_inr: usage.amount_inr },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the call settings.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(new URL(req.url).searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const body = await req.json().catch(() => null);
    const parsed = parseScreeningSettings(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updates: Partial<School> = { screening_call: parsed.settings };
    // Only the platform owner sets the price and the owner's limit.
    if (ctx.isSuperAdmin && body?.owner && typeof body.owner === 'object') {
      const price = Number(body.owner.price_per_min_inr);
      const cap = Number(body.owner.owner_cap_inr);
      if (Number.isFinite(price) && price >= 0 && price <= 1000) updates.screening_call_price_per_min_inr = Math.round(price * 100) / 100;
      if (Number.isFinite(cap) && cap >= 0 && cap <= 10_000_000) updates.screening_call_owner_cap_inr = Math.round(cap);
    }
    const updated = db.updateSchool(ctx.schoolId, updates);
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    const s = parsed.settings;
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'SCREENING_CALL_SETTINGS_UPDATED',
      resource: `School: ${updated.name}`,
      details: `${s.questions.length} main questions, ${Object.keys(s.sets).length} posts with their own; automatic calls ${s.auto_call_on_apply ? 'on' : 'off'}; acting on results ${s.rules.enabled ? 'on' : 'off'}; monthly limit ${s.limits.monthly_cap_inr ? `₹${s.limits.monthly_cap_inr}` : 'none'}.`,
    });
    return NextResponse.json({
      settings: s,
      price_per_min_inr: pricePerMinuteOf(updated),
      owner_cap_inr: updated.screening_call_owner_cap_inr || 0,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the call settings.' }, { status: 500 });
  }
}
