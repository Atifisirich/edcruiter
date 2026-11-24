import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { accessOf } from '@/lib/permissions';
import { potOf, parsePayGuide } from '@/lib/payGuide';
import { roleDefFor } from '@/lib/roles';

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

/** Who can take a final call: reviewers and the school admins. */
function deciders(schoolId: string) {
  const school = db.getSchoolById(schoolId);
  return db
    .getUsersBySchool(schoolId)
    .filter((u) => (accessOf(u.role) === 'reviewer' || accessOf(u.role) === 'admin') && u.role !== 'SUPER_ADMIN')
    .map((u) => ({ id: u.id, name: u.name, role_name: roleDefFor(school, u).name }));
}

/**
 * The school's Pay Guide, for management (the school admin) to read and set:
 * job roles by grades and subject, their pay tiers, top-ups, campus ranges, the
 * pot, and who takes the final call. Also what each pot has used so far.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    const guide = school?.pay_guide ?? { roles: [] };
    const candidates = db.getCandidatesBySchool(ctx.schoolId);
    const pending = candidates.filter((c) => c.final_offer?.status === 'pending_approval').map((c) => ({ id: c.id, name: c.name, offer: c.final_offer }));
    return NextResponse.json({
      guide,
      pots: Object.fromEntries(guide.roles.map((r) => [r.id, potOf(r, candidates)])),
      pending,
      subjects: school?.subjects ?? [],
      branches: (school?.branches ?? []).map((b) => ({ id: b.id, name: b.name })),
      people: deciders(ctx.schoolId),
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the Pay Guide.' }, { status: 500 });
  }
}

/** Saves the Pay Guide. School admin only. */
export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    const body = await req.json().catch(() => null);
    const parsed = parsePayGuide(body?.guide, {
      subjects: school.subjects ?? [],
      branchIds: (school.branches ?? []).map((b) => b.id),
      deciderIds: deciders(ctx.schoolId).map((p) => p.id),
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = db.updateSchool(ctx.schoolId, { pay_guide: parsed.guide });
    if (!updated) return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'PAY_GUIDE_UPDATED',
      resource: `School: ${updated.name}`,
      details: `Pay Guide now has ${parsed.guide.roles.length} ${parsed.guide.roles.length === 1 ? 'role' : 'roles'}: ${parsed.guide.roles.map((r) => r.name).join(', ') || 'none'}.`,
    });
    const candidates = db.getCandidatesBySchool(ctx.schoolId);
    return NextResponse.json({ guide: parsed.guide, pots: Object.fromEntries(parsed.guide.roles.map((r) => [r.id, potOf(r, candidates)])) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save the Pay Guide.' }, { status: 500 });
  }
}
