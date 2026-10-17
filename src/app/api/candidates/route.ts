import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Candidate } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { makeInviteCode } from '@/lib/inviteCode';
import { authErrorResponse, auditAsStaff, getStaffContext, requireSchoolAccess, resolveSchoolId } from '@/lib/auth';
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
    const invite = searchParams.get('invite_code');

    // The invite_code lookup is how a fresh WhatsApp link resolves before any
    // session exists, so it stays unauthenticated — but it may only ever
    // return the single matching candidate, never the school's full list.
    if (invite) {
      const schoolId = searchParams.get('school_id') || SLOKA_SCHOOL_ID;
      const all = db.getCandidatesBySchool(schoolId);
      const match = all.find(
        (c) => (c.invite_code || '').toUpperCase() === invite.trim().toUpperCase() || c.id === invite.trim()
      );
      return NextResponse.json({ candidate: match || null, candidates: match ? [match] : [] });
    }

    // Every other read is the school's candidate list — staff of that school only.
    const ctx = await requireSchoolAccess(searchParams.get('school_id'));
    const candidates = db.getCandidatesBySchool(ctx.schoolId, { branchId, subject, segment, status });
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

      if (!schoolAttested) {
        return NextResponse.json(
          { error: 'Confirm that the school has permission to contact these candidates before importing.' },
          { status: 400 }
        );
      }

      const createdList: Candidate[] = [];
      for (const item of rows) {
        if (!item.name || !item.email) continue;
        const newCand: Candidate = {
          id: newCandidateId(),
          school_id: ctx.schoolId,
          name: item.name,
          email: item.email,
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

      return NextResponse.json({ success: true, count: createdList.length, candidates: createdList }, { status: 201 });
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
      applied_segment,
      applied_subject,
      target_branch_id,
      video_intro_url,
      reading_passage_text,
      reading_passage_score,
      whatsapp_consent
    } = body;

    if (!name || !email || !applied_subject || !applied_segment) {
      return NextResponse.json({ error: 'Name, email, subject and segment are required' }, { status: 400 });
    }

    // A staff caller's own school always wins over the request body — see
    // the comment above. An anonymous applicant has no staff session, so
    // resolveSchoolId is skipped and their supplied school_id (or the
    // default) is used as-is.
    const school_id = staffCtx ? resolveSchoolId(staffCtx, requestedSchoolId) : requestedSchoolId;

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
      applied_subject,
      target_branch_id: target_branch_id || (staffCtx?.user.branch_id) || 'branch_gachibowli',
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

    // Consent is recorded either way, so a "no" is durable and auditable —
    // only a "yes" allows WhatsApp sends later.
    db.setConsent({
      candidate_id: newCandidate.id,
      channel: 'whatsapp',
      granted: Boolean(whatsapp_consent),
      source: 'apply_form',
      wording_version: 'apply-form-v1',
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

    const res = NextResponse.json({ candidate: newCandidate }, { status: 201 });

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
