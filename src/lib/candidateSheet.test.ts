import { describe, expect, it } from 'vitest';
import { candidatesFrom, readCandidateSheet, rowProblem } from './candidateSheet';

const PEOPLE = [
  ['Asha Rao', '9876500001', 'Pre primary teacher'],
  ['Neha Singh', '9876500002', 'Pre primary teacher'],
  ['Divya K', '9876500003', 'Counsellor'],
  ['Sana Ali', '9876500004', 'Pre primary teacher'],
  ['Ravi Kumar', '9876500005', 'Teacher'],
  ['Meena Iyer', '9876500006', 'Pre primary teacher'],
];
const read = (m: unknown[][]) => candidatesFrom(readCandidateSheet(m));

describe('candidate sheets as schools send them (Meridian: name, number, post)', () => {
  it('keeps all six people when there is no heading row', () => {
    const rows = read(PEOPLE);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ name: 'Asha Rao', phone: '9876500001', subject: 'Pre primary teacher', segment: 'Pre-primary (Nursery, LKG and UKG)' });
    expect(rows[2]).toMatchObject({ name: 'Divya K', phone: '9876500003', subject: 'Counsellor' });
  });

  it('does not take the job title for the name when names are one word', () => {
    const rows = read(PEOPLE.map((r, i) => [['Asha', 'Neha', 'Divya', 'Sana', 'Ravi', 'Meena'][i], r[1], r[2]]));
    expect(rows.map((r) => r.name)).toEqual(['Asha', 'Neha', 'Divya', 'Sana', 'Ravi', 'Meena']);
  });

  it.each([
    [['Sl', 'Details', 'Teacher post']],
    [['Name', 'Phone', 'Position']],
    [['Candidates', 'Contact', 'Designation']],
  ])('reads headings %s', (headings) => {
    const rows = read([headings, ...PEOPLE]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({ name: 'Asha Rao', phone: '9876500001', subject: 'Pre primary teacher' });
  });

  it('reads Excel number cells as phone numbers', () => {
    expect(read([['Asha Rao', 9876500001, 'Teacher']])[0].phone).toBe('9876500001');
  });

  it('lets HR change a column', () => {
    const sheet = readCandidateSheet(PEOPLE);
    expect(candidatesFrom(sheet, { name: 0, phone: 1 })[0].subject).toBe('General');
  });

  it('still reads the template, salaries included', () => {
    const [row] = read([
      ['Name', 'Email', 'Phone', 'Subject', 'Segment', 'Qualification', 'Experience', 'PreviousSchool', 'CurrentSalaryMonthly', 'ExpectedSalaryMonthly'],
      ['Priya Nair', 'priya@gmail.com', '+91 98765 11223', 'Physics', 'Senior Secondary (Grades 11-12)', 'M.Sc', '4 Years', 'DPS', '42000', '48000'],
    ]);
    expect(row).toMatchObject({ name: 'Priya Nair', email: 'priya@gmail.com', subject: 'Physics', segment: 'Senior Secondary (Grades 11-12)', current_salary_monthly: 42000, expected_salary_monthly: 48000 });
  });
});

describe('rowProblem', () => {
  it('blocks a phone that is not a number', () => {
    expect(rowProblem({ name: 'Asha', phone: 'Pre primary teacher', email: '' })).toContain('not a phone number');
    expect(rowProblem({ name: 'Asha', phone: '9876500001', email: '' })).toBeNull();
    expect(rowProblem({ name: 'Asha', phone: '', email: 'a@b.com' })).toBeNull();
    expect(rowProblem({ name: 'Asha', phone: '', email: '' })).toBe('Needs a phone or email.');
    expect(rowProblem({ name: '', phone: '9876500001', email: '' })).toBe('Needs a name.');
  });
});
