/**
 * Comparing the face on camera with the photo taken when the candidate began.
 *
 * The browser turns a face into 128 numbers (a descriptor). Two pictures of the
 * same person give descriptors that are close together; two different people
 * give descriptors that are far apart. The comparison is done on the server, so
 * the page cannot decide for itself that the face matches.
 *
 * This is a signal for a reviewer, never proof: poor light, a new pair of
 * glasses or a very different angle can push one person's distance up, which is
 * why a single bad sample is ignored and only a run of them is reported.
 */

export const DESCRIPTOR_LENGTH = 128;

/** Pictures of one person usually sit well under 0.5; strangers usually sit above 0.7. */
export const SAME_PERSON_MAX = 0.6;
/** A sample counts against the candidate only above this, which leaves room for bad light. */
export const MISMATCH_ABOVE = 0.65;
/** Samples in a row above the line before it is reported. */
export const MISMATCH_RUN = 3;
/** The most reference descriptors kept. */
export const MAX_REFERENCES = 5;

export function isDescriptor(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === DESCRIPTOR_LENGTH
    && value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 10);
}

export function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - b[i]) ** 2;
  return Math.sqrt(sum);
}

/** The smallest distance to any of the reference descriptors (several pictures cover angle and light). */
export function bestDistance(references: number[][], sample: number[]): number {
  if (references.length === 0) return Infinity;
  return Math.min(...references.map((r) => distance(r, sample)));
}

/** Cleans what the browser sends as reference descriptors; returns null when none are usable. */
export function cleanReferences(raw: unknown): number[][] | null {
  if (!Array.isArray(raw)) return null;
  const good = raw.filter(isDescriptor).slice(0, MAX_REFERENCES);
  return good.length > 0 ? good : null;
}

/** The reference pictures should all be of one person; if two disagree, the photo session is unusable. */
export function referencesAgree(references: number[][]): boolean {
  for (let i = 0; i < references.length; i++) {
    for (let j = i + 1; j < references.length; j++) {
      if (distance(references[i], references[j]) > SAME_PERSON_MAX) return false;
    }
  }
  return true;
}

export type Verdict = 'match' | 'unclear' | 'mismatch';

export function verdictFor(d: number): Verdict {
  if (d <= SAME_PERSON_MAX) return 'match';
  if (d <= MISMATCH_ABOVE) return 'unclear';
  return 'mismatch';
}
