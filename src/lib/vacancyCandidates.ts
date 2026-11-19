import type { Candidate, PublicVacancy } from './types';

type VacancyKey = Pick<PublicVacancy, 'id' | 'subject' | 'segment' | 'target_branch_id'>;
type CandidateKey = Pick<Candidate, 'job_id' | 'applied_subject' | 'applied_segment' | 'target_branch_id'>;

const same = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * Did this candidate apply for this vacancy? Applications since vacancies were
 * linked carry the vacancy's id. Older ones do not, so they are matched on the
 * same subject and grades (and campus, when the vacancy names one). A candidate
 * who carries the id of a different vacancy never matches by guesswork.
 */
export function appliedTo(candidate: CandidateKey, vacancy: VacancyKey): boolean {
  if (candidate.job_id) return candidate.job_id === vacancy.id;
  if (!same(candidate.applied_subject, vacancy.subject) || !same(candidate.applied_segment, vacancy.segment)) return false;
  if (vacancy.target_branch_id && candidate.target_branch_id) return candidate.target_branch_id === vacancy.target_branch_id;
  return true;
}
