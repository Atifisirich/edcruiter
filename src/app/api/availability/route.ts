import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { accessOf, isHiringTeam } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import type { AvailabilitySlot } from '@/lib/types';
import { validateSlots } from '@/lib/availability';

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

/**
 * The times reviewers have said they are free. HR and the school admin see
 * everyone's open times (to book a candidate into one); a reviewer sees only
 * their own, open and booked.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const wanted = new URL(req.url).searchParams.get('user_id') || undefined;
    const now = new Date().toISOString();
    const hiring = isHiringTeam(ctx.role);
    const slots = db
      .getAvailabilitySlots(ctx.schoolId, { userId: hiring ? wanted : ctx.user.id, from: now })
      .filter((s) => (hiring ? s.status === 'open' : true));
    return NextResponse.json({ slots });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the free times.' }, { status: 500 });
  }
}

/** A reviewer adds the times they are free. Each is booked whole by HR. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id);
    if (accessOf(ctx.role) === 'hr') {
      return NextResponse.json({ error: 'Free times are added by the reviewer whose time it is.' }, { status: 403 });
    }
    const rl = checkRateLimit(req, 'availability', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const mine = db.getAvailabilitySlots(ctx.schoolId, { userId: ctx.user.id, from: new Date().toISOString() });
    const checked = validateSlots(body.slots, mine, new Date());
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    const made: AvailabilitySlot[] = checked.slots.map((s, i) => ({
      id: `slot_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: ctx.schoolId,
      user_id: ctx.user.id,
      user_name: ctx.user.name,
      start: s.start,
      end: s.end,
      status: 'open',
      created_at: new Date().toISOString(),
    }));
    db.addAvailabilitySlots(made);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'AVAILABILITY_ADDED',
      resource: `Free times: ${ctx.user.name}`,
      details: `Added ${made.length} free ${made.length === 1 ? 'time' : 'times'} for interviews.`,
    });
    return NextResponse.json({ slots: made }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the free times.' }, { status: 500 });
  }
}

/** A reviewer takes back a free time that nobody has booked. */
export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const id = new URL(req.url).searchParams.get('id') || '';
    const slot = db.getAvailabilitySlot(id);
    if (!slot || slot.school_id !== ctx.schoolId || slot.user_id !== ctx.user.id) {
      return NextResponse.json({ error: 'Free time not found.' }, { status: 404 });
    }
    if (slot.status === 'booked') {
      return NextResponse.json({ error: 'An interview is booked in this time. Ask HR to cancel or move it first.' }, { status: 409 });
    }
    db.deleteAvailabilitySlot(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not remove the free time.' }, { status: 500 });
  }
}
