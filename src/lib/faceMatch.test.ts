import { describe, expect, it } from 'vitest';
import {
  DESCRIPTOR_LENGTH, MISMATCH_ABOVE, SAME_PERSON_MAX, bestDistance, cleanReferences, distance, isDescriptor, referencesAgree, verdictFor,
} from './faceMatch';

/** A made-up face: 128 numbers, nudged by `shift` along the first few places. */
const face = (seed: number, shift = 0): number[] =>
  Array.from({ length: DESCRIPTOR_LENGTH }, (_, i) => Math.sin(seed * 1000 + i) * 0.1 + (i < 4 ? shift : 0));

describe('face measurements', () => {
  it('accepts exactly 128 sensible numbers', () => {
    expect(isDescriptor(face(1))).toBe(true);
    expect(isDescriptor(face(1).slice(1))).toBe(false);
    expect(isDescriptor([...face(1).slice(1), NaN])).toBe(false);
    expect(isDescriptor([...face(1).slice(1), 99])).toBe(false);
    expect(isDescriptor('not an array')).toBe(false);
  });

  it('keeps only usable reference measurements, and at most five', () => {
    expect(cleanReferences('x')).toBeNull();
    expect(cleanReferences([[1, 2, 3]])).toBeNull();
    expect(cleanReferences([face(1), [1, 2], face(2)])).toHaveLength(2);
    expect(cleanReferences(Array.from({ length: 9 }, (_, i) => face(i)))).toHaveLength(5);
  });
});

describe('comparing faces', () => {
  it('is zero for the same measurements and grows as they differ', () => {
    expect(distance(face(1), face(1))).toBe(0);
    expect(distance(face(1), face(1, 0.1))).toBeLessThan(distance(face(1), face(1, 0.5)));
  });

  it('uses the closest of several reference pictures', () => {
    const refs = [face(1), face(1, 0.3)];
    expect(bestDistance(refs, face(1, 0.28))).toBeLessThan(0.05);
    expect(bestDistance([], face(1))).toBe(Infinity);
  });

  it('calls a close face a match, a far face a mismatch, and the gap between them unclear', () => {
    expect(verdictFor(0.3)).toBe('match');
    expect(verdictFor(SAME_PERSON_MAX)).toBe('match');
    expect(verdictFor((SAME_PERSON_MAX + MISMATCH_ABOVE) / 2)).toBe('unclear');
    expect(verdictFor(MISMATCH_ABOVE + 0.01)).toBe('mismatch');
    expect(verdictFor(Infinity)).toBe('mismatch');
  });

  it('notices when the reference pictures are not of one person', () => {
    expect(referencesAgree([face(1), face(1, 0.05)])).toBe(true);
    expect(referencesAgree([face(1), face(1, 1.0)])).toBe(false);
  });
});
