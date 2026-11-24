import type { Candidate } from './types';

/**
 * Fields a candidate may set about themselves: the stage-1 profile capture.
 * Everything scoring- or decision-related (total_ai_score, status,
 * shortlist_status, resume_analysis, the clearance objects, current_stage_key,
 * the face reference) is deliberately excluded: those are written by the scoring
 * engine, the stage routes and staff-side reviewer actions, never taken verbatim
 * from a candidate's request. Age is not here either: it is worked out from the
 * date of birth on the server.
 */
export const CANDIDATE_SELF_FIELDS = new Set<keyof Candidate>([
  'name', 'email', 'phone', 'dob', 'qualification', 'experience_band',
  'prior_org', 'current_salary', 'expected_salary', 'current_location',
  'relocation_branches', 'languages', 'notice_period', 'applied_segment',
  'applied_subject', 'target_branch_id', 'video_intro_url',
  'reading_passage_text', 'reading_passage_score'
]);

/** Keeps only the allowed fields of `updates`. */
export function pickAllowed(updates: Record<string, unknown>, allowed: Set<keyof Candidate> = CANDIDATE_SELF_FIELDS): Partial<Candidate> {
  const out: Partial<Candidate> = {};
  for (const key of Object.keys(updates)) {
    if (allowed.has(key as keyof Candidate)) {
      (out as Record<string, unknown>)[key] = updates[key];
    }
  }
  return out;
}

/**
 * Fields only the school's staff may read: reviewers' opinions and ratings,
 * who a teacher was given to, the interview questions, the decisions and the
 * reasons. Taken off before a candidate's own browser is sent their record.
 */
export const STAFF_ONLY_FIELDS = [
  'round_assignments', 'round_reviews', 'round_questions', 'round_results', 'interview_decisions',
  'rm_clearance', 'ih_clearance', 'coo_clearance', 'rejected_by_school_reason', 'resume_analysis', 'resume_text', 'total_ai_score',
] as const;

export function candidateSelfView<T extends Partial<Candidate>>(candidate: T): T {
  const view = { ...candidateView(candidate) } as Record<string, unknown>;
  for (const key of STAFF_ONLY_FIELDS) delete view[key];
  return view as T;
}

/** What a candidate's own browser is allowed to see: no face measurements, no question ids. */
export function candidateView<T extends Partial<Candidate>>(candidate: T): T {
  const { face_reference, test_set: _testSet, ai_interview, ...rest } = candidate;
  return {
    ...rest,
    // The browser learns only where the interview stands, never the plan, transcript or report.
    ...(ai_interview ? { ai_interview: { id: ai_interview.id, status: ai_interview.status, mode: ai_interview.mode, language: ai_interview.language, plan: [], transcript: [] } } : {}),
    ...(face_reference ? { face_reference: { photo_url: face_reference.photo_url, descriptors: [], captured_at: face_reference.captured_at, measured: face_reference.descriptors.length > 0 } } : {}),
  } as T;
}
