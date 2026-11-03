import { describe, expect, it } from 'vitest';
import { postingText } from './jobPosting';
import { subjectKind } from './subjects';

const text = (subject: string) => {
  const p = postingText(subject, 'Main Campus', 'Primary (Grades 1-5)', 'CBSE', '2 years');
  return [p.summary, ...p.responsibilities, ...p.requirements].join(' ');
};

describe('postingText', () => {
  it('sorts each subject into the right kind of teacher', () => {
    expect(subjectKind('Cricket')).toBe('sports');
    expect(subjectKind('Karate / Taekwondo')).toBe('sports');
    expect(subjectKind('Music')).toBe('arts');
    expect(subjectKind('Mother Teacher')).toBe('early_years');
    expect(subjectKind('Physics')).toBe('academic');
  });

  it('never asks a coach or an arts teacher for an M.Sc, a B.Ed or lab safety', () => {
    for (const s of ['Cricket', 'Swimming', 'Dance', 'Art & Craft', 'Mother Teacher']) {
      expect(text(s)).not.toMatch(/M\.Sc|B\.Ed|laboratory|lab safety/i);
    }
    expect(text('Cricket')).toMatch(/B\.P\.Ed/);
    expect(text('Pre Primary')).toMatch(/NTT/);
  });

  it('still asks a classroom teacher for a B.Ed', () => {
    expect(text('Chemistry')).toMatch(/B\.Ed/);
    expect(text('Chemistry')).toContain('Main Campus');
  });
});
