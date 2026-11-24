import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { HIRING_TEAM } from '@/lib/permissions';
import { moveLead, requeue, setLead } from '@/lib/leadActions';
import { leadListView } from '@/lib/leadListView';
import { notifyCandidateDeclined } from '@/lib/candidateOutcome';
import { sarvamEnv } from '@/lib/screeningCall';

/**
 * HR acting on several people on a lead list at once.
 *   POST { school_id, action, lead_ids }
 *     move       → into Candidates (and the test link, if the list sends it)
 *     set_aside  → put aside, kept on the list's report
 *     recall     → back in the calling queue (for example everyone with no answer)
 *     decline    → a polite "not this time" message, once, for people set aside
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { anyOf: HIRING_TEAM });
    assertSchoolActive(ctx.schoolId);
    const list = db.getLeadList(ctx.schoolId, id);
    if (!list) return NextResponse.json({ error: 'List not found.' }, { status: 404 });
    const ids = new Set<string>(Array.isArray(body.lead_ids) ? body.lead_ids.filter((x: unknown): x is string => typeof x === 'string') : []);
    const people = db.getLeadsOfList(ctx.schoolId, id).filter((c) => ids.has(c.id));
    if (!people.length) return NextResponse.json({ error: 'Choose at least one person.' }, { status: 400 });
    let done = 0;
    let note = '';

    if (body.action === 'move') {
      let invited = 0;
      for (const c of people) {
        if (c.lead?.status === 'moved') continue;
        const fresh = db.getCandidateById(ctx.schoolId, c.id);
        if (!fresh) continue;
        const r = await moveLead(fresh, list, { invite: list.on_good_fit === 'move_and_invite', demo: !sarvamEnv() });
        done++;
        if (r.invited) invited++;
      }
      note = list.on_good_fit === 'move_and_invite' ? ` The test link went to ${invited} of them.` : '';
    } else if (body.action === 'set_aside') {
      for (const c of people) {
        if (c.lead?.status === 'moved' || c.lead?.status === 'calling') continue;
        setLead(c, 'set_aside', { text: `Set aside by ${ctx.user.name}`, key: 'set aside by hr' });
        done++;
      }
    } else if (body.action === 'recall') {
      done = requeue(people);
      if (done && list.status === 'done') db.updateLeadList(ctx.schoolId, id, { status: 'paused' });
    } else if (body.action === 'decline') {
      for (const c of people.filter((p) => p.lead?.status === 'set_aside')) {
        const r = await notifyCandidateDeclined(ctx.schoolId, c.id).catch(() => undefined);
        if (r && (r.whatsapp || r.email)) done++;
      }
      note = done < people.length ? ` ${people.length - done} could not be told (no WhatsApp consent, no usable email, or already told).` : '';
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }

    const word = { move: 'Moved to Candidates', set_aside: 'Set aside', recall: 'Put back in the calling queue', decline: 'Sent a polite decline to' }[body.action as 'move'];
    auditAsStaff(ctx, ctx.schoolId, { action: `LEADS_${String(body.action).toUpperCase()}`, resource: `Lead list: ${list.name}`, details: `${word}: ${done} ${done === 1 ? 'person' : 'people'}.` });
    return NextResponse.json({ done, message: `${word}: ${done} ${done === 1 ? 'person' : 'people'}.${note}`, view: leadListView(ctx.schoolId, db.getLeadList(ctx.schoolId, id) ?? list) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not do that.' }, { status: 500 });
  }
}
