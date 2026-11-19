import { describe, expect, it } from 'vitest';
import { cvFilename } from './cvFile';

describe('cvFilename', () => {
  it('names the file after the candidate', () => {
    expect(cvFilename('Asha Rao')).toEqual({ full: 'Asha Rao - CV.pdf', ascii: 'Asha Rao - CV.pdf' });
  });
  it('keeps accents in the full name and drops them in the plain one', () => {
    const n = cvFilename('José Müller');
    expect(n.full).toBe('José Müller - CV.pdf');
    expect(n.ascii).not.toMatch(/[^\x20-\x7e]/);
  });
  it('removes characters that cannot be in a file name or header', () => {
    const awkward = ['A', '/', 'B', String.fromCharCode(92), 'C "D"', String.fromCharCode(10)].join('');
    expect(cvFilename(awkward).full).toBe('A B C D - CV.pdf');
  });
  it('has a sensible name when the candidate has none, or only non-Latin letters', () => {
    expect(cvFilename(undefined).full).toBe('Candidate CV.pdf');
    expect(cvFilename('').ascii).toBe('Candidate CV.pdf');
    expect(cvFilename('आशा').ascii).toBe('Candidate CV.pdf');
  });
});
