/**
 * The decisions a school makes about a candidate after reading the report, and
 * what each one changes. Pure, so the rules are tested without a page or a
 * server. The route that applies them records who decided (from the session,
 * never typed) and tells a declined candidate once.
 *
 *   Review -> Shortlist -> Subject lead -> Principal -> Management -> Offer sent
 *               |  or hold, or "not moving forward" at any point
 */

import type { Candidate, InterviewDecision, InterviewRound } from './types';

export type DecisionAction =
  | 'shortlist'
  | 'hold'
  | 'reject'
  | 'reopen'
  | 'round_pass'
  | 'round_reject'
  | 'offer_sent'
  | 'candidate_declined';

export const ROUNDS: { round: InterviewRound; field: 'rm_clearance' | 'ih_clearance' | 'coo_clearance'; label: string }[] = [
  { round: 'subject_lead', field: 'rm_clearance', label: 'Subject lead' },
  { round: 'principal', field: 'ih_clearance', label: 'Principal' },
  { round: 'management', field: 'coo_clearance', label: 'Management' },
];

export interface DecisionInput {
  action: DecisionAction;
  round?: InterviewRound;
  note?: string;
}

export type DecisionOutcome =
  | { ok: true; updates: Record<string, unknown>; message: string; declinesCandidate: boolean }
  | { ok: false; error: string };

const MIN_NOTE = 3;

function isClosed(c: Pick<Candidate, 'status' | 'rejected_by_school_at' | 'rejected_by_candidate_at'>): boolean {
  return c.status === 'rejected' || !!c.rejected_by_school_at || !!c.rejected_by_candidate_at;
}

/** Which round a shortlisted candidate is waiting on: the first one not yet cleared. Null when all three are cleared. */
export function currentRound(c: Pick<Candidate, 'rm_clearance' | 'ih_clearance' | 'coo_clearance'>): InterviewRound | null {
  for (const r of ROUNDS) {
    if (c[r.field]?.status !== 'cleared') return r.round;
  }
  return null;
}

export function decide(
  c: Candidate,
  input: DecisionInput,
  actor: { id: string; name: string },
  nowIso: string = new Date().toISOString()
): DecisionOutcome {
  const note = (input.note ?? '').trim();
  const closed = isClosed(c);
  const shortlisted = c.shortlist_status === 'shortlisted' || c.status === 'passed';

  switch (input.action) {
    case 'shortlist': {
      if (closed) return { ok: false, error: 'This candidate is not moving forward. Reopen them first.' };
      if (c.status === 'hired' || c.selected_at) return { ok: false, error: 'This candidate is already selected.' };
      return {
        ok: true,
        updates: { shortlist_status: 'shortlisted', status: 'passed' },
        message: 'Shortlisted. They can now be scheduled for interviews.',
        declinesCandidate: false,
      };
    }

    case 'hold': {
      if (closed) return { ok: false, error: 'This candidate is not moving forward. Reopen them first.' };
      if (shortlisted) return { ok: false, error: 'This candidate is already shortlisted.' };
      return { ok: true, updates: { shortlist_status: 'hold' }, message: 'Put on hold.', declinesCandidate: false };
    }

    case 'reject': {
      if (c.status === 'hired' || c.selected_at) return { ok: false, error: 'This candidate is already selected.' };
      if (note.length < MIN_NOTE) return { ok: false, error: 'Please write a short reason. Only your school sees it.' };
      return {
        ok: true,
        updates: {
          status: 'rejected',
          shortlist_status: 'rejected',
          rejected_by_school_at: nowIso,
          rejected_by_school_reason: note,
        },
        message: 'Marked as not moving forward.',
        declinesCandidate: true,
      };
    }

    case 'reopen': {
      if (!closed && c.shortlist_status !== 'hold') return { ok: false, error: 'Only a candidate who is on hold or not moving forward can be reopened.' };
      return {
        ok: true,
        updates: {
          status: 'in_progress',
          shortlist_status: 'pending',
          rejected_by_school_at: null,
          rejected_by_school_reason: null,
          rejected_by_candidate_at: null,
          rejected_by_candidate_reason: null,
        },
        message: 'Back under review.',
        declinesCandidate: false,
      };
    }

    case 'round_pass':
    case 'round_reject': {
      if (closed) return { ok: false, error: 'This candidate is not moving forward.' };
      if (!shortlisted) return { ok: false, error: 'Shortlist the candidate before recording an interview.' };
      const index = ROUNDS.findIndex((r) => r.round === input.round);
      if (index < 0) return { ok: false, error: 'Choose an interview round.' };
      const wanted = ROUNDS[index];
      const expected = currentRound(c);
      if (expected === null) return { ok: false, error: 'All three interviews are already cleared.' };
      if (expected !== wanted.round) {
        return { ok: false, error: `Record the ${ROUNDS.find((r) => r.round === expected)?.label} interview first.` };
      }
      const pass = input.action === 'round_pass';
      if (!pass && note.length < MIN_NOTE) return { ok: false, error: 'Please write why. Only your school sees it.' };

      const entry: InterviewDecision = {
        round: wanted.round,
        round_label: wanted.label,
        reviewer_id: actor.id,
        reviewer_name: actor.name,
        decision: pass ? 'accepted' : 'rejected',
        reason: note || 'Cleared.',
        decided_at: nowIso,
      };
      const clearance: Record<string, unknown> = {
        status: pass ? 'cleared' : 'rejected',
        notes: note || 'Cleared.',
        reviewer_name: actor.name,
        completed_at: nowIso,
      };
      if (wanted.round === 'management') clearance.decision = pass ? 'offer_issued' : 'rejected';

      const updates: Record<string, unknown> = {
        [wanted.field]: clearance,
        interview_decisions: [...(c.interview_decisions || []), entry],
      };
      if (!pass) {
        Object.assign(updates, {
          status: 'rejected',
          shortlist_status: 'rejected',
          rejected_by_school_at: nowIso,
          rejected_by_school_reason: note,
        });
      } else if (wanted.round === 'management') {
        // Approved. The teacher counts as selected; "hired" waits for the offer letter.
        updates.selected_at = c.selected_at || nowIso;
      }
      return {
        ok: true,
        updates,
        message: !pass
          ? `Stopped after the ${wanted.label.toLowerCase()} interview.`
          : wanted.round === 'management'
          ? 'Approved. The teacher is selected. Send the offer letter next.'
          : `${wanted.label} interview cleared. Next: ${ROUNDS[index + 1].label.toLowerCase()}.`,
        declinesCandidate: !pass,
      };
    }

    case 'offer_sent': {
      if (!c.selected_at) return { ok: false, error: 'Approve the teacher at the management interview before marking the offer sent.' };
      return {
        ok: true,
        updates: { offer_letter_sent_at: nowIso, status: 'hired' },
        message: 'Offer letter marked as sent.',
        declinesCandidate: false,
      };
    }

    case 'candidate_declined': {
      if (note.length < MIN_NOTE) return { ok: false, error: 'Please write why the teacher declined.' };
      return {
        ok: true,
        updates: { rejected_by_candidate_at: nowIso, rejected_by_candidate_reason: note, status: 'rejected' },
        message: 'Recorded that the teacher declined.',
        declinesCandidate: false,
      };
    }

    default:
      return { ok: false, error: 'That action is not recognised.' };
  }
}
