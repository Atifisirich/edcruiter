import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireCandidate } from '@/lib/auth';
import { recordPing } from '@/lib/attemptService';

/**
 * The open stage page says it is still there. A page that stops saying so for a
 * few minutes is treated as left, and the next visit starts a new go.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireCandidate();
    const body = await req.json().catch(() => ({}));
    const id = String(body.attempt_id || '');
    const attempt = db.getStageAttempts(session.schoolId, session.candidateId).find((a) => a.id === id);
    if (!attempt || attempt.status !== 'open') {
      return NextResponse.json({ open: false });
    }
    recordPing(attempt);
    return NextResponse.json({ open: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not record that.' }, { status: 500 });
  }
}
