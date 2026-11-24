/**
 * Lead lists: a batch of people a school uploaded to screen by AI phone call,
 * kept apart from its candidates. HR says in her own words who is a good fit;
 * the AI turns that into the call's questions. After each call:
 *   - good fit   → moved into Candidates automatically (and sent the test link);
 *   - needs a look → a short pile for HR to move or set aside in one click;
 *   - filtered out (a must-have not met, not interested, no answer) → set aside,
 *     with the reason, still visible in the list's report. Nobody is deleted.
 *
 * This file is pure (no database, no messages): what a call result means for a
 * lead, the list's report, and the cost and time estimate. leadCampaign.ts
 * does the calling and moving.
 */

import { outcomeOf } from './screeningFlow';
import type { Candidate, LeadList, LeadState, LeadStatus, ScreeningCall, ScreeningRules } from './types';

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  waiting: 'Waiting',
  calling: 'Being called',
  good_fit: 'Good fit',
  needs_look: 'Needs a look',
  set_aside: 'Set aside',
  moved: 'Moved to Candidates',
};

/** Minutes a screening call usually takes, for estimates before any call is made. */
export const TYPICAL_CALL_MINUTES = 3;
/** Share of people who usually pick up, for estimates. */
export const TYPICAL_ANSWER_RATE = 0.7;

export const isLead = (c: Pick<Candidate, 'lead'>) => !!c.lead && c.lead.status !== 'moved';

export function leadState(listId: string, status: LeadStatus, reason?: { text: string; key: string }, now = new Date()): LeadState {
  return { list_id: listId, status, updated_at: now.toISOString(), ...(reason ? { reason: reason.text, reason_key: reason.key } : {}) };
}

/** A short, stable tag for a must-have, so the report can count "set aside because: no B.Ed (42)". */
function keyOf(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60) || 'other';
}

export type LeadVerdict =
  | { kind: 'good_fit' }
  | { kind: 'needs_look'; reason: { text: string; key: string } }
  | { kind: 'set_aside'; reason: { text: string; key: string } }
  | { kind: 'call_back'; at: string; when_text: string }
  | { kind: 'retry' }
  | { kind: 'wait' };

/**
 * What a finished call means for a lead. Lists always act on results (that is
 * their point); the school's rules only decide retries and call-backs.
 */
export function verdictForCall(
  call: Pick<ScreeningCall, 'status' | 'recommendation' | 'checks' | 'interest' | 'callback' | 'callback_count' | 'attempt' | 'failure_reason'>,
  rules: Pick<ScreeningRules, 'retries' | 'max_callbacks'>
): LeadVerdict {
  if (call.status === 'scheduled' || call.status === 'calling') return { kind: 'wait' };
  if (call.status === 'no_answer' || call.status === 'busy') {
    if ((call.attempt ?? 1) <= rules.retries) return { kind: 'retry' };
    const tries = call.attempt ?? 1;
    return { kind: 'set_aside', reason: { text: `No answer after ${tries} ${tries === 1 ? 'try' : 'tries'}`, key: 'no answer' } };
  }
  if (call.status === 'failed' || call.status === 'skipped') {
    return { kind: 'set_aside', reason: { text: call.failure_reason ? `Call did not go through: ${call.failure_reason}` : 'Call did not go through', key: 'call failed' } };
  }
  // Answered.
  if (call.callback) {
    if ((call.callback_count ?? 0) < rules.max_callbacks) return { kind: 'call_back', at: call.callback.at, when_text: call.callback.when_text };
    return { kind: 'needs_look', reason: { text: `Asked to be called ${call.callback.when_text}; call-backs used up`, key: 'call back' } };
  }
  if (call.interest === 'not_interested') return { kind: 'set_aside', reason: { text: 'Not interested', key: 'not interested' } };
  const outcome = outcomeOf(call.recommendation, call.checks);
  const missedMust = (call.checks ?? []).find((c) => c.importance !== 'prefer' && c.result === 'not_met');
  const unclearMust = (call.checks ?? []).find((c) => c.importance !== 'prefer' && c.result === 'unclear');
  const missedPref = (call.checks ?? []).find((c) => c.importance === 'prefer' && c.result === 'not_met');
  if (outcome === 'proceed') return { kind: 'good_fit' };
  if (outcome === 'not_suitable') {
    if (missedMust) return { kind: 'set_aside', reason: { text: `Not met: ${missedMust.requirement}`, key: keyOf(missedMust.requirement) } };
    return { kind: 'set_aside', reason: { text: 'Not suitable, in the AI’s view of the call', key: 'not suitable' } };
  }
  if (unclearMust) return { kind: 'needs_look', reason: { text: `Could not confirm: ${unclearMust.requirement}`, key: keyOf(unclearMust.requirement) } };
  if (missedPref) return { kind: 'needs_look', reason: { text: `Preference not met: ${missedPref.requirement}`, key: keyOf(missedPref.requirement) } };
  return { kind: 'needs_look', reason: { text: 'The AI was not sure', key: 'unsure' } };
}

// --- The report -------------------------------------------------------------------

export interface LeadRowCall {
  status: ScreeningCall['status'];
  summary?: string;
  price_inr?: number;
  duration_sec?: number;
  started_at: string;
  mode: ScreeningCall['mode'];
}

export interface ListReport {
  total: number;
  waiting: number;
  calling: number;
  good_fit: number;
  moved: number;
  invited: number;
  needs_look: number;
  set_aside: number;
  /** People reached at all (picked up at least once). */
  answered: number;
  called: number;
  /** Set-aside and needs-a-look reasons, most common first. */
  reasons: { key: string; text: string; count: number; status: 'set_aside' | 'needs_look' }[];
  spent_inr: number;
  minutes: number;
  /** 0 to 100: share of people with a final result (good fit, moved, set aside, needs a look). */
  progress: number;
}

export function listReport(leads: Pick<Candidate, 'lead'>[], callsByLead: Map<string, LeadRowCall[]>, ids: string[]): ListReport {
  const r: ListReport = { total: leads.length, waiting: 0, calling: 0, good_fit: 0, moved: 0, invited: 0, needs_look: 0, set_aside: 0, answered: 0, called: 0, reasons: [], spent_inr: 0, minutes: 0, progress: 0 };
  const reasons = new Map<string, { key: string; text: string; count: number; status: 'set_aside' | 'needs_look' }>();
  leads.forEach((l, i) => {
    const s = l.lead?.status ?? 'waiting';
    if (s === 'moved') { r.moved++; r.good_fit++; if (l.lead?.invited) r.invited++; }
    else r[s]++;
    if ((s === 'set_aside' || s === 'needs_look') && l.lead?.reason_key) {
      const k = `${s}|${l.lead.reason_key}`;
      const prev = reasons.get(k);
      if (prev) prev.count++;
      else reasons.set(k, { key: l.lead.reason_key, text: reasonLabel(l.lead.reason ?? l.lead.reason_key), count: 1, status: s });
    }
    const calls = callsByLead.get(ids[i]) ?? [];
    if (calls.some((c) => c.status !== 'scheduled' && c.status !== 'skipped')) r.called++;
    if (calls.some((c) => c.status === 'completed')) r.answered++;
    for (const c of calls) {
      if (c.mode === 'live' && c.status === 'completed') {
        r.spent_inr += c.price_inr ?? 0;
        r.minutes += c.duration_sec ? Math.ceil(c.duration_sec / 60) : 0;
      }
    }
  });
  r.reasons = [...reasons.values()].sort((a, b) => b.count - a.count);
  const final = r.good_fit + r.needs_look + r.set_aside;
  r.progress = r.total ? Math.round((final / r.total) * 100) : 0;
  return r;
}

/** "Not met: Has a B.Ed" and "Not met: has a b.ed" count as one reason, shown as the first wording. */
function reasonLabel(text: string): string {
  return text.replace(/^Call did not go through: .*/, 'Call did not go through').replace(/^No answer after \d+ tr(y|ies)$/, 'No answer');
}

/** Cost and time before starting: every waiting lead called once, about 3 minutes each when answered. */
export function estimate(waiting: number, pricePerMin: number, opts: { concurrent: number; windowHours: number }): { calls: number; cost_inr: number; hours: number; days: number } {
  const cost = Math.round(waiting * TYPICAL_ANSWER_RATE * TYPICAL_CALL_MINUTES * pricePerMin);
  // About 4 minutes per call slot including ringing, gaps and unanswered calls.
  const hours = Math.max(0.1, (waiting * 4) / 60 / Math.max(1, opts.concurrent));
  return { calls: waiting, cost_inr: cost, hours: Math.round(hours * 10) / 10, days: Math.max(1, Math.ceil(hours / Math.max(1, opts.windowHours))) };
}

// --- Spreadsheet out ----------------------------------------------------------------

const cell = (v: unknown) => {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  // A cell that starts with = + - @ would run as a formula in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function leadsCsv(rows: { name: string; phone: string; email: string; subject: string; status: string; reason: string; summary: string; called_at: string }[]): string {
  const head = ['Name', 'Phone', 'Email', 'Subject', 'Result', 'Reason', 'Call summary', 'Called on'];
  return [head, ...rows.map((r) => [r.name, r.phone, r.email, r.subject, r.status, r.reason, r.summary, r.called_at])].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Phone numbers compared as their last ten digits, so "+91 98480 12345" and "9848012345" match. */
export function phoneKey(phone: string | undefined): string {
  const d = (phone || '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

export function listStatusLabel(list: Pick<LeadList, 'status' | 'setup'>): string {
  if (list.status === 'setup') return list.setup ? 'Ready to start' : 'Set up screening';
  return { running: 'Calling', paused: 'Paused', done: 'Finished' }[list.status];
}
