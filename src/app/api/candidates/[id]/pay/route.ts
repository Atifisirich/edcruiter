import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { isAdmin, isHiringTeam } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { currentRound, roundsFor } from '@/lib/reviewRounds';
import { matchRole, rangeFor, validMonthly, yearsOf, potOf } from '@/lib/payGuide';
import { buildFinalOffer, mayDecidePay, notifyPayApproval, notifyPayDecided, payInfoFor } from '@/lib/payFlow';
import { mayReview } from '@/lib/roundReview';

/**
 * The final call on one candidate.
 *
 *   GET   what the decision-maker sees: their role, the range for this
 *         teacher's years, what the teacher asked for and earns now, the pot.
 *   POST  { action: 'offer', monthly, reason? }   the decision-maker (or the admin) offers a salary
 *         { action: 'approve' | 'refuse', note? } the school admin answers an offer outside the range or pot
 *         { action: 'counter', note, amount? }    note what the teacher said back
 *
 * An offer above the highest pay for the tier, or that breaks the pot, is held
 * for the school admin. Who acted comes from the session.
 */
async function load(req: NextRequest, id: string) {
  const found = db.getCandidateByIdPublic(id);
  if (!found) return { error: NextResponse.json({ error: 'Candidate not found' }, { status: 404 }) } as const;
  const ctx = await requireSchoolAccess(found.school_id);
  const candidate = db.getCandidateById(ctx.schoolId, id);
  if (!candidate) return { error: NextResponse.json({ error: 'Candidate not found' }, { status: 404 }) } as const;
  const school = db.getSchoolById(ctx.schoolId);
  const users = db.getUsersBySchool(ctx.schoolId);
  void req;
  return { ctx, candidate, school, users } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const l = await load(req, id);
    if ('error' in l) return l.error;
    const { ctx, candidate, school, users } = l;
    const info = payInfoFor(school, candidate, users);
    const role = matchRole(school?.pay_guide, candidate);
    const rounds = roundsFor(school, candidate);
    const final = rounds[rounds.length - 1];
    const allowed =
      isHiringTeam(ctx.role) ||
      (!!role && mayDecidePay(ctx.user, role)) ||
      (!!final && mayReview(ctx.user, candidate, final, db.getScheduledInterviewsByCandidate(ctx.schoolId, candidate.id)));
    if (!allowed) return NextResponse.json({ error: 'The pay details are for the decision-maker, HR and the school admin.' }, { status: 403 });
    return NextResponse.json({
      info,
      can_decide: !!role && mayDecidePay(ctx.user, role),
      can_approve: isAdmin(ctx.role),
      can_note: isHiringTeam(ctx.role) || (!!role && mayDecidePay(ctx.user, role)),
      // The review at the final round, which the offer needs (see POST): approve, not approve, or none yet.
      final_review: (final && candidate.round_reviews?.[final.id]?.recommendation) || null,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the pay details.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const l = await load(req, id);
    if ('error' in l) return l.error;
    const { ctx, candidate, school, users } = l;
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'final-offer', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const role = matchRole(school?.pay_guide, candidate);
    if (!role) return NextResponse.json({ error: 'No pay role in the Pay Guide fits this teacher yet. Ask the school admin to add one.' }, { status: 409 });
    const respond = (extra: Record<string, unknown> = {}) => {
      const fresh = db.getCandidateById(ctx.schoolId, id) ?? candidate;
      return NextResponse.json({ success: true, candidate: fresh, info: payInfoFor(school, fresh, users), ...extra });
    };

    // ---- The decision-maker makes an offer
    if (body.action === 'offer') {
      if (!mayDecidePay(ctx.user, role)) return NextResponse.json({ error: `Only ${role.decider_user_id ? 'the decision-maker for this role' : 'the school admin'} can set the offer.` }, { status: 403 });
      const rounds = roundsFor(school, candidate);
      const now = currentRound(candidate, rounds);
      const final = rounds[rounds.length - 1];
      if (!final || now?.id !== final.id) return NextResponse.json({ error: 'The offer is set at the final round, once the teacher has reached it.' }, { status: 409 });
      const closed = candidate.status === 'rejected' || !!candidate.rejected_by_school_at || !!candidate.rejected_by_candidate_at;
      if (closed) return NextResponse.json({ error: 'This teacher is not moving forward.' }, { status: 409 });
      const review = candidate.round_reviews?.[final.id];
      if (review?.recommendation === 'not_approve') return NextResponse.json({ error: 'You did not approve this teacher, so there is no offer to make. HR will decide what happens next.' }, { status: 409 });
      if (!review && !isAdmin(ctx.role)) return NextResponse.json({ error: 'Give your review of this teacher first. Then set the offer.' }, { status: 409 });

      const monthly = validMonthly(body.monthly);
      if (monthly === null) return NextResponse.json({ error: 'Enter the salary as rupees a month, for example 32000.' }, { status: 400 });
      const range = rangeFor(role, candidate);
      const pot = potOf(role, db.getCandidatesBySchool(ctx.schoolId, { notResponding: 'include' }), candidate.id);
      const { offer, check } = buildFinalOffer({ monthly, reason: body.reason, role, range, years: yearsOf(candidate).years, pot, by: ctx.user, previous: candidate.final_offer });
      if ((check.over_range || check.over_pot) && (offer.reason ?? '').length < 5) {
        return NextResponse.json({ error: `This is outside what the Pay Guide allows. ${check.needs_approval.join(' ')} Write why, and the school admin will be asked to approve it.` }, { status: 400 });
      }
      db.updateCandidate(ctx.schoolId, id, { final_offer: offer });
      const told = offer.status === 'pending_approval' ? notifyPayApproval(ctx.schoolId, candidate, offer, check.needs_approval) : [];
      auditAsStaff(ctx, ctx.schoolId, {
        action: offer.status === 'approved' ? 'FINAL_OFFER_SET' : 'FINAL_OFFER_NEEDS_APPROVAL',
        resource: `Candidate: ${candidate.name} (${role.name})`,
        details: `₹${monthly.toLocaleString('en-IN')} a month against ₹${range.min.toLocaleString('en-IN')} to ₹${range.max.toLocaleString('en-IN')} (${range.tier_label}).${offer.reason ? ` Reason: ${offer.reason}` : ''}`,
      });
      return respond({ waiting_for_admin: offer.status === 'pending_approval', told_admins: told });
    }

    // ---- The school admin answers an offer that went outside the range or pot
    if (body.action === 'approve' || body.action === 'refuse') {
      if (!isAdmin(ctx.role)) return NextResponse.json({ error: 'Only the school admin can approve an offer outside the Pay Guide.' }, { status: 403 });
      const o = candidate.final_offer;
      if (!o || o.status !== 'pending_approval') return NextResponse.json({ error: 'There is no offer waiting for approval.' }, { status: 409 });
      const approved = body.action === 'approve';
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
      const next = { ...o, status: approved ? ('approved' as const) : ('refused' as const), approved_by: ctx.user.name, approved_at: new Date().toISOString(), ...(note ? { approval_note: note } : {}) };
      db.updateCandidate(ctx.schoolId, id, { final_offer: next });
      notifyPayDecided(ctx.schoolId, candidate, next, approved, ctx.user.name, note || undefined);
      auditAsStaff(ctx, ctx.schoolId, {
        action: approved ? 'FINAL_OFFER_APPROVED' : 'FINAL_OFFER_REFUSED',
        resource: `Candidate: ${candidate.name} (${o.role_name})`,
        details: `₹${o.monthly.toLocaleString('en-IN')} a month.${note ? ` ${note}` : ''}`,
      });
      return respond();
    }

    // ---- A note of what the teacher said back
    if (body.action === 'counter') {
      if (!isHiringTeam(ctx.role) && !mayDecidePay(ctx.user, role)) return NextResponse.json({ error: 'Only the decision-maker, HR or the school admin can add this note.' }, { status: 403 });
      const o = candidate.final_offer;
      if (!o) return NextResponse.json({ error: 'There is no offer yet to add a note to.' }, { status: 409 });
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
      if (note.length < 3) return NextResponse.json({ error: 'Write what the teacher said.' }, { status: 400 });
      const amount = body.amount === undefined || body.amount === '' ? undefined : validMonthly(body.amount) ?? undefined;
      const counters = [...(o.counters ?? []), { at: new Date().toISOString(), by: ctx.user.name, note, ...(amount ? { amount } : {}) }];
      db.updateCandidate(ctx.schoolId, id, { final_offer: { ...o, counters } });
      return respond();
    }

    return NextResponse.json({ error: 'That action is not recognised.' }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the offer.' }, { status: 500 });
  }
}
