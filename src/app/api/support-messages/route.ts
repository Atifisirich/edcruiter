import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, getStaffContext, requireStaff } from '@/lib/auth';
import { getCandidateSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { cleanChat } from '@/lib/assistant';
import type { SupportMessage } from '@/lib/types';

/**
 * Help requests from the bot to the Edcruiter team.
 *   POST   { summary, messages, page }   anyone the bot serves sends one
 *   GET                                   the inbox (platform owner only)
 *   PATCH  { id, status?, note? }         mark resolved, keep a note (platform owner only)
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getStaffContext();
    const candidate = staff ? null : await getCandidateSession();
    if (!staff && !candidate) return NextResponse.json({ error: 'Sign in to send a message.' }, { status: 401 });

    const rl = checkRateLimit(req, 'support-message', { max: 8, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'You have sent several messages already. The team will reply soon.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const transcript = cleanChat(body.messages);
    const summary = (typeof body.summary === 'string' ? body.summary : '').replace(/\s+/g, ' ').trim().slice(0, 300)
      || transcript.find((t) => t.role === 'user')?.text.slice(0, 200) || '';
    if (!summary) return NextResponse.json({ error: 'Say what you need help with.' }, { status: 400 });

    const schoolId = staff ? staff.schoolId : candidate!.school_id;
    const school = schoolId ? db.getSchoolById(schoolId) : undefined;
    const cand = candidate ? db.getCandidateById(candidate.school_id, candidate.cid) : undefined;

    const message: SupportMessage = {
      id: `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: schoolId ?? null,
      school_name: school?.name,
      from: staff
        ? { kind: 'staff', name: staff.user.name, email: staff.user.email, role: staff.role }
        : { kind: 'candidate', name: cand?.name || 'Candidate', email: cand?.email },
      page: typeof body.page === 'string' ? body.page.slice(0, 120) : '',
      summary,
      transcript,
      status: 'new',
      created_at: new Date().toISOString(),
    };
    db.addSupportMessage(message);
    return NextResponse.json({ ok: true, id: message.id });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not send the message.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireStaff({ anyOf: ['SUPER_ADMIN'] });
    return NextResponse.json({ messages: db.getSupportMessages() });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the messages.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireStaff({ anyOf: ['SUPER_ADMIN'] });
    const body = await req.json().catch(() => ({}));
    if (typeof body.id !== 'string') return NextResponse.json({ error: 'id is required.' }, { status: 400 });
    const updates: Parameters<typeof db.updateSupportMessage>[1] = {};
    if (body.status === 'resolved') { updates.status = 'resolved'; updates.resolved_at = new Date().toISOString(); }
    if (body.status === 'new') { updates.status = 'new'; updates.resolved_at = undefined; }
    if (typeof body.note === 'string') updates.note = body.note.slice(0, 1000);
    const m = db.updateSupportMessage(body.id, updates);
    if (!m) return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    return NextResponse.json({ message: m });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not update the message.' }, { status: 500 });
  }
}
