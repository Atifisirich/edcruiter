import { describe, expect, it } from 'vitest';
import { answersText, cellText, csvMatrix, leadRowsFrom, phoneIn, readSheet } from './leadSheet';

const people = (read: ReturnType<typeof readSheet>) => leadRowsFrom(read, read.mapping);

describe('reading a lead sheet', () => {
  it('reads a sheet with headings, and keeps every other column as answers', () => {
    const read = readSheet([
      ['Name', 'Email', 'Number', 'Place', 'Qualification', 'Experience', 'Do you have B.Ed?', 'Can you join in 30 days?'],
      ['Asha Rao', 'asha@gmail.com', '9876543210', 'Manneguda', 'M.Sc', '3 years', 'Yes', 'No'],
    ]);
    const [p] = people(read);
    expect(p).toMatchObject({ name: 'Asha Rao', phone: '9876543210', email: 'asha@gmail.com', location: 'Manneguda', qualification: 'M.Sc', experience: '3 years' });
    expect(p.answers).toEqual([{ q: 'Do you have B.Ed?', a: 'Yes' }, { q: 'Can you join in 30 days?', a: 'No' }]);
  });

  it('finds the people under a title row above the headings', () => {
    const read = readSheet([
      ['November leads from Facebook'],
      [],
      ['Full name', 'Phone number', 'City'],
      ['Bala K', 'p:+919876500011', 'Hyderabad'],
    ]);
    expect(read.headerRow).toBe(1);
    expect(people(read)[0]).toMatchObject({ name: 'Bala K', phone: '+919876500011', location: 'Hyderabad' });
  });

  it('reads a sheet with no headings at all, in any column order', () => {
    const read = readSheet([
      ['Hyderabad', '9876500022', 'Chitra Devi', 'chitra@gmail.com', 'Yes'],
      ['Warangal', '9876500033', 'Deepak Singh', '', 'No'],
    ]);
    expect(read.headerRow).toBeNull();
    const rows = people(read);
    expect(rows.map((r) => [r.name, r.phone])).toEqual([['Chitra Devi', '9876500022'], ['Deepak Singh', '9876500033']]);
    expect(rows[0].email).toBe('chitra@gmail.com');
    expect(rows[0].answers.map((a) => a.q)).toEqual(['Column A', 'Column E']);
  });

  it('keeps phone numbers Excel stored as numbers whole, never 9.87E+9', () => {
    expect(cellText(919876543210)).toBe('919876543210');
    expect(cellText(3.5)).toBe('3.5');
    const read = readSheet([['Name', 'Mobile'], ['Esha', 9876500044]]);
    expect(people(read)[0].phone).toBe('9876500044');
  });

  it('does not take a "School name" or a form question as the name or a field', () => {
    const read = readSheet([
      ['School name', 'Teacher name', 'Contact', 'How many years of experience do you have?'],
      ['DPS', 'Farah Khan', '9876500055', '4'],
    ]);
    const [p] = people(read);
    expect(p.name).toBe('Farah Khan');
    expect(p.experience).toBe('');
    expect(p.answers).toEqual([{ q: 'School name', a: 'DPS' }, { q: 'How many years of experience do you have?', a: '4' }]);
  });

  it('joins first and last name columns', () => {
    const read = readSheet([['First name', 'Last name', 'Mobile'], ['Gita', 'Sharma', '9876500066']]);
    expect(people(read)[0]).toMatchObject({ name: 'Gita Sharma', answers: [] });
  });

  it('uses the columns HR picked instead of the guess', () => {
    const read = readSheet([['A', 'B', 'C'], ['Hari', '9876500077', '9876500088']]);
    const rows = leadRowsFrom(read, { ...read.mapping, name: 0, phone: 2 });
    expect(rows[0]).toMatchObject({ name: 'Hari', phone: '9876500088' });
  });

  it('takes the first of two numbers in a cell, and labels are dropped', () => {
    expect(phoneIn('9876500099 / 9123456789')).toBe('9876500099');
    expect(phoneIn('Mob: +91 98765 00099')).toBe('+91 98765 00099');
    expect(phoneIn('12345')).toBe('');
    expect(phoneIn('Asha')).toBe('');
  });

  it('reads CSV with quotes and reads up to 5,000 people', () => {
    expect(csvMatrix('Name,Phone\n"Rao, Asha",9876543210')).toEqual([['Name', 'Phone'], ['Rao, Asha', '9876543210']]);
    const big = [['Name', 'Phone'], ...Array.from({ length: 5003 }, (_, i) => [`Person ${String.fromCharCode(65 + (i % 26))}`, String(9000000000 + i)])];
    const read = readSheet(big);
    expect(read.rows).toHaveLength(5000);
    expect(read.cutOff).toBe(3);
  });

  it('writes the answers as plain lines for the AI on the call', () => {
    expect(answersText([{ q: 'Do you have B.Ed?', a: 'Yes' }, { q: 'City:', a: 'Hyderabad' }])).toBe('Do you have B.Ed: Yes\nCity: Hyderabad');
  });
});
