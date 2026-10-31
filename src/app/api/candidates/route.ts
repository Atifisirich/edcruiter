import { NextRequest, NextResponse, after } from 'next/server';
import { warmPack } from '@/lib/ensurePack';
import { sendApplicationLinks, sendAssessmentInvite } from '@/lib/assessmentInvite';
import { db } from '@/lib/db';
import { Candidate } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { makeInviteCode } from '@/lib/inviteCode';
import { cleanGrades, segmentFromGrades } from '@/lib/grades';
import { authErrorResponse, auditAsStaff, getStaffContext, requireSchoolAccess, resolveSchoolId, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { CANDIDATE_COOKIE, createCandidateToken } from '@/lib/session';

/** Loosely-typed row shape a bulk-import spreadsheet row may arrive as. */
type BulkImportRow = Partial<Candidate> & { school_id?: string };

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branch_id') || undefined;
    const subject = searchParams.get('subject') || undefined;
    const segment = searchParams.get('segment') || undefined;
    const status = searchParams.get('status') || undefined;
    // Staff of that school only. There used to be an unauthenticated
    // ?invite_code= branch here that returned the full candidate record
    // (phone, email, DOB, salary, resume link) to anyone holding a code, with
    // no rate limit — and the code plus the returned ID is a complete login.
    // Magic links and /candidate/login replaced every use of it.
    const ctx = await requireSchoolAccess(searchParams.get('school_id'));
    const candidates = db.getCandidatesBySchool(ctx.schoolId, { branchId, subject, segment, status }).map((c) => ({
      ...c,
      // How far through the five-stage test they are, for the dashboard.
      stages_completed: new Set(db.getStageResultsByCandidate(ctx.schoolId, c.id).map((r) => r.stage_key)).size,
    }));
    return NextResponse.json({ candidates });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

function newCandidateId() {
  return `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch import (spreadsheet upload) is a staff action on behalf of
    // candidates who did not apply themselves — it requires both an
    // authenticated admin and an explicit attestation that the school holds
    // permission to contact this list, which is recorded per candidate.
    if (Array.isArray(body.candidates ?? body)) {
      const rows: BulkImportRow[] = Array.isArray(body) ? body : body.candidates;
      const schoolAttested = Boolean(body.school_attested ?? false);
      const requestedSchoolId = Array.isArray(body) ? rows[0]?.school_id : body.school_id;
      const ctx = await requireSchoolAccess(requestedSchoolId, { minRole: 'SCHOOL_ADMIN' });
      assertSchoolActive(ctx.schoolId);

      if (!schoolAttested) {
        return NextResponse.json(
          { error: 'Confirm that the school has permission to contact these candidates before importing.' },
          { status: 400 }
        );
      }

      const createdList: Candidate[] = [];
      let skipped = 0;
      for (const item of rows) {
        // A lead needs a name and some way to reach them. An email is not
        // required: a teacher with only a phone number is a normal lead.
        if (!item.name || (!item.email && !item.phone)) {
          skipped += 1;
          continue;
        }
        const newCand: Candidate = {
          id: newCandidateId(),
          school_id: ctx.schoolId,
          name: item.name,
          email: item.email || '',
          phone: item.phone || '',
          // Everything below is left exactly as the spreadsheet had it — or
          // blank — rather than filled in with a plausible-looking value.
          // The previous version defaulted missing salary, DOB, location,
          // relocation preference, languages and notice period to specific
          // realistic figures ('5.0 LPA', '1995-01-01', 'Hyderabad', …),
          // which looked like the candidate had supplied them and were
          // silently wrong whenever they hadn't. A blank field here means
          // the UI must show "Not provided", never invent a number.
          dob: item.dob || '',
          qualification: item.qualification || '',
          experience_band: item.experience_band || '',
          prior_org: item.prior_org || '',
          current_salary: item.current_salary || '',
          expected_salary: item.expected_salary || '',
          current_location: item.current_location || '',
          relocation_branches: item.relocation_branches || [],
          languages: item.languages || [],
          notice_period: item.notice_period || '',
          // These two are pipeline routing, not a personal fact about the
          // candidate — every candidate needs a subject/segment to enter
          // the assessment pipeline at all, so a real (if generic) value
          // here is a routing decision, not a fabricated biography.
          applied_segment: item.applied_segment || 'Secondary (Grades 9-10)',
          applied_subject: item.applied_subject || 'General',
          target_branch_id: item.target_branch_id || ctx.user.branch_id || 'branch_manneguda',
          video_intro_url: item.video_intro_url || '',
          reading_passage_text: item.reading_passage_text,
          status: 'in_progress',
          current_stage_key: 'identity_verification',
          invite_code: makeInviteCode(item.applied_subject),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        db.createCandidate(newCand);
        db.setConsent({
          candidate_id: newCand.id,
          channel: 'whatsapp',
          granted: true,
          source: 'school_attested',
          wording_version: 'bulk-import-v1',
          granted_at: new Date().toISOString()
        });
        createdList.push(newCand);
      }

      auditAsStaff(ctx, ctx.schoolId, {
        action: 'CANDIDATES_BULK_IMPORTED',
        resource: `${createdList.length} candidates`,
        details: 'Imported via spreadsheet with school-attested contact permission.'
      });

      // Write each subject's test now, so it is ready when the candidates open their links.
      const wanted = new Map<string, { subject: string; segment: string }>();
      createdList.forEach((c) => wanted.set(`${c.applied_subject}|${c.applied_segment}`, { subject: c.applied_subject, segment: c.applied_segment }));
      const schoolForWarm = ctx.schoolId;
      after(async () => {
        for (const w of wanted.values()) await warmPack(schoolForWarm, w.subject, w.segment);
      });

      return NextResponse.json({ success: true, count: createdList.length, skipped, candidates: createdList }, { status: 201 });
    }

    // Single-candidate creation. Two distinct callers land here:
    //   - a real applicant on the public job board, with no session at all;
    //   - a signed-in school admin using "+ Add Candidate" on their own
    //     dashboard.
    // The second case used to trust whatever school_id the client sent —
    // which the admin dashboard hardcoded to the seeded demo school's id
    // rather than the admin's own — so a candidate added by hand landed in
    // a tenant the admin could never see and looked like it was silently
    // dropped. When a staff session exists, their real school always wins
    // over anything the request claims; only a true anonymous applicant's
    // supplied school_id is trusted, exactly as the public apply flow needs.
    const staffCtx = await getStaffContext();
    if (!staffCtx) {
      const rl = checkRateLimit(req, 'candidate-apply', { max: 10, windowMs: 60 * 60_000 });
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many applications from this connection. Try again later.' }, { status: 429 });
      }
    }

    const {
      school_id: requestedSchoolId = SLOKA_SCHOOL_ID,
      name,
      email,
      phone,
      dob,
      qualification,
      experience_band,
      prior_org,
      current_salary,
      expected_salary,
      current_location,
      relocation_branches,
      languages,
      notice_period,
      applied_segment: requestedSegment,
      applied_grades: requestedGrades,
      applied_subject,
      target_branch_id,
      video_intro_url,
      reading_passage_text,
      reading_passage_score,
      whatsapp_consent,
      school_attested,
      send_invite
    } = body;

    // When exact grades are given, they decide the segment text, so the two can never disagree.
    const applied_grades = cleanGrades(requestedGrades);
    const applied_segment = applied_grades.length ? segmentFromGrades(applied_grades) : requestedSegment;

    if (!name || !email || !applied_subject || !applied_segment) {
      return NextResponse.json({ error: 'Name, email, subject and segment are required' }, { status: 400 });
    }

    // A staff caller's own school always wins over the request body — see
    // the comment above. An anonymous applicant has no staff session, so
    // resolveSchoolId is skipped and their supplied school_id (or the
    // default) is used as-is.
    const school_id = staffCtx ? resolveSchoolId(staffCtx, requestedSchoolId) : requestedSchoolId;

    // Public applications only go to a school that exists and has been approved
    // — otherwise applicants (and their personal data) pile up against a school
    // nobody is reviewing, or one that does not exist at all.
    assertSchoolActive(school_id);

    const newCandidate: Candidate = {
      id: newCandidateId(),
      school_id,
      name,
      email,
      phone: phone || '',
      // Left blank rather than defaulted to a plausible-looking value
      // ('B.Ed.', 'Fresher', '0', 'Immediate', …) when the caller didn't
      // provide it — the UI shows "Not provided" for an empty string.
      dob: dob || '',
      qualification: qualification || '',
      experience_band: experience_band || '',
      prior_org: prior_org || '',
      current_salary: current_salary || '',
      expected_salary: expected_salary || '',
      current_location: current_location || '',
      relocation_branches: relocation_branches || [],
      languages: languages || [],
      notice_period: notice_period || '',
      applied_segment,
      ...(applied_grades.length ? { applied_grades } : {}),
      applied_subject,
      target_branch_id: target_branch_id || staffCtx?.user.branch_id || undefined,
      video_intro_url: video_intro_url || '',
      reading_passage_text,
      reading_passage_score,
      invite_code: makeInviteCode(applied_subject),
      status: 'in_progress',
      current_stage_key: 'identity_verification',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.createCandidate(newCandidate);
    after(() => warmPack(newCandidate.school_id, newCandidate.applied_subject, newCandidate.applied_segment));

    // Consent is recorded either way, so a "no" is durable and auditable —
    // only a "yes" allows WhatsApp sends later. A school adding a lead by hand
    // vouches for it the same way a spreadsheet import does: the school
    // confirms it has permission to contact this person.
    const attestedByStaff = Boolean(staffCtx) && school_attested === true;
    db.setConsent({
      candidate_id: newCandidate.id,
      channel: 'whatsapp',
      granted: attestedByStaff || Boolean(whatsapp_consent),
      source: attestedByStaff ? 'school_attested' : 'apply_form',
      wording_version: attestedByStaff ? 'staff-add-v1' : 'apply-form-v1',
      granted_at: new Date().toISOString()
    });

    if (staffCtx) {
      auditAsStaff(staffCtx, school_id, {
        action: 'CANDIDATE_ADDED_BY_STAFF',
        resource: `Candidate: ${newCandidate.name}`,
        details: `Added directly by staff for ${newCandidate.applied_subject} (${newCandidate.applied_segment}).`
      });
    } else {
      db.addAuditLog({
        id: `audit_${Date.now()}`,
        school_id,
        actor_id: newCandidate.id,
        actor_name: newCandidate.name,
        actor_role: 'SCHOOL_ADMIN',
        action: 'CANDIDATE_REGISTERED',
        resource: `Candidate: ${newCandidate.name}`,
        details: `Completed identity & eligibility capture for ${newCandidate.applied_subject} (${newCandidate.applied_segment}).`,
        timestamp: new Date().toISOString()
      });
    }

    // An applicant from the job portal is signed in on this browser only. Send
    // them the link back in, so closing the tab or switching phone does not lose it.
    if (!staffCtx) {
      after(async () => {
        const school = db.getSchoolById(newCandidate.school_id);
        if (school) await sendApplicationLinks(school, newCandidate);
      });
    }

    // A school that asked for it gets the test invite sent straight away, from
    // its own WhatsApp number, using the approved template. The candidate is
    // created either way; this only reports what happened with the invite.
    let invite: { sent: boolean; reason?: string; detail?: string } | undefined;
    if (staffCtx && send_invite === true) {
      const school = db.getSchoolById(school_id);
      if (!attestedByStaff) {
        invite = { sent: false, reason: 'no_consent' };
      } else if (!newCandidate.phone) {
        invite = { sent: false, reason: 'no_phone' };
      } else if (!school?.whatsapp_hiring || school.whatsapp_hiring.status === 'not_connected') {
        invite = { sent: false, reason: 'not_connected' };
      } else {
        const result = await sendAssessmentInvite(school, newCandidate).catch(() => null);
        invite = result?.ok
          ? { sent: true }
          : { sent: false, reason: result && !result.ok ? result.reason : 'graph_error', detail: result && !result.ok ? result.detail : undefined };
        auditAsStaff(staffCtx, school_id, {
          action: 'WHATSAPP_INVITE',
          resource: newCandidate.name,
          details: result?.ok ? 'Invite sent when the candidate was added.' : `Invite not sent: ${invite.reason}${invite.detail ? ` (${invite.detail})` : ''}.`
        });
      }
    }

    const res = NextResponse.json({ candidate: newCandidate, ...(invite ? { invite } : {}) }, { status: 201 });

    // Only issue the candidate's own session when the applicant themselves
    // filled this in — an admin using "+ Add Candidate" from their own
    // dashboard keeps their own staff session; overwriting their browser's
    // candidate cookie with a session for someone else's newly-created
    // record served no purpose and could only confuse a later /candidate/
    // visit in the same browser.
    if (!staffCtx) {
      const token = createCandidateToken({ cid: newCandidate.id, school_id: newCandidate.school_id });
      res.cookies.set(CANDIDATE_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 3,
      });
    }
    return res;
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await requireSchoolAccess(searchParams.get('school_id'), { minRole: 'SCHOOL_ADMIN' });
    const candidateId = searchParams.get('candidate_id');

    if (!candidateId) {
      return NextResponse.json({ error: 'candidate_id parameter required' }, { status: 400 });
    }

    const success = db.deleteCandidate(ctx.schoolId, candidateId);
    if (!success) {
      return NextResponse.json({ error: 'Candidate not found or failed to delete' }, { status: 404 });
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'CANDIDATE_DELETED',
      resource: `Candidate: ${candidateId}`,
      details: 'Deleted candidate and associated records.'
    });

    return NextResponse.json({ success: true, deleted_id: candidateId });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}
