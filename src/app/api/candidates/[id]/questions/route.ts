import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { isHiringTeam } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { roundsFor } from '@/lib/reviewRounds';
import { mayReview } from '@/lib/roundReview';
import { suggestQuestions } from '@/lib/suggestedQuestions';
import { logAiUsage } from '@/lib/aiUsage';

const MODEL = 'gemini-flash-lite-latest';

async function askModel(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || '';
  if (!key) throw new Error('not configured');
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.generateContent({ model: MODEL, contents: prompt });
  logAiUsage('interview-questions', response, MODEL);
  return response.text ? response.text.trim() : '';
}

/**
 * Suggested questions for whoever interviews this teacher in a round: some on
 * the subject, some on everything else, written from their CV and report. Made
 * once and kept. For the reviewer the teacher is allocated to, HR and the admin.
 *
 *   GET ?round=subject_lead[&refresh=1]
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const found = db.getCandidateByIdPublic(id);
    if (!found) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    const ctx = await requireSchoolAccess(found.school_id);
    const candidate = db.getCandidateById(ctx.schoolId, id);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const url = new URL(req.url);
    const rounds = roundsFor(db.getSchoolById(ctx.schoolId), candidate);
    const round = rounds.find((r) => r.id === url.searchParams.get('round'));
    if (!round) return NextResponse.json({ error: 'Choose a review round.' }, { status: 400 });

    const allowed = isHiringTeam(ctx.role) || mayReview(ctx.user, candidate, round, db.getScheduledInterviewsByCandidate(ctx.schoolId, id));
    if (!allowed) return NextResponse.json({ error: 'These questions are for the reviewer this teacher is allocated to.' }, { status: 403 });

    const saved = candidate.round_questions?.[round.id];
    if (saved && url.searchParams.get('refresh') !== '1') return NextResponse.json({ questions: saved });

    const rl = checkRateLimit(req, 'interview-questions', { max: 40, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ questions: saved ?? null, error: 'Too many requests this hour. Try again shortly.' }, { status: saved ? 200 : 429 });

    const profile = db.getTeachingProfile(ctx.schoolId, id);
    const questions = await suggestQuestions({ round, candidate, profile: profile ? { strengths: profile.strengths, improvements: profile.improvements } : null, ask: askModel });
    db.updateCandidate(ctx.schoolId, id, { round_questions: { ...(candidate.round_questions ?? {}), [round.id]: questions } });
    return NextResponse.json({ questions });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not make the questions.' }, { status: 500 });
  }
}
