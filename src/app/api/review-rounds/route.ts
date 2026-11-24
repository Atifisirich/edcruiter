import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { MAX_ROUNDS, parseRounds, roundsOf } from '@/lib/reviewRounds';
import { roleDefFor, rolesOf } from '@/lib/roles';
import { actsAsManagement } from '@/lib/permissions';

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

/**
 * The school's review rounds and roles, and who is asking, so a page can show
 * each person only the decisions they may take. Any signed-in member may read it.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req));
    const school = db.getSchoolById(ctx.schoolId);
    const def = roleDefFor(school, ctx.user);
    return NextResponse.json({
      rounds: roundsOf(school),
      branch_rounds: school?.branch_review_rounds ?? {},
      branches: (school?.branches ?? []).map((b) => ({ id: b.id, name: b.name })),
      roles: rolesOf(school),
      max: MAX_ROUNDS,
      me: { id: ctx.user.id, name: ctx.user.name, role: ctx.role, role_id: def.id, role_name: def.name, also_management: actsAsManagement(ctx.user) },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the review rounds.' }, { status: 500 });
  }
}

/** Saves the school's review rounds. School admin only. */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

    const body = await req.json().catch(() => null);

    // "Use the school's standard flow" for one campus: drop its own flow.
    if (body?.reset === true && typeof body?.branch_id === 'string') {
      const rest = { ...(school.branch_review_rounds ?? {}) };
      delete rest[body.branch_id];
      const cleared = db.updateSchool(ctx.schoolId, { branch_review_rounds: rest });
      if (!cleared) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'REVIEW_ROUNDS_UPDATED',
        resource: `School: ${cleared.name}`,
        details: `${school.branches?.find((b) => b.id === body.branch_id)?.name ?? 'A campus'} now follows the school's standard review rounds.`,
      });
      return NextResponse.json({ rounds: roundsOf(cleared), branch_rounds: rest });
    }

    const parsed = parseRounds(body?.rounds, rolesOf(school));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // One campus's own flow, or the school's standard flow.
    const branchId = typeof body?.branch_id === 'string' ? body.branch_id : '';
    if (branchId && !school.branches?.some((b) => b.id === branchId)) {
      return NextResponse.json({ error: 'That campus was not found.' }, { status: 400 });
    }
    const branchName = school.branches?.find((b) => b.id === branchId)?.name;
    const updated = branchId
      ? db.updateSchool(ctx.schoolId, { branch_review_rounds: { ...(school.branch_review_rounds ?? {}), [branchId]: parsed.rounds } })
      : db.updateSchool(ctx.schoolId, { review_rounds: parsed.rounds });
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'REVIEW_ROUNDS_UPDATED',
      resource: `School: ${updated.name}`,
      details: `Review rounds${branchName ? ` for ${branchName}` : ''} are now: ${parsed.rounds.map((r) => r.name).join(', ')}.`,
    });
    return NextResponse.json({ rounds: parsed.rounds, branch_rounds: updated.branch_review_rounds ?? {} });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the review rounds.' }, { status: 500 });
  }
}
