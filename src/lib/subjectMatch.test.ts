import { describe, expect, it } from 'vitest';
import { hasBuiltInBank, normalizeSubject, pickActivePack, sameSubject } from './subjectMatch';
import type { AssessmentPack } from './types';

const pack = (over: Partial<AssessmentPack>): AssessmentPack =>
  ({ id: 'p', school_id: 's', status: 'active', subject: 'Physics', segment: 'Secondary (Grades 9-10)', mcqs: [], ...over } as AssessmentPack);

describe('normalizeSubject', () => {
  it('treats the usual spellings of one subject as the same', () => {
    expect(sameSubject('Biology', 'Biology / Life Sciences')).toBe(true);
    expect(sameSubject('Maths', 'Mathematics')).toBe(true);
    expect(sameSubject('Computer Science', 'Computer Applications')).toBe(true);
    expect(sameSubject('IT', 'information technology')).toBe(true);
  });

  it('never folds one subject into another', () => {
    expect(sameSubject('Computer Science', 'Physics')).toBe(false);
    expect(sameSubject('Chemistry', 'Physics')).toBe(false);
    expect(sameSubject('Computer Science', 'Biology')).toBe(false);
    expect(normalizeSubject('Sanskrit')).toBe('sanskrit');
  });

  it('keeps an unknown subject as itself and never matches an empty one', () => {
    expect(normalizeSubject('Robotics')).toBe('robotics');
    expect(sameSubject('', '')).toBe(false);
    expect(sameSubject(undefined, 'Physics')).toBe(false);
  });
});

describe('hasBuiltInBank', () => {
  it('is true only for the four subjects the built-in bank really has', () => {
    expect(hasBuiltInBank('Physics')).toBe(true);
    expect(hasBuiltInBank('Maths')).toBe(true);
    expect(hasBuiltInBank('Computer Science')).toBe(false);
    expect(hasBuiltInBank('Chemistry')).toBe(false);
  });
});

describe('pickActivePack', () => {
  const packs = [
    pack({ id: 'phy', subject: 'Physics' }),
    pack({ id: 'cs', subject: 'Computer Science' }),
    pack({ id: 'cs-draft', subject: 'Computer Science', segment: 'Primary (Grades 1-5)', status: 'draft' }),
    pack({ id: 'bio-sr', subject: 'Biology', segment: 'Senior Secondary (Grades 11-12)' })
  ];

  it('gives each candidate the test for their own subject', () => {
    expect(pickActivePack(packs, 'Computer Science', 'Secondary (Grades 9-10)')?.id).toBe('cs');
    expect(pickActivePack(packs, 'Physics', 'Secondary (Grades 9-10)')?.id).toBe('phy');
  });

  it('needs the grade level to match too, and ignores drafts', () => {
    expect(pickActivePack(packs, 'Biology', 'Secondary (Grades 9-10)')).toBeNull();
    expect(pickActivePack(packs, 'Computer Science', 'Primary (Grades 1-5)')).toBeNull();
  });

  it('returns nothing rather than another subject\'s test', () => {
    expect(pickActivePack(packs, 'Chemistry', 'Secondary (Grades 9-10)')).toBeNull();
  });
});
