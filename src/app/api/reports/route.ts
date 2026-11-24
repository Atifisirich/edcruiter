import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { buildReport, RANGE_DAYS, type ReportRange } from '@/lib/managementReport';
import { roleDefFor } from '@/lib/roles';
import { potOf } from '@/lib/payGuide';
import { accessOf } from '@/lib/permissions';

/**
 * The management report: what came in, what was sent, how far candidates got,
 * the interviews, the reviewers, and what it all saved. For the school admin.
 *
 *   GET ?school_id=…&range=7|30|90|all
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ctx = await requireSchoolAccess(url.searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const school = db.getSchoolById(ctx.schoolId);
    const wanted = url.searchParams.get('range') as ReportRange | null;
    const range: ReportRange = wanted && wanted in RANGE_DAYS ? wanted : '30';
    const days = RANGE_DAYS[range];
    const now = new Date();
    const since = days ? new Date(now.getTime() - days * 86_400_000) : null;

    const candidates = db.getCandidatesBySchool(ctx.schoolId);
    const origin: Record<string, 'school' | 'self'> = {};
    for (const c of candidates) origin[c.id] = db.getConsent(c.id, 'whatsapp')?.source === 'school_attested' ? 'school' : 'self';

    const users = db.getUsersBySchool(ctx.schoolId);
    const reviewers = users
      .filter((u) => accessOf(u.role) === 'reviewer')
      .map((u) => ({ id: u.id, name: u.name, role_name: roleDefFor(school, u).name }));

    const report = buildReport({
      candidates,
      stageResults: db.getStageResultsBySchool(ctx.schoolId),
      interviews: db.getScheduledInterviewsBySchool(ctx.schoolId),
      whatsapp: db.getWhatsAppMessagesBySchool(ctx.schoolId),
      calls: db.getScreeningCallsBySchool(ctx.schoolId),
      origin,
      reviewers,
      since,
      hourlyCostInr: school?.hr_hourly_cost_inr,
      now,
    });
    // What each pay role has spent against its pot, and what is waiting for the admin.
    const pay = (school?.pay_guide?.roles ?? []).map((r) => {
      const offers = candidates.filter((c) => c.final_offer?.role_id === r.id);
      return {
        id: r.id,
        name: r.name,
        pot: potOf(r, candidates),
        approved: offers.filter((c) => c.final_offer?.status === 'approved' && !c.rejected_by_candidate_at).length,
        waiting: offers.filter((c) => c.final_offer?.status === 'pending_approval').length,
        average_monthly: (() => {
          const done = offers.filter((c) => c.final_offer?.status === 'approved' && !c.rejected_by_candidate_at);
          return done.length ? Math.round(done.reduce((n, c) => n + (c.final_offer?.monthly ?? 0), 0) / done.length) : null;
        })(),
      };
    });
    return NextResponse.json({ range, report, pay, school_name: school?.name ?? '' });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not build the report.' }, { status: 500 });
  }
}
