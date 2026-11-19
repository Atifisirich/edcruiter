import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assertSchoolActive, auditAsStaff, authErrorResponse, requireCandidateOrStaff } from '@/lib/auth';
import { isHiringTeam } from '@/lib/permissions';
import {
  analyseInterview, cleanTurns, defaultPlan, fetchSarvamTranscript, interviewRuntime, interviewVariables,
  INTERVIEW_LANGUAGES, sampleTranscript, type TranscriptTurn,
} from '@/lib/aiInterview';
import type { AiInterview, Candidate } from '@/lib/types';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function newInterview(candidate: Candidate, status: AiInterview['status'], language = 'English'): AiInterview {
  return {
    id: `int_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    status,
    mode: 'live',
    language,
    plan: defaultPlan(candidate),
    transcript: [],
  };
}

/** The interview of one candidate. Staff get all of it; a candidate gets only where it stands. */
export async function GET(req: NextRequest) {
  try {
    const candidateId = new URL(req.url).searchParams.get('candidate_id') || '';
    const access = await requireCandidateOrStaff(candidateId);
    const candidate = db.getCandidateById(access.schoolId, candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const configured = interviewRuntime() !== null;
    const i = candidate.ai_interview;
    if (access.kind === 'candidate') {
      return NextResponse.json({ configured, viewer: 'candidate', name: candidate.name, interview: i ? { id: i.id, status: i.status, language: i.language } : null });
    }
    return NextResponse.json({ configured, viewer: 'staff', name: candidate.name, interview: i ?? null });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load the interview.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    const access = await requireCandidateOrStaff(candidateId);
    assertSchoolActive(access.schoolId);
    const candidate = db.getCandidateById(access.schoolId, candidateId);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const school = db.getSchoolById(candidate.school_id);
    const staff = access.kind === 'staff' ? access.ctx : null;
    const hiring = staff ? isHiringTeam(staff.role) : false;
    const audit = (what: string, details: string) => {
      if (staff) auditAsStaff(staff, candidate.school_id, { action: what, resource: `AI interview: ${candidate.name}`, details });
    };

    // The school invites a candidate. Nothing is spoken until the candidate (or the school, as a demo) starts it.
    if (action === 'invite') {
      if (!hiring) return NextResponse.json({ error: 'Only HR or the school admin can invite a candidate to an AI interview.' }, { status: 403 });
      const prev = candidate.ai_interview;
      if (prev && (prev.status === 'invited' || prev.status === 'in_progress')) return NextResponse.json({ interview: prev });
      const interview = { ...newInterview(candidate, 'invited'), invited_at: new Date().toISOString() };
      db.updateCandidate(candidate.school_id, candidate.id, { ai_interview: interview });
      audit('AI_INTERVIEW_INVITED', 'Invited to the AI interview.');
      return NextResponse.json({ interview });
    }

    // A report made from a made-up conversation, for showing how it looks. No microphone needed.
    if (action === 'sample') {
      if (!hiring) return NextResponse.json({ error: 'Only HR or the school admin can do this.' }, { status: 403 });
      const turns = sampleTranscript(candidate, school?.name || 'your school');
      const base = newInterview(candidate, 'completed');
      const report = await analyseInterview(base.plan, turns, candidate);
      const now = new Date().toISOString();
      const interview: AiInterview = { ...base, mode: 'sample', by_staff: true, started_at: now, ended_at: now, duration_sec: 540, transcript: turns, transcript_source: 'sample', report };
      db.updateCandidate(candidate.school_id, candidate.id, { ai_interview: interview });
      audit('AI_INTERVIEW_SAMPLE', 'Made a sample AI interview report.');
      return NextResponse.json({ interview });
    }

    if (action === 'start') {
      const runtime = interviewRuntime();
      if (!runtime) return NextResponse.json({ error: 'The AI interview is not switched on yet. Edcruiter is setting it up.' }, { status: 503 });
      const prev = candidate.ai_interview;
      const byStaff = access.kind === 'staff';
      if (!byStaff) {
        if (!prev || prev.status === 'completed') {
          return NextResponse.json({ error: prev ? 'You have already taken your AI interview. Thank you.' : 'The school has not invited you to an AI interview.' }, { status: 403 });
        }
      } else if (!hiring) {
        return NextResponse.json({ error: 'Only HR or the school admin can run an interview.' }, { status: 403 });
      }
      const requested = typeof body.language === 'string' ? body.language : '';
      const language = (INTERVIEW_LANGUAGES as readonly string[]).includes(requested) ? requested : (prev?.language || 'English');
      const interview: AiInterview = {
        ...newInterview(candidate, 'in_progress', language),
        ...(byStaff ? { by_staff: true } : {}),
        ...(prev?.invited_at ? { invited_at: prev.invited_at } : {}),
        started_at: new Date().toISOString(),
      };
      db.updateCandidate(candidate.school_id, candidate.id, { ai_interview: interview });
      audit('AI_INTERVIEW_STARTED', byStaff ? 'Started a demo interview.' : 'Candidate started the interview.');
      return NextResponse.json({
        interview_id: interview.id,
        variables: interviewVariables(candidate, school?.name || 'the school', interview.plan, language),
        runtime: { org_id: runtime.orgId, workspace_id: runtime.workspaceId, app_id: runtime.appId, ...(runtime.version ? { version: runtime.version } : {}) },
      });
    }

    if (action === 'finish') {
      const current = candidate.ai_interview;
      if (!current || current.id !== body.interview_id) return NextResponse.json({ error: 'This interview is no longer current.' }, { status: 409 });
      if (current.status === 'completed') return NextResponse.json({ status: 'completed' });
      const runtime = interviewRuntime();
      const fromBrowser: TranscriptTurn[] = cleanTurns(body.transcript);
      const seconds = Math.max(0, Math.min(3600, Math.round(Number(body.duration_sec) || 0)));

      // The record kept is the one Sarvam holds. It can take a moment to appear after the call.
      let verified: Awaited<ReturnType<typeof fetchSarvamTranscript>> = null;
      if (runtime && seconds >= 5) {
        for (let attempt = 0; attempt < 4 && !verified; attempt++) {
          if (attempt) await sleep(2500);
          verified = await fetchSarvamTranscript(runtime, current.id);
        }
      }
      const turns = verified?.turns ?? fromBrowser;
      const report = await analyseInterview(current.plan, turns, candidate);
      const interview: AiInterview = {
        ...current,
        status: turns.length ? 'completed' : 'abandoned',
        ended_at: new Date().toISOString(),
        duration_sec: seconds,
        transcript: turns,
        transcript_source: verified ? 'sarvam' : 'browser',
        report,
      };
      // When the interview is the assessment (no scored stages), its score is the candidate's score in the list.
      const scoreFromInterview = candidate.interview_mode === 'ai' && report.scored && !interview.by_staff;
      db.updateCandidate(candidate.school_id, candidate.id, { ai_interview: interview, ...(scoreFromInterview ? { total_ai_score: report.overall } : {}) });
      audit('AI_INTERVIEW_COMPLETED', `Interview finished after ${Math.round(seconds / 60)} min.`);
      return NextResponse.json({ status: interview.status });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'The AI interview request failed.' }, { status: 500 });
  }
}
