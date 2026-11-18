/**
 * Starting AI screening calls, recording how they ended, and doing what the
 * school's rules say next (send the test link, hold for HR, flag, ring again).
 * Server only; the pure rules are in screeningCall.ts and screeningFlow.ts.
 */

import { db } from './db';
import {
  analyseCall, callChargeInr, callCostInr, callVariables, demoTranscript, placeSarvamCall,
  sarvamEnv, screeningSettingsOf, statusFromSarvam, toCallNumber,
} from './screeningCall';
import { actionFor, outcomeOf, planAfterNoAnswer } from './screeningFlow';
import { sendAssessmentInvite, sendInviteEmail } from './assessmentInvite';
import type { Candidate, ScreeningCall, ScreeningDecision } from './types';

/** A call still ringing after this long is treated as lost, so the candidate can be called again. */
const STUCK_AFTER_MS = 20 * 60_000;

export type StartResult = { ok: true; call: ScreeningCall } | { ok: false; candidateId: string; error: string };

function decide(callId: string, decision: Omit<ScreeningDecision, 'at'>) {
  db.updateScreeningCall(callId, { decision: { ...decision, at: new Date().toISOString() } });
}

/** Places one screening call (or, without Sarvam set up, runs a labelled demo). Never throws. */
export async function startScreeningCall(
  schoolId: string,
  candidate: Candidate,
  opts: { requestedBy: string; trigger: 'manual' | 'auto' | 'retry'; appUrl: string; attempt?: number }
): Promise<StartResult> {
  ensureRetrySweeper();
  const school = db.getSchoolById(schoolId);
  if (!school) return { ok: false, candidateId: candidate.id, error: 'School not found.' };

  const ringing = db.getScreeningCallsBySchool(schoolId, candidate.id)
    .find((c) => c.status === 'calling' && Date.now() - Date.parse(c.started_at) < STUCK_AFTER_MS);
  if (ringing) return { ok: false, candidateId: candidate.id, error: `${candidate.name} is already being called.` };

  const env = sarvamEnv();
  const phone = toCallNumber(candidate.phone);
  if (env && !phone) return { ok: false, candidateId: candidate.id, error: `${candidate.name} has no valid mobile number.` };

  const { questions, requirements } = screeningSettingsOf(school);
  const call = db.addScreeningCall({
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    candidate_id: candidate.id,
    mode: env ? 'live' : 'demo',
    status: 'calling',
    questions,
    requirements,
    attempt: opts.attempt ?? 1,
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
    const analysis = await analyseCall(questions, transcript, requirements);
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
    await actOnResult(call.id);
  })();
  return { ok: true, call };
}

/** Records Sarvam's report for a finished live call, then does what the school's rules say. */
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
    price_inr: answered ? callChargeInr(school, duration) : 0,
    cost_inr: answered ? callCostInr(duration) : 0,
  });
  if (answered && transcript.length) {
    const analysis = await analyseCall(call.questions, transcript, call.requirements ?? []);
    db.updateScreeningCall(call.id, analysis);
  }
  await actOnResult(call.id);
}

// --- What happens after a call ---------------------------------------------

/** Sends the test link on every channel that works. Without Sarvam set up (a demo), nothing is sent. */
async function deliverTestLink(call: ScreeningCall, candidate: Candidate): Promise<{ channels: string[]; demo: boolean }> {
  if (call.mode === 'demo') return { channels: [], demo: true };
  const school = db.getSchoolById(call.school_id);
  if (!school) return { channels: [], demo: false };
  const channels: string[] = [];
  const wa = await sendAssessmentInvite(school, candidate).catch(() => null);
  if (wa?.ok) channels.push('WhatsApp');
  if (await sendInviteEmail(school, candidate).catch(() => false)) channels.push('email');
  return { channels, demo: false };
}

function alreadyHasLink(call: ScreeningCall, candidate: Candidate): string | null {
  if (db.getStageResultsByCandidate(call.school_id, candidate.id).length > 0) return 'They have already started the test.';
  const earlier = db.getScreeningCallsBySchool(call.school_id, candidate.id).find((c) => c.id !== call.id && c.decision?.action === 'link_sent');
  if (earlier) return 'The test link was already sent after an earlier call.';
  return null;
}

/** Sends the link and writes down what happened. `forced` is HR pressing the button, which skips the "already sent" check. */
async function sendLinkAndRecord(call: ScreeningCall, candidate: Candidate, why: string, forced = false) {
  const skip = forced ? null : alreadyHasLink(call, candidate);
  if (skip) { decide(call.id, { action: 'none', detail: skip }); return; }
  const { channels, demo } = await deliverTestLink(call, candidate);
  if (demo) { decide(call.id, { action: 'would_send_link', detail: `${why} In a real call the test link would be sent now. Demo: nothing was sent.` }); return; }
  if (channels.length === 0) {
    decide(call.id, { action: 'flagged', detail: `${why} The test link could not be sent: no WhatsApp consent and no usable email. HR needs to send it.` });
    return;
  }
  decide(call.id, { action: 'link_sent', detail: `${why} Test link sent by ${channels.join(' and ')}.`, channels });
}

/** Does what the school's rules say for a finished call. Safe to call more than once: it only acts on a call with no decision yet. */
export async function actOnResult(callId: string): Promise<void> {
  const call = db.getScreeningCall(callId);
  if (!call || call.decision) return;
  const school = db.getSchoolById(call.school_id);
  const candidate = db.getCandidateById(call.school_id, call.candidate_id);
  if (!school || !candidate) return;
  const rules = screeningSettingsOf(school).rules;
  if (!rules.enabled) return;

  if (call.status === 'completed') {
    const outcome = outcomeOf(call.recommendation, call.checks);
    const action = actionFor(rules, outcome);
    const label = outcome === 'proceed' ? 'Good fit' : outcome === 'maybe' ? 'Needs a look' : 'Not suitable';
    const failed = (call.checks ?? []).filter((c) => c.result === 'not_met').map((c) => c.requirement);
    const why = `Result: ${label}${failed.length ? ` (must-have not met: ${failed.join('; ')})` : ''}.`;
    if (action === 'send_link') return sendLinkAndRecord(call, candidate, why);
    if (action === 'hold') return decide(call.id, { action: 'held', detail: `${why} Waiting for HR to approve sending the test link.` });
    return decide(call.id, { action: 'flagged', detail: `${why} Nothing was sent. HR decides.` });
  }

  if (call.status === 'no_answer' || call.status === 'busy') {
    const plan = planAfterNoAnswer(rules, call);
    const lost = call.status === 'busy' ? 'The line was busy' : 'They did not answer';
    if (plan.kind === 'retry') {
      return decide(call.id, { action: 'retry_scheduled', detail: `${lost}. Trying again later.`, retry_at: plan.at.toISOString() });
    }
    if (plan.then === 'send_link') return sendLinkAndRecord(call, candidate, `${lost} after ${call.attempt ?? 1} ${(call.attempt ?? 1) === 1 ? 'try' : 'tries'}.`);
    return decide(call.id, { action: 'flagged', detail: `${lost} after ${call.attempt ?? 1} ${(call.attempt ?? 1) === 1 ? 'try' : 'tries'}. Nothing was sent. HR follows up.` });
  }

  // A failed call (for example a number on the Do Not Disturb list) is not retried.
  decide(call.id, { action: 'flagged', detail: `The call failed${call.failure_reason ? `: ${call.failure_reason}` : ''}. Nothing was sent. HR follows up.` });
}

/** HR approves a held or flagged result: send the test link now. */
export async function releaseTestLink(callId: string, schoolId: string, by: string): Promise<{ ok: true; call: ScreeningCall } | { ok: false; error: string }> {
  const call = db.getScreeningCall(callId);
  if (!call || call.school_id !== schoolId) return { ok: false, error: 'Call not found.' };
  const candidate = db.getCandidateById(schoolId, call.candidate_id);
  if (!candidate) return { ok: false, error: 'Candidate not found.' };
  if (call.decision?.action === 'link_sent') return { ok: false, error: 'The test link was already sent.' };
  await sendLinkAndRecord(call, candidate, `Approved by ${by}.`, true);
  return { ok: true, call: db.getScreeningCall(callId) ?? call };
}

// --- Ringing again ----------------------------------------------------------

/** Places the retries that have come due. */
export async function runDueRetries(now: Date = new Date()): Promise<number> {
  const due = db.getAllScreeningCalls().filter((c) => c.decision?.action === 'retry_scheduled' && c.decision.retry_at && Date.parse(c.decision.retry_at) <= now.getTime());
  let placed = 0;
  for (const call of due) {
    // Close this one first, so a slow call cannot make the same retry twice.
    decide(call.id, { action: 'none', detail: 'Tried again.' });
    const candidate = db.getCandidateById(call.school_id, call.candidate_id);
    const school = db.getSchoolById(call.school_id);
    if (!candidate || !school) continue;
    if (db.getStageResultsByCandidate(call.school_id, candidate.id).length > 0) continue;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://edcruiter.com';
    const r = await startScreeningCall(call.school_id, candidate, { requestedBy: 'Automatic retry', trigger: 'retry', appUrl, attempt: (call.attempt ?? 1) + 1 });
    if (r.ok) placed++;
  }
  return placed;
}

const g = globalThis as unknown as { __screeningRetryTimer?: ReturnType<typeof setInterval> };

/**
 * Checks for due retries every five minutes. One copy of the app runs, so a
 * timer is enough; the retries themselves are saved with the calls, so nothing
 * is lost if the app restarts: the timer starts again on the next request.
 */
export function ensureRetrySweeper(): void {
  if (g.__screeningRetryTimer) return;
  g.__screeningRetryTimer = setInterval(() => { void runDueRetries().catch((e) => console.warn('Screening retries failed:', e instanceof Error ? e.message : e)); }, 5 * 60_000);
  g.__screeningRetryTimer.unref?.();
}

/** This month's answered calls and what they come to, for the school's settings and the owner. */
export function callUsageThisMonth(schoolId: string): { calls: number; minutes: number; amount_inr: number; cost_inr: number } {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const calls = db.getScreeningCallsBySchool(schoolId)
    .filter((c) => c.mode === 'live' && c.status === 'completed' && Date.parse(c.started_at) >= start.getTime());
  return {
    calls: calls.length,
    minutes: calls.reduce((n, c) => n + (c.duration_sec ? Math.ceil(c.duration_sec / 60) : 0), 0),
    amount_inr: calls.reduce((n, c) => n + (c.price_inr || 0), 0),
    cost_inr: Math.round(calls.reduce((n, c) => n + (c.cost_inr || 0), 0) * 100) / 100,
  };
}
