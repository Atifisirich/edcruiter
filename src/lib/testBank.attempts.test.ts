import { describe, expect, it } from 'vitest';
import { SUBJECT_BANKS, drawTest, emptyBankState, type BankQuestion } from './testBank';

/** 6 topics of 12 questions each, for grades 9 and 10: 72 questions, so a 25-question test leaves plenty over. */
function syntheticBank(): BankQuestion[] {
  const topics = ['Cell', 'Tissues', 'Life', 'Control', 'Heredity', 'Environment'];
  return topics.flatMap((t, ti) =>
    Array.from({ length: 12 }, (_, i) => ({
      id: `att-${ti}-${i}`, g: ['9', '10'], t, k: 's' as const, q: `Question ${ti}-${i} about ${t}?`, a: `right ${ti}-${i}`, w: ['x', 'y', 'z'].map((s) => `${s} ${ti}-${i}`),
    }))
  );
}

function withBank(bank: BankQuestion[], fn: () => void) {
  const before = SUBJECT_BANKS.synthetic;
  SUBJECT_BANKS.synthetic = bank;
  try { fn(); } finally { if (before) SUBJECT_BANKS.synthetic = before; else delete SUBJECT_BANKS.synthetic; }
}

const ids = (r: ReturnType<typeof drawTest>) => (r.ok ? r.ids : []);

describe('a second go at a stage', () => {
  it('first go is exactly what candidates always got', () => {
    withBank(syntheticBank(), () => {
      const a = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState() });
      const b = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState(), attempt: 1 });
      expect(ids(a)).toEqual(ids(b));
    });
  });

  it('draws different questions, avoiding those already seen', () => {
    withBank(syntheticBank(), () => {
      const first = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState() });
      const second = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState(), attempt: 2, seen: ids(first) });
      const subjectOnly = (r: ReturnType<typeof drawTest>) => ids(r).filter((id) => id.startsWith('att-'));
      expect(subjectOnly(second)).toHaveLength(subjectOnly(first).length);
      const repeated = subjectOnly(second).filter((id) => subjectOnly(first).includes(id));
      expect(repeated).toEqual([]);
    });
  });

  it('reuses older questions only when too few new ones are left', () => {
    withBank(syntheticBank().slice(0, 30), () => {
      const first = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState() });
      const second = drawTest({ subject: 'synthetic', grades: ['9'], candidateId: 'c1', state: emptyBankState(), attempt: 2, seen: ids(first) });
      expect(second.ok).toBe(true);
    });
  });
});
