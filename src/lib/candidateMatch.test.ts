import { describe, expect, it } from 'vitest';
import { candidateMatchesIdentifier } from './candidateMatch';
import { Candidate } from './types';

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'cand_priya',
    school_id: 'school_1',
    name: 'Priya Nair',
    email: 'priya.nair@example.com',
    phone: '+91 98765 43210',
    dob: '1990-01-01',
    qualification: 'M.Sc, B.Ed',
    experience_band: '2 – 4 years',
    prior_org: 'Greenwood School',
    current_salary: '6 LPA',
    expected_salary: '8 LPA',
    current_location: 'Hyderabad',
    relocation_branches: [],
    languages: ['English'],
    notice_period: '30 days',
    applied_segment: 'Secondary (Grades 9-10)',
    applied_subject: 'Physics',
    target_branch_id: 'branch_gachibowli',
    status: 'in_progress',
    current_stage_key: 'identity_verification',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('candidateMatchesIdentifier', () => {
  it('matches the exact candidate id, case-insensitively', () => {
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('CAND_PRIYA', c)).toBe(true);
  });

  it('matches the exact email, case-insensitively', () => {
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('Priya.Nair@Example.com', c)).toBe(true);
  });

  it('matches a phone number typed with different formatting', () => {
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('9876543210', c)).toBe(true);
    expect(candidateMatchesIdentifier('919876543210', c)).toBe(true);
  });

  it('does NOT match on a partial digit substring of the phone number', () => {
    // Regression test: the previous implementation used bidirectional
    // `includes()`, so identifier "1" matched any phone number containing a
    // "1" — effectively letting a single-digit guess authenticate as any
    // candidate whose phone happened to contain that digit.
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('1', c)).toBe(false);
    expect(candidateMatchesIdentifier('987', c)).toBe(false);
  });

  it('does NOT match on the candidate name', () => {
    // Regression test: name matching let anyone who knew a candidate's
    // public name "log in" as them with no secret at all.
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('Priya Nair', c)).toBe(false);
    expect(candidateMatchesIdentifier('priya nair', c)).toBe(false);
  });

  it('does not match an unrelated identifier', () => {
    const c = makeCandidate();
    expect(candidateMatchesIdentifier('someone.else@example.com', c)).toBe(false);
  });

  it('does not match when the candidate has no phone on file', () => {
    const c = makeCandidate({ phone: '' });
    expect(candidateMatchesIdentifier('9876543210', c)).toBe(false);
  });
});
