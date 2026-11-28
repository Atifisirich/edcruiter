import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { isHiringTeam } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { roundsFor } from '@/lib/reviewRounds';
import { matchRole } from '@/lib/payGuide';
import { mayDecidePay } from '@/lib/payFlow';
import { mayReview } from '@/lib/roundReview';
import { readOfferTerms, termLines } from '@/lib/offerTerms';

/**
 * Conditions agreed along with the salary (accommodation, PF, others).
 *
 *   GET   what is recorded
 *   POST  { accommodation, accommodation_note, pf, pf_note, other, include_in_letter }
 *
 * The same people who see the pay details: HR, the school admin, the
 * decision-maker for the role and the final round's reviewer.
 */
async function load(id: string) {
  const found = db.getCandidateByIdPublic(id);
  if (!found) return { error: NextResponse.json({ error: 'Candidate not found' }, { status: 404 }) } as const;
  const ctx = await requireSchoolAccess(found.school_id);
  const candidate = db.getCandidateById(ctx.schoolId, id);
  if (!candidate) return { error: NextResponse.json({ error: 'Candidate not found' }, { status: 404 }) } as const;
  const school = db.getSchoolById(ctx.schoolId);
  const role = matchRole(school?.pay_guide, candidate);
  const rounds = roundsFor(school, candidate);
  const final = rounds[rounds.length - 1];
  const allowed =
    isHiringTeam(ctx.role) ||
    (!!role && mayDecidePay(ctx.user, role)) ||
    (!!final && mayReview(ctx.user, candidate, final, db.getScheduledInterviewsByCandidate(ctx.schoolId, candidate.id)));
  if (!allowed) return { error: NextResponse.json({ error: 'Offer conditions are for the decision-maker, HR and the school admin.' }, { status: 403 }) } as const;
  return { ctx, candidate } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const l = await load(id);
    if ('error' in l) return l.error;
    return NextResponse.json({ terms: l.candidate.offer_terms ?? null });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the offer conditions.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const l = await load(id);
    if ('error' in l) return l.error;
    const { ctx, candidate } = l;
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'offer-terms', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many changes this hour. Try again shortly.' }, { status: 429 });

    const terms = readOfferTerms(await req.json().catch(() => ({})), ctx.user.name);
    db.updateCandidate(ctx.schoolId, id, { offer_terms: terms });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'OFFER_TERMS_SAVED',
      resource: `Candidate: ${candidate.name}`,
      details: termLines(terms).join('; ').slice(0, 500) || 'Conditions cleared.',
    });
    return NextResponse.json({ success: true, terms });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the offer conditions.' }, { status: 500 });
  }
}
