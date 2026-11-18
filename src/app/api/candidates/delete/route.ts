import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';

const MAX_PER_REQUEST = 500;

/**
 * Permanently deletes one or more candidates of a school, with everything
 * that belongs to them: stage results, recordings, CV, flags, messages.
 *
 * Only the school admin (or the platform owner in support mode) may do this;
 * HR and reviewers cannot. Each removed candidate gets its own line in the
 * school's activity log, with the name, so the school can see who was removed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const ids: string[] = Array.isArray(body.candidate_ids)
      ? [...new Set<string>(body.candidate_ids.filter((x: unknown): x is string => typeof x === 'string' && x.length > 0))]
      : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Choose at least one candidate.' }, { status: 400 });
    if (ids.length > MAX_PER_REQUEST) {
      return NextResponse.json({ error: `Delete at most ${MAX_PER_REQUEST} candidates at a time.` }, { status: 400 });
    }

    const deleted: string[] = [];
    const notFound: string[] = [];
    for (const id of ids) {
      // getCandidateById is scoped to this school, so another school's
      // candidate can never be deleted from here.
      const candidate = db.getCandidateById(ctx.schoolId, id);
      if (!candidate || !db.deleteCandidate(ctx.schoolId, id)) {
        notFound.push(id);
        continue;
      }
      deleted.push(id);
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'CANDIDATE_DELETED',
        resource: `Candidate: ${candidate.name}`,
        details: `Permanently deleted ${candidate.name} (${candidate.email || candidate.phone || id}) with their test results, recordings, CV and messages.`
      });
    }

    return NextResponse.json({ success: true, deleted, not_found: notFound });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not delete the candidates.' }, { status: 500 });
  }
}
