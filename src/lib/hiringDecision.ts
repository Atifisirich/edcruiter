/**
 * The decisions a school makes about a candidate after reading the report, and
 * what each one changes. Pure, so the rules are tested without a page or a
 * server. The route that applies them records who decided (from the session,
 * never typed) and tells a declined candidate once.
 *
 *   Review -> Shortlist -> the school's review rounds, in order -> Offer sent
 *               |  or hold, or "not moving forward" at any point
 *
 * The rounds are the school's own (reviewRounds.ts); the last one is the final
 * yes or no. Who may take each action is in mayTake below.
 */

import { isAdmin, isHiringTeam } from './permissions';
import { DEFAULT_ROUNDS, currentRound as nextRound, isSelected } from './reviewRounds';
import type { Candidate, InterviewDecision, InterviewRound, ReviewRound, RoundResult, User } from './types';

export type DecisionAction =
  | 'shortlist'
  | 'hold'
  | 'reject'
  | 'reopen'
  | 'round_pass'
  | 'round_reject'
  | 'offer_sent'
  | 'candidate_declined';

/**
 * Who may take an action. HR and the admin run the shortlist, the offer, and
 * passing a teacher from one round to the next (or stopping them). A reviewer
 * never passes or stops anyone: they give their report card (roundReview.ts)
 * and HR decides. Only the admin may undo a decision.
 */
export function mayTake(
  action: DecisionAction | 'allow_retry',
  user: Pick<User, 'role' | 'role_id'>,
  _round?: ReviewRound
): boolean {
  switch (action) {
    case 'reopen':
      return isAdmin(user.role);
    case 'round_pass':
    case 'round_reject':
      return isHiringTeam(user.role);
    default:
      return isHiringTeam(user.role);
  }
}

export interface DecisionInput {
  action: DecisionAction;
  round?: InterviewRound;
  note?: string;
  /** The meeting the round was held in, when it was a scheduled interview. */
  meetingLink?: string;
}

export type DecisionOutcome =
  | { ok: true; updates: Record<string, unknown>; message: string; declinesCandidate: boolean }
  | { ok: false; error: string };

const MIN_NOTE = 3;

function isClosed(c: Pick<Candidate, 'status' | 'rejected_by_school_at' | 'rejected_by_candidate_at'>): boolean {
  return c.status === 'rejected' || !!c.rejected_by_school_at || !!c.rejected_by_candidate_at;
}

/** Which round a shortlisted candidate is waiting on: the first one not yet cleared. Null when every round is cleared. */
export function currentRound(
  c: Pick<Candidate, 'round_results' | 'rm_clearance' | 'ih_clearance' | 'coo_clearance'>,
  rounds: ReviewRound[] = DEFAULT_ROUNDS
): InterviewRound | null {
  return nextRound(c, rounds)?.id ?? null;
}

export function decide(
  c: Candidate,
  input: DecisionInput,
  actor: { id: string; name: string },
  nowIso: string = new Date().toISOString(),
  rounds: ReviewRound[] = DEFAULT_ROUNDS
): DecisionOutcome {
  const note = (input.note ?? '').trim();
  const closed = isClosed(c);
  const shortlisted = c.shortlist_status === 'shortlisted' || c.status === 'passed';
  const selected = isSelected(c, rounds);

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
      const index = rounds.findIndex((r) => r.id === input.round);
      if (index < 0) return { ok: false, error: 'Choose an interview round.' };
      const wanted = rounds[index];
      const expected = nextRound(c, rounds);
      if (expected === null) return { ok: false, error: 'Every review round is already cleared.' };
      if (expected.id !== wanted.id) {
        return { ok: false, error: `Record the ${expected.name} round first.` };
      }
      const pass = input.action === 'round_pass';
      if (note.length < MIN_NOTE) {
        return { ok: false, error: pass ? 'Please write your opinion of this teacher. Only your school sees it.' : 'Please write why. Only your school sees it.' };
      }
      const last = index === rounds.length - 1;

      const entry: InterviewDecision = {
        round: wanted.id,
        round_label: wanted.name,
        reviewer_id: actor.id,
        reviewer_name: actor.name,
        decision: pass ? 'accepted' : 'rejected',
        reason: note,
        decided_at: nowIso,
      };
      const result: RoundResult = {
        status: pass ? 'cleared' : 'rejected',
        notes: note,
        reviewer_id: actor.id,
        reviewer_name: actor.name,
        completed_at: nowIso,
        ...(input.meetingLink ? { gmeet_link: input.meetingLink } : {}),
      };

      const updates: Record<string, unknown> = {
        round_results: { ...(c.round_results || {}), [wanted.id]: result },
        interview_decisions: [...(c.interview_decisions || []), entry],
      };
      if (!pass) {
        Object.assign(updates, {
          status: 'rejected',
          shortlist_status: 'rejected',
          rejected_by_school_at: nowIso,
          rejected_by_school_reason: note,
        });
      } else if (last) {
        // The final yes. The teacher counts as selected; "hired" waits for the offer letter.
        updates.selected_at = c.selected_at || nowIso;
      }
      return {
        ok: true,
        updates,
        message: !pass
          ? `Stopped at the ${wanted.name} round.`
          : last
          ? 'Final yes. The teacher is selected. Send the offer letter next.'
          : `${wanted.name} round cleared. Next: ${rounds[index + 1].name}.`,
        declinesCandidate: !pass,
      };
    }

    case 'offer_sent': {
      if (!selected) return { ok: false, error: 'The teacher needs the final yes before the offer is marked sent.' };
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
