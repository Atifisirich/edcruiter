import { describe, expect, it } from 'vitest';
import { questionsFor, summarize } from './bankCatalog';
import { SUBJECT_BANKS, type BankQuestion } from './testBank';
import { curriculumLabel, followsBoard, testSubjects } from './subjects';

const q = (id: string, g: string[], t: string): BankQuestion => ({ id, g, t, k: 's', q: `Question ${id} text here`, a: 'right', w: ['x', 'y', 'z'] });

describe('question bank catalogue', () => {
  const banks = { maths: [q('m1', ['6'], 'Fractions'), q('m2', ['6'], 'Algebra'), q('m3', ['7'], 'Algebra'), q('m4', ['10'], 'Algebra')] };

  it('counts each subject by grade, in grade order', () => {
    const [s] = summarize(banks, { exposures: {}, retired: ['m2'] });
    expect(s.total).toBe(4);
    expect(s.retired).toBe(1);
    expect(s.grades).toEqual([
      { grade: '6', count: 2, topics: 2 },
      { grade: '7', count: 1, topics: 1 },
      { grade: '10', count: 1, topics: 1 },
    ]);
  });

  it('lists one grade with answers, usage and retired flags, sorted by topic', () => {
    const list = questionsFor(banks.maths, '6', { exposures: { m1: 3 }, retired: ['m2'] });
    expect(list.map((x) => x.id)).toEqual(['m2', 'm1']);
    expect(list[1]).toMatchObject({ answer: 'right', used: 3, retired: false, topic: 'Fractions' });
    expect(list[0].retired).toBe(true);
  });

  it('covers every subject the real bank has', () => {
    const keys = summarize(SUBJECT_BANKS, { exposures: {}, retired: [] }).map((s) => s.label);
    expect(keys).toContain('English');
    expect(keys).toContain('Physics');
  });
});

describe('subjects and boards', () => {
  it('offers the full subject list for AI tests, with the school\'s own added once', () => {
    const list = testSubjects(['Psychology', 'Robotics', ' robotics ']);
    expect(list).toContain('Psychology');
    expect(list).toContain('Economics');
    expect(list.filter((s) => s.toLowerCase() === 'robotics')).toHaveLength(1);
  });

  it('writes ticked boards as one readable line', () => {
    expect(curriculumLabel(['CBSE'])).toBe('CBSE');
    expect(curriculumLabel(['CBSE', 'Cambridge IGCSE'])).toBe('CBSE and Cambridge IGCSE');
    expect(curriculumLabel(['CBSE', 'ICSE', 'State Board'])).toBe('CBSE, ICSE and State Board');
  });

  it('finds a board in old and new vacancy text alike', () => {
    expect(followsBoard('CBSE & Cambridge IGCSE', 'Cambridge IGCSE')).toBe(true);
    expect(followsBoard('CBSE and Cambridge IGCSE', 'CBSE')).toBe(true);
    expect(followsBoard('Cambridge IGCSE', 'ICSE')).toBe(false);
    expect(followsBoard('ICSE / ISC Board', 'ISC')).toBe(true);
    expect(followsBoard('IB World School (PYP/MYP/DP)', 'IB (PYP/MYP/DP)')).toBe(true);
    expect(followsBoard('Cambridge IGCSE & A-Levels', 'Cambridge A-Levels')).toBe(true);
  });
});
