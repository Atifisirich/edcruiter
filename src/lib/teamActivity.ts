import type { AuditLogEntry } from './types';

/**
 * Turns the school's activity log into what management wants to see about each
 * person: how much hiring work they did, and the yes/no decisions they gave.
 */

export type WorkKind = 'vacancies' | 'candidates' | 'invites' | 'interviews' | 'shortlist' | 'reviews' | 'offers';

export const WORK_LABEL: Record<WorkKind, string> = {
  vacancies: 'Vacancies posted',
  candidates: 'Candidates added',
  invites: 'Invites sent',
  interviews: 'Interviews scheduled',
  shortlist: 'Shortlist decisions',
  reviews: 'Review yes / no',
  offers: 'Offers sent',
};

const KIND_OF: Record<string, WorkKind> = {
  JOB_POSTED: 'vacancies',
  CANDIDATE_ADDED_BY_STAFF: 'candidates',
  CANDIDATES_BULK_IMPORTED: 'candidates',
  WHATSAPP_INVITE: 'invites',
  WHATSAPP_INVITE_BULK: 'invites',
  INTERVIEW_SCHEDULED: 'interviews',
  DECISION_SHORTLIST: 'shortlist',
  DECISION_HOLD: 'shortlist',
  DECISION_REJECT: 'shortlist',
  DECISION_ROUND_PASS: 'reviews',
  DECISION_ROUND_REJECT: 'reviews',
  INTERVIEW_DECISION_RECORDED: 'reviews',
  DECISION_OFFER_SENT: 'offers',
};

/** A short plain-language name for a log entry, for the activity feed. */
export function actionLabel(action: string): string {
  const named: Record<string, string> = {
    JOB_POSTED: 'Posted a vacancy',
    CANDIDATE_ADDED_BY_STAFF: 'Added a candidate',
    CANDIDATES_BULK_IMPORTED: 'Imported candidates',
    CANDIDATE_DELETED: 'Deleted a candidate',
    WHATSAPP_INVITE: 'Sent a test invite',
    WHATSAPP_INVITE_BULK: 'Sent test invites',
    INTERVIEW_SCHEDULED: 'Scheduled an interview',
    INTERVIEW_CANCELLED: 'Cancelled an interview',
    INTERVIEW_RESCHEDULED: 'Changed an interview',
    INTERVIEW_DECISION_RECORDED: 'Gave an interview yes / no',
    DECISION_SHORTLIST: 'Shortlisted',
    DECISION_HOLD: 'Put on hold',
    DECISION_REJECT: 'Not moving forward',
    DECISION_REOPEN: 'Reopened',
    DECISION_ROUND_PASS: 'Said yes in a round',
    DECISION_ROUND_REJECT: 'Said no in a round',
    DECISION_OFFER_SENT: 'Sent the offer',
    DECISION_CANDIDATE_DECLINED: 'Recorded the teacher declined',
    DECISION_ALLOW_RETRY: 'Allowed another go',
    ASSESSMENT_PACK_GENERATED: 'Wrote a test',
    AI_SCORE_OVERRIDE: 'Changed an AI score',
    TEAM_MEMBER_ADDED: 'Added a team member',
    TEAM_MEMBER_REMOVED: 'Removed a team member',
    TEAM_ROLE_CHANGED: 'Changed a role',
    ROLES_UPDATED: 'Changed role names',
    REVIEW_ROUNDS_UPDATED: 'Changed the review rounds',
  };
  return named[action] ?? action.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export interface PersonWork {
  actorId: string;
  name: string;
  counts: Record<WorkKind, number>;
  total: number;
  lastActive: string | null;
}

/** Each person's work since `sinceIso` (all of it when null), busiest first. */
export function summariseWork(logs: AuditLogEntry[], sinceIso: string | null): PersonWork[] {
  const byActor = new Map<string, PersonWork>();
  for (const log of logs) {
    if (!log.actor_id || log.actor_id === 'system') continue;
    const person = byActor.get(log.actor_id) ?? {
      actorId: log.actor_id,
      name: log.actor_name,
      counts: { vacancies: 0, candidates: 0, invites: 0, interviews: 0, shortlist: 0, reviews: 0, offers: 0 },
      total: 0,
      lastActive: null,
    };
    if (!person.lastActive || log.timestamp > person.lastActive) person.lastActive = log.timestamp;
    const kind = KIND_OF[log.action];
    if (kind && (!sinceIso || log.timestamp >= sinceIso)) {
      person.counts[kind] += 1;
      person.total += 1;
    }
    byActor.set(log.actor_id, person);
  }
  return [...byActor.values()].sort((a, b) => b.total - a.total || (b.lastActive ?? '').localeCompare(a.lastActive ?? ''));
}
