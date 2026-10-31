import { describe, expect, it } from 'vitest';
import {
  PEDAGOGY_BANK, PEDAGOGY_QUESTIONS, SUBJECT_BANKS, SUBJECT_QUESTIONS, bankProblems, drawTest, emptyBankState, poolFor, present, resolveTest,
  type BankQuestion, type BankState,
} from './testBank';

/** A bank big enough to see the draw working: 6 topics, 12 questions each, for grades 9 and 10. */
function syntheticBank(): BankQuestion[] {
  const topics = ['Cell', 'Tissues', 'Life', 'Control', 'Heredity', 'Environment'];
  return topics.flatMap((t, ti) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `syn-${ti}-${i}`, g: ['9', '10'], t, k: 's' as const, q: `Question ${ti}-${i} about ${t}?`, a: `right ${ti}-${i}`, w: ['x', 'y', 'z'].map((s) => `${s} ${ti}-${i}`),
    }))
  );
}

function withBank(bank: BankQuestion[], fn: () => void) {
  const before = SUBJECT_BANKS.synthetic;
  SUBJECT_BANKS.synthetic = bank;
  try { fn(); } finally { if (before) SUBJECT_BANKS.synthetic = before; else delete SUBJECT_BANKS.synthetic; }
}

const draw = (candidateId: string, state: BankState = emptyBankState(), grades = ['9']) =>
  drawTest({ subject: 'synthetic', grades, candidateId, state });

describe('the question files', () => {
  it('have no mistakes in how the questions are written', () => {
    for (const [name, bank] of Object.entries({ ...SUBJECT_BANKS, pedagogy: PEDAGOGY_BANK })) {
      expect(bankProblems(bank), name).toEqual([]);
    }
  });

  it('catch a badly written question', () => {
    const bad: BankQuestion = { id: 'x', g: ['99'], t: '', k: 's', q: 'short', a: 'same', w: ['same', 'b', 'c'] };
    expect(bankProblems([bad, { ...bad }]).join(' ')).toMatch(/repeated id[\s\S]*too short[\s\S]*same[\s\S]*grades are not valid[\s\S]*no topic/);
  });
});

describe('drawing a test', () => {
  it('gives the same questions to the same candidate every time', () => {
    withBank(syntheticBank(), () => {
      const a = draw('cand-1');
      const b = draw('cand-1');
      expect(a.ok && b.ok).toBe(true);
      if (a.ok && b.ok) expect(a.ids).toEqual(b.ids);
    });
  });

  it('gives different candidates different tests', () => {
    withBank(syntheticBank(), () => {
      const sets = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => {
        const t = draw(`cand-${id}`);
        return t.ok ? t.ids.filter((i) => !PEDAGOGY_BANK.some((p) => p.id === i)) : [];
      });
      const overlaps = sets.slice(1).map((s) => s.filter((id) => sets[0].includes(id)).length);
      // 25 of 72, drawn at random: two tests share nowhere near all of their questions.
      expect(Math.max(...overlaps)).toBeLessThan(SUBJECT_QUESTIONS - 5);
      expect(new Set(sets.map((s) => s.join(','))).size).toBe(sets.length);
    });
  });

  it('spreads the test across the topics', () => {
    withBank(syntheticBank(), () => {
      const t = draw('cand-1');
      if (!t.ok) throw new Error('draw failed');
      const topics = t.ids.filter((id) => id.startsWith('syn-')).map((id) => id.split('-')[1]);
      const counts = [0, 1, 2, 3, 4, 5].map((n) => topics.filter((x) => x === String(n)).length);
      expect(counts.every((c) => c >= 3 && c <= 5)).toBe(true);
    });
  });

  it('adds the teaching questions, and mixes everything together', () => {
    withBank(syntheticBank(), () => {
      const t = draw('cand-1');
      if (!t.ok) throw new Error('draw failed');
      expect(t.questions).toHaveLength(SUBJECT_QUESTIONS + PEDAGOGY_QUESTIONS);
      expect(t.questions.filter((q) => q.category === 'pedagogy')).toHaveLength(PEDAGOGY_QUESTIONS);
      expect(new Set(t.ids).size).toBe(t.ids.length);
    });
  });

  it('shows each question with its own option order, always including the right answer', () => {
    const q = SUBJECT_BANKS.biology[0];
    const a = present(q, 'cand-1');
    expect(a.options).toHaveLength(4);
    expect(a.options).toContain(q.a);
    expect(a.correct_option).toBe(q.a);
    expect(present(q, 'cand-1').options).toEqual(a.options);
    const orders = new Set(['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((c) => present(q, c).options.join('|')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('prefers the questions that have been used least', () => {
    withBank(syntheticBank(), () => {
      const bank = SUBJECT_BANKS.synthetic;
      // In every topic the first six questions are worn out and the other six are fresh.
      const wornIds = bank.filter((_, i) => i % 12 < 6).map((q) => q.id);
      const worn: BankState = { exposures: Object.fromEntries(wornIds.map((id) => [id, 50])), retired: [] };
      const t = draw('cand-1', worn);
      if (!t.ok) throw new Error('draw failed');
      const used = t.ids.filter((id) => id.startsWith('syn-'));
      // A test needs about four per topic, and every topic has six fresh ones to give.
      expect(used.some((id) => wornIds.includes(id))).toBe(false);
    });
  });

  it('never uses a retired question', () => {
    withBank(syntheticBank(), () => {
      const state: BankState = { exposures: {}, retired: SUBJECT_BANKS.synthetic.slice(0, 40).map((q) => q.id) };
      const t = draw('cand-1', state);
      if (!t.ok) throw new Error('draw failed');
      expect(t.ids.some((id) => state.retired.includes(id))).toBe(false);
    });
  });

  it('only uses questions for the grades asked for', () => {
    withBank(syntheticBank(), () => {
      const bank = syntheticBank().map((q, i) => (i < 40 ? { ...q, g: ['3'] } : q));
      SUBJECT_BANKS.synthetic = bank;
      expect(poolFor(bank, ['3'], emptyBankState()).length).toBe(40);
      expect(poolFor(bank, ['9'], emptyBankState()).length).toBe(32);
      const forNine = draw('cand-1', emptyBankState(), ['9']);
      expect(forNine.ok).toBe(true);
      if (forNine.ok) {
        const grade3Only = new Set(bank.slice(0, 40).map((q) => q.id));
        expect(forNine.ids.some((id) => grade3Only.has(id))).toBe(false);
      }
    });
  });

  it('falls back when the bank is too small or the subject has none', () => {
    expect(drawTest({ subject: 'sanskrit', grades: ['9'], candidateId: 'c', state: emptyBankState() })).toEqual({ ok: false, reason: 'no_bank', poolSize: 0 });
    // A subject the bank is set up for but has not been filled yet falls back the same way.
    expect(drawTest({ subject: 'chemistry', grades: ['9'], candidateId: 'c', state: emptyBankState() })).toMatchObject({ ok: false, reason: 'pool_too_small' });
    const small = drawTest({ subject: 'biology', grades: ['9'], candidateId: 'c', state: emptyBankState() });
    expect(small.ok).toBe(true); // the pilot has 30 grade 9-10 questions, enough for 25
    const wrongGrade = drawTest({ subject: 'biology', grades: ['3'], candidateId: 'c', state: emptyBankState() });
    expect(wrongGrade).toMatchObject({ ok: false, reason: 'pool_too_small' });
  });
});

describe('resolving a saved test', () => {
  it('rebuilds exactly what the candidate was shown', () => {
    const t = drawTest({ subject: 'biology', grades: ['9'], candidateId: 'cand-9', state: emptyBankState() });
    if (!t.ok) throw new Error('draw failed');
    expect(resolveTest(t.ids, 'cand-9')).toEqual(t.questions);
  });

  it('skips a question that no longer exists', () => {
    expect(resolveTest(['bio-001', 'gone-001'], 'c')).toHaveLength(1);
  });
});
