import { describe, expect, it } from 'vitest';
import { hasBEdCredential, highestDegreeLabel, credentialsFromCandidate } from './credentials';

describe('hasBEdCredential', () => {
  it('detects B.Ed in free text with punctuation variants', () => {
    expect(hasBEdCredential('M.Sc, B.Ed')).toBe(true);
    expect(hasBEdCredential('B Ed (Regular)')).toBe(true);
    expect(hasBEdCredential('BEd 2019')).toBe(true);
  });

  it('detects D.El.Ed as an equivalent credential', () => {
    expect(hasBEdCredential('D.El.Ed, 2021')).toBe(true);
  });

  it('returns false when no B.Ed-equivalent is present', () => {
    expect(hasBEdCredential('M.Sc Physics only')).toBe(false);
    expect(hasBEdCredential(undefined)).toBe(false);
  });

  it('trusts a positive resume_analysis status even without matching qualification text', () => {
    expect(hasBEdCredential('M.Sc Physics', 'Listed')).toBe(true);
    expect(hasBEdCredential('M.Sc Physics', 'B.Ed completed')).toBe(true);
  });

  it('does not let a negative resume_analysis phrase register as a match', () => {
    expect(hasBEdCredential('M.Sc Physics', 'Not listed')).toBe(false);
    expect(hasBEdCredential('M.Sc Physics', 'missing from CV')).toBe(false);
  });
});

describe('highestDegreeLabel', () => {
  it('prefers a Ph.D over a listed Masters', () => {
    expect(highestDegreeLabel('M.Sc, Ph.D in Physics')).toBe('Ph.D');
  });

  it('prefers Masters over Bachelors', () => {
    expect(highestDegreeLabel('B.Sc, M.Sc')).toBe('Masters');
  });

  it('prefers a specific token from degrees_found when available', () => {
    expect(highestDegreeLabel('Masters', ['M.Sc Physics'])).toBe('M.Sc Physics');
  });

  it('falls back to a cleaned string when nothing matches the priority list', () => {
    expect(highestDegreeLabel('Certificate in Montessori Training')).toContain('Montessori');
  });
});

describe('credentialsFromCandidate', () => {
  it('combines qualification text and resume analysis into one summary', () => {
    const result = credentialsFromCandidate({
      qualification: 'M.Sc Physics',
      resume_analysis: {
        qualifications_match: { degrees_found: ['M.Sc Physics'], b_ed_status: 'Listed' },
      },
    });
    expect(result.hasBEd).toBe(true);
    expect(result.bedLabel).toBe('Yes');
    expect(result.highestDegree).toBe('M.Sc Physics');
  });

  it('flags a candidate with no B.Ed evidence anywhere', () => {
    const result = credentialsFromCandidate({ qualification: 'B.Sc Physics' });
    expect(result.hasBEd).toBe(false);
    expect(result.bedLabel).toBe('No');
  });
});
