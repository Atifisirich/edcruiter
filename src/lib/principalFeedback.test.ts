import { describe, expect, it } from 'vitest';
import { EXPERIENCE_OPTIONS, experienceChoices } from './experience';
import { yearsOf } from './payGuide';
import { NO_SUBJECT, countBySubject, subjectKey } from './subjectGroups';
import { drawTest, emptyBankState, suitsSubject, PEDAGOGY_BANK } from './testBank';

describe('experience, one choice per year', () => {
  it('offers Fresher, 1 to 25 years and more, and each reads as that many years', () => {
    expect(EXPERIENCE_OPTIONS).toHaveLength(27);
    expect(yearsOf({ experience_band: '13 years' }).years).toBe(13);
    expect(yearsOf({ experience_band: 'Fresher' }).years).toBe(0);
    expect(yearsOf({ experience_band: 'More than 25 years' }).years).toBe(25);
  });
  it('keeps an older saved band selectable', () => {
    expect(experienceChoices('8+ Years')[0]).toBe('8+ Years');
    expect(experienceChoices('3 years')).toBe(EXPERIENCE_OPTIONS);
  });
});

describe('applicants by subject', () => {
  it('brings the same subject together however it was typed', () => {
    expect(subjectKey('mathematics_facilitator')).toBe('mathematics');
    expect(subjectKey('Maths')).toBe('mathematics');
    expect(subjectKey('primary_english_teacher')).toBe('english');
    expect(subjectKey('Mother Teacher')).toBe('mother teacher');
    expect(subjectKey('General')).toBe(NO_SUBJECT);
    expect(subjectKey('All subjects')).toBe(NO_SUBJECT);
  });
  it('counts them, most first and "not stated" last', () => {
    const counts = countBySubject(['General', 'General', 'General', 'English', 'Maths', 'mathematics'].map((applied_subject) => ({ applied_subject, status: 'applied' }) as never));
    expect(counts.map((c) => [c.label, c.total])).toEqual([['Mathematics', 2], ['English', 1], ['Subject not stated', 3]]);
  });
});

describe('teaching questions in a subject test', () => {
  it('never name another subject', () => {
    expect(suitsSubject('A Class 5 English teacher notices reading levels vary.', 'mathematics')).toBe(false);
    expect(suitsSubject('A Class 5 English teacher notices reading levels vary.', 'english')).toBe(true);
    expect(suitsSubject('In a Social Science lesson, a student repeats a myth.', 'physics')).toBe(false);
    expect(suitsSubject('A student is disengaged. What should the teacher do?', 'hindi')).toBe(true);
  });
  it('holds for a drawn test', () => {
    for (let i = 0; i < 20; i++) {
      const r = drawTest({ subject: 'mathematics', grades: ['6', '7', '8', '9', '10'], candidateId: `c${i}`, state: emptyBankState() });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const ped = r.questions.filter((q) => q.category === 'pedagogy');
      expect(ped).toHaveLength(5);
      for (const q of ped) expect(suitsSubject(PEDAGOGY_BANK.find((b) => b.id === q.id)!.q, 'mathematics')).toBe(true);
    }
  });
});
