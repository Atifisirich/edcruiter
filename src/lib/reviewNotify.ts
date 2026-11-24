/**
 * In-app notices for the review flow. They show in the bell, never on WhatsApp
 * or by email: a reviewer is told a teacher was allocated to them, and HR is
 * told a report card is in and is theirs to pass on or stop.
 */

import { db } from './db';
import { accessOf } from './permissions';
import type { Candidate, ReviewRound, RoundReview, User } from './types';

const newId = () => `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

function tell(schoolId: string, user: User, kind: 'review_allocated' | 'review_submitted', title: string, body: string, href: string) {
  db.addNotification({ id: newId(), school_id: schoolId, user_id: user.id, kind, title, body, href, created_at: new Date().toISOString() });
}

/** The reviewer is told, once for the whole batch, that teachers were given to them. */
export function notifyAllocated(input: { schoolId: string; reviewer: User; candidates: Pick<Candidate, 'name'>[]; round: ReviewRound; byName: string }): void {
  const { schoolId, reviewer, candidates, round, byName } = input;
  const names = candidates.map((c) => c.name);
  const who = names.length === 1 ? names[0] : `${names.length} teachers (${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and more' : ''})`;
  tell(
    schoolId,
    reviewer,
    'review_allocated',
    names.length === 1 ? `${names[0]} is allocated to you` : `${names.length} teachers are allocated to you`,
    `${byName} gave you ${who} for the ${round.name} round. Add your free times so HR can book the interview. After it, give your rating and opinion on their report.`,
    '/reviewer/home'
  );
}

/** HR (or the admins, if the school has no HR) are told a report card is in. */
export function notifyReviewSubmitted(input: { schoolId: string; candidate: Pick<Candidate, 'id' | 'name'>; round: ReviewRound; review: RoundReview }): string[] {
  const { schoolId, candidate, round, review } = input;
  const users = db.getUsersBySchool(schoolId).filter((u) => u.id !== review.reviewer_id);
  const hr = users.filter((u) => accessOf(u.role) === 'hr');
  const people = hr.length ? hr : users.filter((u) => accessOf(u.role) === 'admin' && u.role !== 'SUPER_ADMIN');
  const verdict = review.recommendation === 'approve' ? 'approved' : 'did not approve';
  for (const p of people) {
    tell(
      schoolId,
      p,
      'review_submitted',
      `${review.reviewer_name} ${verdict} ${candidate.name} (${round.name})`,
      `Rated ${review.average} out of 100. Open the report to read it, then pass ${candidate.name} to the next round or stop here.`,
      `/admin/candidates/${candidate.id}`
    );
  }
  return people.map((p) => p.name);
}

/** The next reviewer is told a teacher passed to their round. */
export function notifyPassedTo(input: { schoolId: string; reviewer: User; candidate: Pick<Candidate, 'name'>; round: ReviewRound; byName: string }): void {
  notifyAllocated({ schoolId: input.schoolId, reviewer: input.reviewer, candidates: [input.candidate], round: input.round, byName: input.byName });
}
