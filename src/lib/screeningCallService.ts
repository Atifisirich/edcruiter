/**
 * Starting AI screening calls (now, or scheduled for the calling hours),
 * recording how they ended, and doing what the school's rules say next: send
 * the test link, hold for HR, suggest a decline for HR to approve, ring again,
 * ring back when the candidate asked. A sweeper every five minutes places
 * scheduled calls and retries, reminds HR about results left waiting, and
 * sends the daily summary. Server only; the pure rules are in screeningCall.ts
 * and screeningFlow.ts.
 */

import { db } from './db';
import { fillTemplate, variableValues } from './callScript';
import {
  analyseCall, callChargeInr, callCostInr, callVariables, demoTranscript, placeSarvamCall,
  questionSetFor, sarvamEnv, screeningSettingsOf, statusFromSarvam, toCallNumber, type FullScreeningSettings,
} from './screeningCall';
import {
  actionFor, callbackTime, callLanguage, groupOf, istDate, istHour, mayCallBack, monthlyCapOf,
  nextInWindow, OUTCOME_LABEL, outcomeOf, planAfterNoAnswer,
} from './screeningFlow';
import { sendAssessmentInvite, sendInviteEmail } from './assessmentInvite';
import { notifyCandidateDeclined } from './candidateOutcome';
import { decide as hiringDecide } from './hiringDecision';
import { roundsFor } from './reviewRounds';
import {
  emailCapReached, emailDigest, emailGoodFit, emailWaiting, markSchoolState, sendHeadsUp, sendMissedCall, whenText,
} from './screeningMessages';
import type { Candidate, School, ScreeningCall, ScreeningDecision } from './types';

/** A call still ringing after this long is treated as lost, so the candidate can be called again. */
const STUCK_AFTER_MS = 20 * 60_000;
const appUrlDefault = () => process.env.NEXT_PUBLIC_APP_URL || 'https://edcruiter.com';

export type StartResult = { ok: true; call: ScreeningCall } | { ok: false; candidateId: string; error: string };

function decideCall(callId: string, decision: Omit<ScreeningDecision, 'at'>) {
  db.updateScreeningCall(callId, { decision: { ...decision, at: new Date().toISOString() } });
}

/** The candidate is out of the running or already past the call: nothing automatic should happen to them. */
function pastTheCall(schoolId: string, candidate: Candidate): string | null {
  if (candidate.rejected_by_school_at || candidate.status === 'rejected') return 'They are not moving forward.';
  if (candidate.rejected_by_candidate_at) return 'They withdrew.';
  if (db.getStageResultsByCandidate(schoolId, candidate.id).length > 0) return 'They have already started the test.';
  return null;
}

/**
 * Creates a screening call for a candidate and places it now, or at `at` (a
 * later time is kept as a scheduled call). Never throws. A manual call
 * replaces a scheduled one, so HR pressing "Call now" never makes two calls.
 */
export async function startScreeningCall(
  schoolId: string,
  candidate: Candidate,
  opts: { requestedBy: string; trigger: ScreeningCall['trigger']; appUrl: string; attempt?: number; callbackCount?: number; at?: Date }
): Promise<StartResult> {
  ensureRetrySweeper();
  const school = db.getSchoolById(schoolId);
  if (!school) return { ok: false, candidateId: candidate.id, error: 'School not found.' };

  const existing = db.getScreeningCallsBySchool(schoolId, candidate.id);
  const ringing = existing.find((c) => c.status === 'calling' && Date.now() - Date.parse(c.started_at) < STUCK_AFTER_MS);
  if (ringing) return { ok: false, candidateId: candidate.id, error: `${candidate.name} is already being called.` };
  for (const s of existing.filter((c) => c.status === 'scheduled')) {
    if (opts.trigger !== 'manual') return { ok: false, candidateId: candidate.id, error: `A call to ${candidate.name} is already planned.` };
    db.updateScreeningCall(s.id, { status: 'skipped', failure_reason: `Replaced by a call made now by ${opts.requestedBy}.`, ended_at: new Date().toISOString() });
  }

  const env = sarvamEnv();
  const phone = toCallNumber(candidate.phone);
  if (env && !phone) return { ok: false, candidateId: candidate.id, error: `${candidate.name} has no valid mobile number.` };

  const settings = screeningSettingsOf(school);
  const set = questionSetFor(settings, candidate);
  const values = variableValues(settings.script, candidate, school);
  const now = Date.now();
  const later = opts.at && opts.at.getTime() > now + 30_000;
  const call = db.addScreeningCall({
    id: `call_${now}_${Math.random().toString(36).slice(2, 6)}`,
    school_id: schoolId,
    candidate_id: candidate.id,
    mode: env ? 'live' : 'demo',
    status: later ? 'scheduled' : 'calling',
    // The school's {{variables}} are filled in now, so the call record, the answers and the checks read as said on the call.
    questions: set.questions.map((q) => fillTemplate(q, values)),
    requirements: set.requirements.map((r) => fillTemplate(r, values)),
    importance: set.importance,
    ...(set.own && set.group ? { group: set.group } : {}),
    language: callLanguage(settings.language, candidate.languages),
    attempt: opts.attempt ?? 1,
    callback_count: opts.callbackCount ?? 0,
    requested_by: opts.requestedBy,
    trigger: opts.trigger,
    started_at: new Date(later ? opts.at!.getTime() : now).toISOString(),
    ...(later ? { scheduled_for: opts.at!.toISOString() } : {}),
  });
  if (later) return { ok: true, call };
  return placeCall(call, school, candidate, settings, opts.appUrl);
}

/** Calls placed today (India time) that count toward the school's daily limit: everything but HR's own "Call now". */
function automaticCallsToday(schoolId: string, now: Date): number {
  const today = istDate(now);
  return db.getScreeningCallsBySchool(schoolId).filter((c) =>
    c.trigger !== 'manual' && c.status !== 'scheduled' && c.status !== 'skipped' && istDate(new Date(c.started_at)) === today
  ).length;
}

function monthlyCap(school: School, settings: FullScreeningSettings): number {
  return monthlyCapOf(settings.limits.monthly_cap_inr, school.screening_call_owner_cap_inr);
}

/** Places a call that is due: checks the limits, then rings (or runs the demo). */
async function placeCall(call: ScreeningCall, school: School, candidate: Candidate, settings: FullScreeningSettings, appUrl: string): Promise<StartResult> {
  const now = new Date();
  const skip = (reason: string): StartResult => {
    db.updateScreeningCall(call.id, { status: 'skipped', failure_reason: reason, ended_at: now.toISOString() });
    decideCall(call.id, { action: 'flagged', detail: `${reason} HR follows up.` });
    return { ok: false, candidateId: candidate.id, error: reason };
  };

  // Limits on spending, for real calls only.
  const cap = monthlyCap(school, settings);
  if (call.mode === 'live' && cap > 0 && callUsageThisMonth(school.id).amount_inr >= cap) {
    const month = istDate(now).slice(0, 7);
    if (school.screening_call_state?.cap_alert_month !== month) {
      markSchoolState(school, { cap_alert_month: month });
      void emailCapReached(school, settings, cap);
    }
    return skip(`Not called: this month's AI call limit of ₹${cap} is reached.`);
  }
  if (call.trigger !== 'manual' && settings.limits.daily_max_calls > 0 && automaticCallsToday(school.id, now) >= settings.limits.daily_max_calls) {
    const tomorrow = nextInWindow(new Date(Date.parse(`${istDate(now)}T00:00:00+05:30`) + 86_400_000), settings.rules);
    db.updateScreeningCall(call.id, { status: 'scheduled', scheduled_for: tomorrow.toISOString(), started_at: tomorrow.toISOString() });
    return { ok: true, call: db.getScreeningCall(call.id) ?? call };
  }
  // A CV read after the call was planned can still keep someone off the automatic list.
  const cv = candidate.resume_analysis?.overall_fitment_score;
  if (call.trigger === 'auto' && settings.auto_call.min_cv_score > 0 && typeof cv === 'number' && cv < settings.auto_call.min_cv_score) {
    db.updateScreeningCall(call.id, { status: 'skipped', failure_reason: `Not called: CV fit score ${cv}/10 is below the school's ${settings.auto_call.min_cv_score}/10.`, ended_at: now.toISOString() });
    return { ok: false, candidateId: candidate.id, error: 'CV score below the school\'s minimum.' };
  }

  db.updateScreeningCall(call.id, { status: 'calling', started_at: now.toISOString() });
  const env = sarvamEnv();
  const phone = toCallNumber(candidate.phone);
  if (env && phone && call.mode === 'live') {
    try {
      const attemptId = await placeSarvamCall(env, { callId: call.id, phone, variables: callVariables(candidate, school, call.questions, call.language, settings.script), appUrl });
      return { ok: true, call: db.updateScreeningCall(call.id, { attempt_id: attemptId }) ?? call };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'The call could not be placed.';
      db.updateScreeningCall(call.id, { status: 'failed', failure_reason: reason, ended_at: new Date().toISOString() });
      void actOnResult(call.id);
      return { ok: false, candidateId: candidate.id, error: reason };
    }
  }
  if (call.mode === 'live') {
    // Set up for real calls but the number went bad since the call was planned.
    db.updateScreeningCall(call.id, { status: 'failed', failure_reason: 'No valid mobile number.', ended_at: now.toISOString() });
    void actOnResult(call.id);
    return { ok: false, candidateId: candidate.id, error: `${candidate.name} has no valid mobile number.` };
  }

  // Demo: finish in the background, a few seconds later, like a short call would.
  void (async () => {
    const transcript = await demoTranscript(candidate, school, call.questions, settings.script);
    const analysis = await analyseCall(call.questions, transcript, call.requirements ?? [], call.importance ?? []);
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
  return { ok: true, call: db.getScreeningCall(call.id) ?? call };
}

/**
 * A new applicant, when the school has automatic calls on: checks who should
 * be called, plans the call for the calling hours (after the school's delay),
 * and tells the candidate it is coming if the school wants that.
 */
export async function autoCallNewApplicant(schoolId: string, candidate: Candidate, appUrl: string): Promise<void> {
  const school = db.getSchoolById(schoolId);
  if (!school) return;
  const settings = screeningSettingsOf(school);
  if (!settings.auto_call_on_apply) return;
  const { groups, min_cv_score, delay_min, heads_up } = settings.auto_call;
  const group = groupOf(candidate, settings.non_teaching_roles);
  if (groups.length && (!group || !groups.includes(group))) return;
  const cv = candidate.resume_analysis?.overall_fitment_score;
  if (min_cv_score > 0 && typeof cv === 'number' && cv < min_cv_score) return;

  const at = nextInWindow(new Date(Date.now() + delay_min * 60_000), settings.rules);
  const r = await startScreeningCall(schoolId, candidate, { requestedBy: 'Automatic (new applicant)', trigger: 'auto', appUrl, at });
  if (r.ok && heads_up && r.call.mode === 'live' && r.call.status === 'scheduled') {
    await sendHeadsUp(school, candidate, at).catch(() => []);
  }
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
    const analysis = await analyseCall(call.questions, transcript, call.requirements ?? [], call.importance ?? []);
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
async function sendLinkAndRecord(call: ScreeningCall, candidate: Candidate, why: string, forced = false): Promise<boolean> {
  const skip = forced ? null : alreadyHasLink(call, candidate);
  if (skip) { decideCall(call.id, { action: 'none', detail: skip }); return false; }
  const { channels, demo } = await deliverTestLink(call, candidate);
  if (demo) { decideCall(call.id, { action: 'would_send_link', detail: `${why} In a real call the test link would be sent now. Demo: nothing was sent.` }); return false; }
  if (channels.length === 0) {
    decideCall(call.id, { action: 'flagged', detail: `${why} The test link could not be sent: no WhatsApp consent and no usable email. HR needs to send it.` });
    return false;
  }
  decideCall(call.id, { action: 'link_sent', detail: `${why} Test link sent by ${channels.join(' and ')}.`, channels });
  return true;
}

const tries = (n: number) => `${n} ${n === 1 ? 'try' : 'tries'}`;

/** Does what the school's rules say for a finished call. Safe to call more than once: it only acts on a call with no decision yet. */
export async function actOnResult(callId: string): Promise<void> {
  const call = db.getScreeningCall(callId);
  if (!call || call.decision) return;
  const school = db.getSchoolById(call.school_id);
  const candidate = db.getCandidateById(call.school_id, call.candidate_id);
  if (!school || !candidate) return;
  const settings = screeningSettingsOf(school);
  const rules = settings.rules;
  if (!rules.enabled) return;

  if (call.status === 'completed') {
    // They asked to be called at another time instead of answering now.
    if (call.callback) {
      if (mayCallBack(rules, call)) {
        const at = callbackTime(call.callback.at, rules);
        return decideCall(call.id, { action: 'callback_scheduled', detail: `They asked to be called ${call.callback.when_text}. The AI will call back ${whenText(at)}.`, retry_at: at.toISOString() });
      }
      return decideCall(call.id, { action: 'flagged', detail: `They asked to be called ${call.callback.when_text}, but the call-backs allowed are used up. Please call them.` });
    }
    if (call.interest === 'not_interested' && rules.on_not_interested === 'withdraw') {
      db.updateCandidate(call.school_id, candidate.id, {
        rejected_by_candidate_at: new Date().toISOString(),
        rejected_by_candidate_reason: 'Said on the AI screening call that they are no longer interested.',
      });
      return decideCall(call.id, { action: 'withdrawn', detail: 'They said they are no longer interested, so they are marked as withdrawn. Nothing was sent. Reopen them if this is wrong.' });
    }

    const outcome = outcomeOf(call.interest === 'not_interested' ? 'not_suitable' : call.recommendation, call.checks);
    const action = actionFor(rules, outcome);
    const failed = (call.checks ?? []).filter((c) => c.result === 'not_met').map((c) => `${c.importance === 'prefer' ? 'preference' : 'must-have'} not met: ${c.requirement}`);
    const why = `Result: ${OUTCOME_LABEL[outcome]}${call.interest === 'not_interested' ? ' (not interested)' : ''}${failed.length ? ` (${failed.join('; ')})` : ''}.`;
    let linkSent = false;
    if (action === 'send_link') linkSent = await sendLinkAndRecord(call, candidate, why);
    else if (action === 'hold') decideCall(call.id, { action: 'held', detail: `${why} Waiting for HR to approve sending the test link.` });
    else if (action === 'suggest_decline') decideCall(call.id, { action: 'decline_suggested', detail: `${why} A polite decline is ready; it goes out only when HR presses "Send the decline".` });
    else decideCall(call.id, { action: 'flagged', detail: `${why} Nothing was sent. HR decides.` });
    if (outcome === 'proceed' && settings.notify.good_fit_now) {
      await emailGoodFit(school, settings, candidate, call.summary || '', linkSent).catch(() => false);
    }
    return;
  }

  if (call.status === 'no_answer' || call.status === 'busy') {
    const plan = planAfterNoAnswer(rules, call);
    const lost = call.status === 'busy' ? 'The line was busy' : 'They did not answer';
    // Tell them once, after the first missed call of a round of tries.
    if (rules.missed_call_message && call.mode === 'live' && (call.attempt ?? 1) === 1) {
      void sendMissedCall(school, candidate, plan.kind === 'retry' ? plan.at : null).catch(() => []);
    }
    if (plan.kind === 'retry') {
      return decideCall(call.id, { action: 'retry_scheduled', detail: `${lost}. Trying again ${whenText(plan.at)}.`, retry_at: plan.at.toISOString() });
    }
    if (plan.then === 'send_link') { await sendLinkAndRecord(call, candidate, `${lost} after ${tries(call.attempt ?? 1)}.`); return; }
    return decideCall(call.id, { action: 'flagged', detail: `${lost} after ${tries(call.attempt ?? 1)}. Nothing was sent. HR follows up.` });
  }

  if (call.status === 'failed') {
    const why = `The call could not go through${call.failure_reason ? `: ${call.failure_reason}` : ''}.`;
    if (rules.after_failed === 'send_link') { await sendLinkAndRecord(call, candidate, why); return; }
    return decideCall(call.id, { action: 'flagged', detail: `${why} Nothing was sent. HR follows up.` });
  }
}

// --- HR's buttons -------------------------------------------------------------

type HrResult = { ok: true; call: ScreeningCall } | { ok: false; error: string };

/** HR approves a held, flagged or decline-suggested result: send the test link now. */
export async function releaseTestLink(callId: string, schoolId: string, by: string): Promise<HrResult> {
  const call = db.getScreeningCall(callId);
  if (!call || call.school_id !== schoolId) return { ok: false, error: 'Call not found.' };
  const candidate = db.getCandidateById(schoolId, call.candidate_id);
  if (!candidate) return { ok: false, error: 'Candidate not found.' };
  if (call.decision?.action === 'link_sent') return { ok: false, error: 'The test link was already sent.' };
  await sendLinkAndRecord(call, candidate, `Approved by ${by}.`, true);
  return { ok: true, call: db.getScreeningCall(callId) ?? call };
}

/** HR approves the suggested decline: the candidate is marked not moving forward and told, kindly, once. */
export async function approveDecline(callId: string, schoolId: string, actor: { id: string; name: string }): Promise<HrResult> {
  const call = db.getScreeningCall(callId);
  if (!call || call.school_id !== schoolId) return { ok: false, error: 'Call not found.' };
  if (call.decision?.action !== 'decline_suggested' && call.decision?.action !== 'flagged') return { ok: false, error: 'There is no decline waiting for this call.' };
  const candidate = db.getCandidateById(schoolId, call.candidate_id);
  if (!candidate) return { ok: false, error: 'Candidate not found.' };
  const failed = (call.checks ?? []).filter((c) => c.result === 'not_met').map((c) => c.requirement);
  const note = `Not suitable after the AI screening call${failed.length ? `: ${failed.join('; ')}` : ''}.`;
  const outcome = hiringDecide(candidate, { action: 'reject', note }, actor, undefined, roundsFor(db.getSchoolById(schoolId), candidate));
  if (!outcome.ok) return { ok: false, error: outcome.error };
  db.updateCandidate(schoolId, candidate.id, outcome.updates);
  const told = await notifyCandidateDeclined(schoolId, candidate.id).catch(() => undefined);
  const channels = [told?.whatsapp && 'WhatsApp', told?.email && 'email'].filter(Boolean) as string[];
  decideCall(call.id, {
    action: 'declined',
    detail: `Declined by ${actor.name}. ${channels.length ? `They were told by ${channels.join(' and ')}.` : call.mode === 'demo' ? 'Demo: no message was sent.' : 'No message could be sent (no WhatsApp consent and no usable email).'}`,
    channels,
  });
  return { ok: true, call: db.getScreeningCall(callId) ?? call };
}

/** HR looked and wants nothing to happen for now. */
export function dismissResult(callId: string, schoolId: string, by: string): HrResult {
  const call = db.getScreeningCall(callId);
  if (!call || call.school_id !== schoolId) return { ok: false, error: 'Call not found.' };
  if (!call.decision || !['held', 'flagged', 'decline_suggested'].includes(call.decision.action)) return { ok: false, error: 'Nothing is waiting on this call.' };
  decideCall(call.id, { action: 'none', detail: `${by} chose to leave it for now. Nothing was sent.` });
  return { ok: true, call: db.getScreeningCall(callId) ?? call };
}

// --- The sweeper ----------------------------------------------------------------

/** Places the scheduled calls that have come due. */
async function runDueScheduled(now: Date): Promise<number> {
  const due = db.getAllScreeningCalls().filter((c) => c.status === 'scheduled' && Date.parse(c.scheduled_for || c.started_at) <= now.getTime());
  let placed = 0;
  for (const call of due) {
    const school = db.getSchoolById(call.school_id);
    const candidate = db.getCandidateById(call.school_id, call.candidate_id);
    if (!school || !candidate) { db.updateScreeningCall(call.id, { status: 'skipped', failure_reason: 'The candidate was removed.' }); continue; }
    const past = pastTheCall(call.school_id, candidate);
    if (past) { db.updateScreeningCall(call.id, { status: 'skipped', failure_reason: `Not called: ${past}`, ended_at: now.toISOString() }); continue; }
    const r = await placeCall(call, school, candidate, screeningSettingsOf(school), appUrlDefault());
    if (r.ok) placed++;
  }
  return placed;
}

/** Places the retries and call-backs that have come due. */
export async function runDueRetries(now: Date = new Date()): Promise<number> {
  const due = db.getAllScreeningCalls().filter((c) =>
    (c.decision?.action === 'retry_scheduled' || c.decision?.action === 'callback_scheduled') && c.decision.retry_at && Date.parse(c.decision.retry_at) <= now.getTime()
  );
  let placed = 0;
  for (const call of due) {
    const callback = call.decision?.action === 'callback_scheduled';
    // Close this one first, so a slow call cannot make the same retry twice.
    decideCall(call.id, { action: 'none', detail: callback ? 'Called back.' : 'Tried again.' });
    const candidate = db.getCandidateById(call.school_id, call.candidate_id);
    const school = db.getSchoolById(call.school_id);
    if (!candidate || !school) continue;
    if (pastTheCall(call.school_id, candidate)) continue;
    const r = await startScreeningCall(call.school_id, candidate, callback
      ? { requestedBy: 'Call-back the candidate asked for', trigger: 'callback', appUrl: appUrlDefault(), attempt: 1, callbackCount: (call.callback_count ?? 0) + 1 }
      : { requestedBy: 'Automatic retry', trigger: 'retry', appUrl: appUrlDefault(), attempt: (call.attempt ?? 1) + 1, callbackCount: call.callback_count ?? 0 });
    if (r.ok) placed++;
  }
  return placed;
}

const WAITING = ['held', 'flagged', 'decline_suggested'] as const;
const WAITING_TEXT: Record<(typeof WAITING)[number], string> = { held: 'waiting for you to send the test link', flagged: 'flagged for you to decide', decline_suggested: 'a decline is waiting for your approval' };

/** Each candidate's newest call that is waiting on HR. */
function waitingCalls(schoolId: string): ScreeningCall[] {
  const newest = new Map<string, ScreeningCall>();
  for (const c of db.getScreeningCallsBySchool(schoolId)) {
    const seen = newest.get(c.candidate_id);
    if (!seen || Date.parse(c.started_at) > Date.parse(seen.started_at)) newest.set(c.candidate_id, c);
  }
  return [...newest.values()].filter((c) => c.decision && (WAITING as readonly string[]).includes(c.decision.action));
}

/** Results left waiting longer than the school allows: send the link (if the school said so) or remind HR once. */
async function runHoldExpiry(now: Date): Promise<void> {
  for (const school of db.getSchools()) {
    const settings = screeningSettingsOf(school);
    const { rules } = settings;
    if (!rules.enabled || rules.hold_days === 0) continue;
    const overdue = waitingCalls(school.id).filter((c) => !c.decision!.reminded_at && now.getTime() - Date.parse(c.decision!.at) > rules.hold_days * 86_400_000);
    const remind: { candidate: Candidate; what: string }[] = [];
    for (const call of overdue) {
      const candidate = db.getCandidateById(school.id, call.candidate_id);
      if (!candidate || pastTheCall(school.id, candidate)) { decideCall(call.id, { ...call.decision!, reminded_at: now.toISOString() }); continue; }
      if (rules.after_hold === 'send_link' && call.decision!.action === 'held') {
        await sendLinkAndRecord(call, candidate, `Nobody decided within ${rules.hold_days} ${rules.hold_days === 1 ? 'day' : 'days'}, so the school's rules sent it.`);
        continue;
      }
      remind.push({ candidate, what: WAITING_TEXT[call.decision!.action as (typeof WAITING)[number]] });
      db.updateScreeningCall(call.id, { decision: { ...call.decision!, reminded_at: now.toISOString() } });
    }
    if (remind.length) await emailWaiting(school, settings, remind).catch(() => false);
  }
}

/** The end-of-day summary, once a day after calling hours, for schools that want it and had something happen. */
async function runDigests(now: Date): Promise<void> {
  const today = istDate(now);
  for (const school of db.getSchools()) {
    const settings = screeningSettingsOf(school);
    if (!settings.notify.daily_digest || school.screening_call_state?.digest_on === today) continue;
    if (istHour(now) < Math.max(17, settings.rules.window_end_hour)) continue;
    const calls = db.getScreeningCallsBySchool(school.id).filter((c) => c.status !== 'scheduled' && c.status !== 'skipped' && istDate(new Date(c.started_at)) === today);
    const waiting = waitingCalls(school.id).length;
    markSchoolState(school, { digest_on: today });
    if (!calls.length && !waiting) continue;
    const done = calls.filter((c) => c.status === 'completed');
    const outcomes = done.map((c) => outcomeOf(c.interest === 'not_interested' ? 'not_suitable' : c.recommendation, c.checks));
    await emailDigest(school, settings, {
      called: calls.length,
      answered: done.length,
      good: outcomes.filter((o) => o === 'proceed').length,
      look: outcomes.filter((o) => o === 'maybe').length,
      notSuitable: outcomes.filter((o) => o === 'not_suitable').length,
      missed: calls.filter((c) => c.status === 'no_answer' || c.status === 'busy').length,
      linksSent: calls.filter((c) => c.decision?.action === 'link_sent').length,
      waiting,
      spentMonthInr: callUsageThisMonth(school.id).amount_inr,
      capInr: monthlyCap(school, settings),
    }).catch(() => false);
  }
}

/** Everything the sweeper does, in order. Each part is independent; one failing does not stop the others. */
export async function runScreeningSweep(now: Date = new Date()): Promise<void> {
  for (const step of [runDueScheduled, runDueRetries, runHoldExpiry, runDigests]) {
    await step(now).catch((e: unknown) => console.warn(`Screening sweep (${step.name}) failed:`, e instanceof Error ? e.message : e));
  }
}

const g = globalThis as unknown as { __screeningRetryTimer?: ReturnType<typeof setInterval> };

/**
 * Runs the sweep every five minutes. One copy of the app runs, so a timer is
 * enough; everything it acts on is saved with the calls, so nothing is lost if
 * the app restarts: the timer starts again on the next request.
 */
export function ensureRetrySweeper(): void {
  if (g.__screeningRetryTimer) return;
  g.__screeningRetryTimer = setInterval(() => { void runScreeningSweep(); }, 5 * 60_000);
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

