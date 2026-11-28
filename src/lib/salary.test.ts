import { describe, expect, it } from 'vitest';
import { digitsOnly, formatMonthly, readSalaryInput, salaryLabel, salaryOf, salaryUpdates } from './salary';
import { askPosition, suggestedOffer } from './payGuide';

describe('salary as rupees a month', () => {
  it('keeps only digits in a box', () => {
    expect(digitsOnly('₹35,000 / month')).toBe('35000');
    expect(digitsOnly('5 LPA')).toBe('5');
    expect(digitsOnly('00450')).toBe('450');
  });

  it('formats a figure', () => {
    expect(formatMonthly(35000)).toBe('₹35,000 / month');
  });

  it('accepts digits and refuses free text', () => {
    expect(readSalaryInput('35000', 'Expected salary')).toEqual({ ok: true, monthly: 35000 });
    expect(readSalaryInput('35,000', 'Expected salary')).toEqual({ ok: true, monthly: 35000 });
    expect(readSalaryInput(35000, 'Expected salary')).toEqual({ ok: true, monthly: 35000 });
    expect(readSalaryInput('', 'Expected salary')).toEqual({ ok: true, monthly: null });
    expect(readSalaryInput('5 LPA', 'Expected salary').ok).toBe(false);
    expect(readSalaryInput('35k', 'Expected salary').ok).toBe(false);
    expect(readSalaryInput('35000.5', 'Expected salary').ok).toBe(false);
    expect(readSalaryInput('500', 'Expected salary').ok).toBe(false); // below ₹1,000
    expect(readSalaryInput('750000000', 'Expected salary').ok).toBe(false);
  });

  it('fills both forms of each figure', () => {
    const r = salaryUpdates({ expected_salary_monthly: '40000', current_salary_monthly: 0 });
    expect(r.ok && r.updates).toEqual({ expected_salary_monthly: 40000, expected_salary: '₹40,000 / month', current_salary_monthly: 0, current_salary: 'Not working now' });
  });

  it('refuses free text, but converts it in a spreadsheet import', () => {
    expect(salaryUpdates({ expected_salary: '5 LPA' }).ok).toBe(false);
    const lenient = salaryUpdates({ expected_salary: '5 LPA', current_salary: 'negotiable' }, { lenient: true });
    expect(lenient.ok && lenient.updates.expected_salary_monthly).toBe(41667);
    expect(lenient.ok && lenient.updates.current_salary).toBe('');
    expect(lenient.ok && lenient.notes.length).toBe(2);
  });

  it('leaves untouched what was not sent', () => {
    const r = salaryUpdates({ name: 'Asha' });
    expect(r.ok && r.updates).toEqual({});
  });

  it('reads older free text and says so', () => {
    expect(salaryOf({ expected_salary: '5 LPA' }, 'expected')).toEqual({ monthly: 41667, fromText: '5 LPA' });
    expect(salaryOf({ expected_salary: '₹40,000 / month', expected_salary_monthly: 40000 }, 'expected')).toEqual({ monthly: 40000 });
    expect(salaryLabel({ expected_salary_monthly: 40000 }, 'expected')).toBe('₹40,000 / month');
    expect(salaryLabel({ current_salary_monthly: 0 }, 'current')).toBe('Not working now');
    expect(salaryLabel({}, 'current')).toBe('—');
  });
});

describe('the ask against the range', () => {
  const range = { min: 28000, ideal: 30000, max: 32000 };
  it('says where the ask sits and by how much', () => {
    expect(askPosition(30000, range)).toEqual({ where: 'within', by: 0, percent: 0 });
    expect(askPosition(38000, range)).toEqual({ where: 'above', by: 6000, percent: 19 });
    expect(askPosition(26000, range)).toEqual({ where: 'below', by: 2000, percent: 7 });
    expect(askPosition(null, range).where).toBe('unknown');
  });
  it('suggests an offer', () => {
    expect(suggestedOffer(30500, range).monthly).toBe(30500);
    expect(suggestedOffer(38000, range).monthly).toBe(32000);
    expect(suggestedOffer(26000, range).monthly).toBe(28000);
    expect(suggestedOffer(null, range).monthly).toBe(30000);
  });
});
