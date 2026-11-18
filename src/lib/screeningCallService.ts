/**
 * Starting AI screening calls and recording how they ended. Server only; the
 * rules and the Sarvam request are in screeningCall.ts.
 */

import { db } from './db';
import {
  analyseCall, callCostInr, callPriceOf, callVariables, demoTranscript, placeSarvamCall,
  sarvamEnv, screeningSettingsOf, statusFromSarvam, toCallNumber,
} from './screeningCall';
import type { Candidate, ScreeningCall } from './types';

/** A call still ringing after this long is treated as lost, so the candidate can be called again. */
const STUCK_AFTER_MS = 20 * 60_000;

export type StartResult = { ok: true; call: ScreeningCall } | { ok: false; candidateId: string; error: string };

/** Places one screening call (or, without Sarvam set up, runs a labelled demo). Never throws. */
export async function startScreeningCall(
  schoolId: string,
  candidate: Candidate,
  opts: { requestedBy: string; trigger: 'manual' | 'auto'; appUrl: string }
): Promise<StartResult> {
  const school = db.getSchoolById(schoolId);
  if (!school) return { ok: false, candidateId: candidate.id, error: 'School not found.' };

  const ringing = db.getScreeningCallsBySchool(schoolId, candidate.id)
    .find((c) => c.status === 'calling' && Date.now() - Date.parse(c.started_at) < STUCK_AFTER_MS);
  if (ringing) return { ok: false, candidateId: candidate.id, error: `${candidate.name} is already being called.` };

  const env = sarvamEnv();
  const phone = toCallNumber(candidate.phone);
  if (env && !phone) return { ok: false, candidateId: candidate.id, error: `${candidate.name} has no valid mobile number.` };

  const { questions } = screeningSettingsOf(school);
  const call = db.addScreeningCall({
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    candidate_id: candidate.id,
    mode: env ? 'live' : 'demo',
    status: 'calling',
    questions,
    requested_by: opts.requestedBy,
    trigger: opts.trigger,
    started_at: new Date().toISOString(),
  });

  if (env && phone) {
    try {
      const attemptId = await placeSarvamCall(env, { callId: call.id, phone, variables: callVariables(candidate, school, questions), appUrl: opts.appUrl });
      return { ok: true, call: db.updateScreeningCall(call.id, { attempt_id: attemptId }) ?? call };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'The call could not be placed.';
      db.updateScreeningCall(call.id, { status: 'failed', failure_reason: reason, ended_at: new Date().toISOString() });
      return { ok: false, candidateId: candidate.id, error: reason };
    }
  }

  // Demo: finish in the background, a few seconds later, like a short call would.
  void (async () => {
    const transcript = await demoTranscript(candidate, school, questions);
    const analysis = await analyseCall(questions, transcript);
    db.updateScreeningCall(call.id, {
      status: 'completed',
      transcript,
      ...analysis,
      duration_sec: 60 + transcript.length * 9,
      ended_at: new Date().toISOString(),
      // A demo is never charged.
      price_inr: 0,
      cost_inr: 0,
    });
  })();
  return { ok: true, call };
}

/** Records Sarvam's report for a finished live call. Answered calls are charged at the school's price. */
export async function finishLiveCall(call: ScreeningCall, payload: Record<string, unknown>): Promise<void> {
  const status = statusFromSarvam(payload.status);
  const raw = Array.isArray(payload.interaction_transcript) ? payload.interaction_transcript as { role?: string; en_text?: string }[] : [];
  const transcript = raw
    .filter((t) => typeof t?.en_text === 'string' && t.en_text.trim())
    .map((t) => ({ role: t.role === 'user' ? 'user' as const : 'agent' as const, text: String(t.en_text).slice(0, 1000) }));
  const duration = typeof payload.duration === 'number' ? Math.round(payload.duration) : undefined;
  const school = db.getSchoolById(call.school_id);
  const answered = status === 'completed';

  db.updateScreeningCall(call.id, {
    status,
    transcript,
    duration_sec: duration,
    ended_at: new Date().toISOString(),
    failure_reason: typeof payload.failure_reason === 'string' ? payload.failure_reason.slice(0, 300) : undefined,
    price_inr: answered ? callPriceOf(school) : 0,
    cost_inr: answered ? callCostInr(duration) : 0,
  });
  if (answered && transcript.length) {
    const analysis = await analyseCall(call.questions, transcript);
    db.updateScreeningCall(call.id, analysis);
  }
}

/** This month's answered calls and what they come to, for the school's settings and the owner. */
export function callUsageThisMonth(schoolId: string): { calls: number; amount_inr: number; cost_inr: number } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const calls = db.getScreeningCallsBySchool(schoolId)
    .filter((c) => c.mode === 'live' && c.status === 'completed' && Date.parse(c.started_at) >= start.getTime());
  return {
    calls: calls.length,
    amount_inr: calls.reduce((n, c) => n + (c.price_inr || 0), 0),
    cost_inr: Math.round(calls.reduce((n, c) => n + (c.cost_inr || 0), 0) * 100) / 100,
  };
}
