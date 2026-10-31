import { describe, expect, it } from 'vitest';
import { cleanGrades, describeGrades, gradesFromSegment, levelName, segmentFromGrades } from './grades';
import { segmentTier } from './questionBank';

describe('individual grades', () => {
  it('keeps real grades only, once each, in school order', () => {
    expect(cleanGrades(['5', '1', '2', '2', '13', 'x', 'LKG'])).toEqual(['lkg', '1', '2', '5']);
    expect(cleanGrades('nope')).toEqual([]);
  });

  it('describes a set in plain words', () => {
    expect(describeGrades(['1', '2', '5'])).toBe('Grades 1, 2 and 5');
    expect(describeGrades(['4'])).toBe('Grade 4');
    expect(describeGrades(['nursery', 'lkg'])).toBe('Nursery and LKG');
    expect(describeGrades([])).toBe('');
  });

  it('names the level from the highest grade', () => {
    expect(levelName(['nursery', 'ukg'])).toBe('Pre-primary');
    expect(levelName(['1', '2', '5'])).toBe('Primary');
    expect(levelName(['5', '6'])).toBe('Middle School');
    expect(levelName(['9'])).toBe('Secondary');
    expect(levelName(['10', '11'])).toBe('Senior Secondary');
  });
});

describe('the segment written from grades', () => {
  it('lists exactly the grades chosen', () => {
    expect(segmentFromGrades(['1', '2', '5'])).toBe('Primary (Grades 1, 2 and 5)');
    expect(segmentFromGrades(['9'])).toBe('Secondary (Grade 9)');
  });

  it('shortens one unbroken run of three or more', () => {
    expect(segmentFromGrades(['1', '2', '3', '4', '5'])).toBe('Primary (Grades 1–5)');
    expect(segmentFromGrades(['6', '7'])).toBe('Middle School (Grades 6 and 7)');
  });

  it('is empty when nothing is chosen', () => {
    expect(segmentFromGrades([])).toBe('');
  });

  it('is still read correctly by test matching, which looks at the level', () => {
    expect(segmentTier(segmentFromGrades(['1', '2', '5']))).toBe('primary');
    expect(segmentTier(segmentFromGrades(['nursery', 'lkg']))).toBe('primary');
    expect(segmentTier(segmentFromGrades(['6', '7', '8']))).toBe('middle');
    expect(segmentTier(segmentFromGrades(['9', '10']))).toBe('secondary');
    expect(segmentTier(segmentFromGrades(['11', '12']))).toBe('senior');
    expect(segmentTier(segmentFromGrades(['10', '11']))).toBe('senior');
  });
});

describe('reading grades back out of a segment', () => {
  it('round-trips what this file writes', () => {
    for (const grades of [['1', '2', '5'], ['4'], ['1', '2', '3', '4', '5'], ['lkg', 'ukg'], ['11', '12']]) {
      expect(gradesFromSegment(segmentFromGrades(grades))).toEqual(cleanGrades(grades));
    }
  });

  it('understands the older bands', () => {
    expect(gradesFromSegment('Primary (Grades 1–5, 6–11 yrs)')).toEqual(['1', '2', '3', '4', '5']);
    expect(gradesFromSegment('Senior Secondary (Grades 11–12, 16–18 yrs)')).toEqual(['11', '12']);
    expect(gradesFromSegment('Secondary (Grades 9-10)')).toEqual(['9', '10']);
    expect(gradesFromSegment('Middle School')).toEqual(['6', '7', '8']);
    expect(gradesFromSegment('Primary')).toEqual(['1', '2', '3', '4', '5']);
  });

  it('gives nothing for text with no grades in it', () => {
    expect(gradesFromSegment('')).toEqual([]);
    expect(gradesFromSegment('All grades')).toEqual([]);
  });
});
