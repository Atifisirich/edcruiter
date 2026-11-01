import { describe, expect, it } from 'vitest';
import { ageFromDob, dobProblem } from './age';

const today = new Date(2026, 10, 1); // 1 November 2026

describe('age from date of birth', () => {
  it('counts whole years', () => {
    expect(ageFromDob('2006-05-19', today)).toBe(20);
    expect(ageFromDob('1990-11-01', today)).toBe(36);
  });

  it('does not count the year until the birthday has come', () => {
    expect(ageFromDob('1990-11-02', today)).toBe(35);
    expect(ageFromDob('1990-12-31', today)).toBe(35);
  });

  it('gives nothing for a missing, malformed, impossible or future date', () => {
    expect(ageFromDob('', today)).toBeNull();
    expect(ageFromDob(undefined, today)).toBeNull();
    expect(ageFromDob('19/05/2006', today)).toBeNull();
    expect(ageFromDob('2006-02-31', today)).toBeNull();
    expect(ageFromDob('2030-01-01', today)).toBeNull();
  });
});

describe('what is wrong with a date of birth', () => {
  it('accepts an ordinary one', () => {
    expect(dobProblem('1995-03-10', today)).toBeNull();
  });

  it('asks for one when it is missing', () => {
    expect(dobProblem('', today)).toMatch(/enter your date of birth/);
  });

  it('refuses someone under 18 or an impossible age', () => {
    expect(dobProblem('2012-01-01', today)).toMatch(/at least 18/);
    expect(dobProblem('1900-01-01', today)).toMatch(/does not look right/);
    expect(dobProblem('2026-12-01', today)).toMatch(/does not look right/);
  });
});
