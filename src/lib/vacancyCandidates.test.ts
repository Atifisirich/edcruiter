import { describe, expect, it } from 'vitest';
import { appliedTo } from './vacancyCandidates';

const vacancy = { id: 'job_1', subject: 'Physics', segment: 'Secondary (Grades 9 and 10)', target_branch_id: 'br_a' };
const person = { job_id: undefined as string | undefined, applied_subject: 'Physics', applied_segment: 'Secondary (Grades 9 and 10)', target_branch_id: 'br_a' };

describe('appliedTo', () => {
  it('trusts the vacancy id when the application carries one', () => {
    expect(appliedTo({ ...person, job_id: 'job_1' }, vacancy)).toBe(true);
    expect(appliedTo({ ...person, job_id: 'job_2' }, vacancy)).toBe(false);
  });
  it('never matches a different vacancy by subject alone when an id is present', () => {
    expect(appliedTo({ ...person, job_id: 'job_9', applied_subject: 'Physics' }, vacancy)).toBe(false);
  });
  it('matches older applications on subject, grades and campus', () => {
    expect(appliedTo(person, vacancy)).toBe(true);
    expect(appliedTo({ ...person, applied_subject: ' physics ' }, vacancy)).toBe(true);
    expect(appliedTo({ ...person, applied_subject: 'Maths' }, vacancy)).toBe(false);
    expect(appliedTo({ ...person, applied_segment: 'Primary (Grades 1 to 5)' }, vacancy)).toBe(false);
    expect(appliedTo({ ...person, target_branch_id: 'br_b' }, vacancy)).toBe(false);
  });
  it('ignores the campus when either side has none', () => {
    expect(appliedTo({ ...person, target_branch_id: undefined as unknown as string }, vacancy)).toBe(true);
    expect(appliedTo(person, { ...vacancy, target_branch_id: undefined })).toBe(true);
  });
});
