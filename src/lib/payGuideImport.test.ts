import { describe, expect, it } from 'vitest';
import { buildRoles, closeLevels, combineRoles, gradesFromText, guessBasis, parseExperience, parsePay, readGrid } from './payGuideImport';

const ctx = { subjects: ['English', 'Maths', 'Physics'], branches: [{ id: 'b1', name: 'Tukkuguda' }, { id: 'b2', name: 'Manneguda' }], branch: 'b1' };

describe('pay figures', () => {
  it('reads rupees written the usual ways', () => {
    expect(parsePay('₹25,000', 'monthly')).toEqual({ single: 25000 });
    expect(parsePay('Rs. 30000/-', 'monthly')).toEqual({ single: 30000 });
    expect(parsePay('25k', 'monthly')).toEqual({ single: 25000 });
    expect(parsePay('22,000 - 28,000', 'monthly')).toEqual({ min: 22000, max: 28000 });
    expect(parsePay('25-30k', 'monthly')).toEqual({ min: 25000, max: 30000 });
    expect(parsePay('', 'monthly')).toBeNull();
    expect(parsePay('n/a', 'monthly')).toBeNull();
    expect(parsePay('abc', 'monthly')).toBeNull();
    expect(parsePay('12', 'monthly')).toBeNull();
  });

  it('turns yearly pay into a month', () => {
    expect(parsePay('300000', 'yearly')).toEqual({ single: 25000 });
    expect(parsePay('3.6 LPA', 'monthly')).toEqual({ single: 30000 });
    expect(parsePay('2.4 lakh per annum', 'monthly')).toEqual({ single: 20000 });
    expect(guessBasis('Salary (CTC per annum)')).toBe('yearly');
    expect(guessBasis('Monthly salary')).toBe('monthly');
    expect(guessBasis('Role Grades')).toBe('monthly');
  });
});

describe('experience', () => {
  it('reads the stretches of experience schools write', () => {
    expect(parseExperience('0-2 years')).toEqual({ from: 0, to: 2 });
    expect(parseExperience('2 to 5 yrs')).toEqual({ from: 2, to: 5 });
    expect(parseExperience('5+')).toEqual({ from: 5, to: null });
    expect(parseExperience('Above 8 years')).toEqual({ from: 8, to: null });
    expect(parseExperience('Under 2 years')).toEqual({ from: 0, to: 2 });
    expect(parseExperience('Fresher')).toEqual({ from: 0, to: undefined });
    expect(parseExperience('Salary')).toBeNull();
    expect(parseExperience('25000')).toBeNull();
    expect(parseExperience('3 years')).toBeNull();
    expect(parseExperience('3 years', false)).toEqual({ from: 3, to: undefined });
  });

  it('ends each level where the next begins, and the last is open', () => {
    expect(closeLevels([{ from: 5, to: null }, { from: 0, to: undefined }, { from: 2, to: undefined }])).toEqual([
      { from: 0, to: 2 }, { from: 2, to: 5 }, { from: 5, to: null },
    ]);
    expect(closeLevels([{ from: 0, to: 3 }, { from: 2, to: 5 }]).map((l) => l.to)).toEqual([2, 5]);
  });
});

describe('grades from words', () => {
  it('understands stages, abbreviations and ranges', () => {
    expect(gradesFromText('Pre-primary teacher')).toEqual(['nursery', 'lkg', 'ukg']);
    expect(gradesFromText('PRT (Primary)')).toEqual(['1', '2', '3', '4', '5']);
    expect(gradesFromText('TGT')).toEqual(['6', '7', '8']);
    expect(gradesFromText('PGT')).toEqual(['11', '12']);
    expect(gradesFromText('Secondary teacher')).toEqual(['9', '10']);
    expect(gradesFromText('Senior Secondary')).toEqual(['11', '12']);
    expect(gradesFromText('Class 6 to 8')).toEqual(['6', '7', '8']);
    expect(gradesFromText('Grades 1, 2 and 5')).toEqual(['1', '2', '5']);
    expect(gradesFromText('1-5', true)).toEqual(['1', '2', '3', '4', '5']);
    expect(gradesFromText('Nursery, LKG & UKG', true)).toEqual(['nursery', 'lkg', 'ukg']);
    expect(gradesFromText('Accountant')).toEqual([]);
  });
});

describe('a wide pay sheet', () => {
  it('reads one row per job with a column per stretch of experience', () => {
    const grid = [
      ['Sloka International School - Teacher pay (monthly)'],
      [],
      ['Role', '0-2 years', '2-5 years', '5+ years'],
      ['Pre-primary teacher', '15000', '18,000', '22000'],
      ['Primary teacher', '₹18,000', '22,000-26,000', '30k'],
      ['PGT', '28000', '', '40000'],
    ];
    const read = readGrid(grid)!;
    expect(read.yearly).toBe(false);
    expect(read.jobs.map((j) => j.name)).toEqual(['Pre-primary teacher', 'Primary teacher', 'PGT']);
    const { roles, notes } = buildRoles(read.jobs, ctx);
    expect(notes).toEqual(['“PGT”: there is no pay for 2 to 5 years of experience. Add it, or those teachers will be priced at the lowest level.']);
    expect(roles[1].grades).toEqual(['1', '2', '3', '4', '5']);
    expect(roles[1].branch).toBe('b1');
    expect(roles[1].tiers.map((t) => [t.from, t.to, t.min, t.ideal, t.max])).toEqual([
      ['0', '2', '16000', '18000', '20500'],
      ['2', '5', '22000', '24000', '26000'],
      ['5', '', '27000', '30000', '34500'],
    ]);
    // A level left blank for one job is simply not there for it, and the gap is reported above.
    expect(roles[2].tiers.map((t) => [t.from, t.to])).toEqual([['0', '2'], ['5', '']]);
    expect(roles[0].tiers[0].auto).toBe(true);
    expect(roles[1].tiers[1].auto).toBe(false);
  });

  it('reads lowest, usual and highest in three small columns, with grades, subjects, campus and top-ups', () => {
    const grid = [
      ['Role', 'Grades', 'Subject', 'Campus', 'B.Ed top-up', '0-2 yrs', '', '', '3+ yrs', '', ''],
      ['', '', '', '', '', 'Min', 'Usual', 'Max', 'Min', 'Usual', 'Max'],
      ['Secondary teacher', '9-10', 'Physics, Alchemy', 'Manneguda', '2000', '20000', '24000', '28000', '30000', '34000', '40000'],
    ];
    const read = readGrid(grid)!;
    const { roles, notes } = buildRoles(read.jobs, ctx);
    expect(roles).toHaveLength(1);
    expect(roles[0]).toMatchObject({ name: 'Secondary teacher', grades: ['9', '10'], subjects: ['Physics'], branch: 'b2', bed: '2000' });
    expect(roles[0].tiers.map((t) => [t.from, t.to, t.min, t.ideal, t.max])).toEqual([
      ['0', '2', '20000', '24000', '28000'],
      ['3', '', '30000', '34000', '40000'],
    ]);
    expect(notes.join(' ')).toMatch(/Alchemy/);
  });

  it('divides yearly figures by twelve', () => {
    const grid = [['Post', '0-2 yrs', '2+ yrs'], ['Primary', '2.4 LPA', '3.6 LPA']];
    const read = readGrid(grid)!;
    expect(read.yearly).toBe(true);
    expect(buildRoles(read.jobs, ctx).roles[0].tiers.map((t) => t.ideal)).toEqual(['20000', '30000']);
  });

  it('keeps going past a heading line and fills a merged job name', () => {
    const grid = [
      ['Role', 'Campus', '0-2', '2+'],
      ['Primary wing'],
      ['Teacher', 'Tukkuguda', '18000', '24000'],
      ['', 'Manneguda', '17000', '22000'],
    ];
    const { roles } = buildRoles(readGrid(grid)!.jobs, ctx);
    expect(roles.map((r) => [r.name, r.branch])).toEqual([['Primary wing - Teacher', 'b1'], ['Primary wing - Teacher', 'b2']]);
    expect(roles[0].grades).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('a long pay sheet', () => {
  it('reads one row per job and level', () => {
    const grid = [
      ['Role', 'Experience', 'Salary'],
      ['Primary teacher', '0-2 years', '18000'],
      ['', '2-5 years', '22000'],
      ['', '5+ years', '28000'],
      ['TGT', '0-3 years', '25,000 - 30,000'],
      ['', '3+', '35000'],
    ];
    const { roles } = buildRoles(readGrid(grid)!.jobs, ctx);
    expect(roles.map((r) => [r.name, r.tiers.length])).toEqual([['Primary teacher', 3], ['TGT', 2]]);
    expect(roles[1].tiers[0]).toMatchObject({ from: '0', to: '3', min: '25000', ideal: '27500', max: '30000' });
  });

  it('reads From and To years with Min, Usual and Max pay', () => {
    const grid = [
      ['Role', 'From years', 'To years', 'Minimum', 'Usual', 'Maximum'],
      ['Primary', '0', '2', '15000', '18000', '21000'],
      ['Primary', '2', '', '20000', '24000', '28000'],
    ];
    const { roles } = buildRoles(readGrid(grid)!.jobs, ctx);
    expect(roles[0].tiers.map((t) => [t.from, t.to, t.ideal])).toEqual([['0', '2', '18000'], ['2', '', '24000']]);
  });
});

describe('what is not a pay sheet', () => {
  it('returns nothing for a sheet with no experience levels or pay', () => {
    expect(readGrid([['Name', 'Phone'], ['A', '98480 12345']])).toBeNull();
    expect(readGrid([['hello']])).toBeNull();
  });
});

describe('putting imported jobs in the editor', () => {
  const imported = buildRoles(readGrid([['Role', '0-2', '2+'], ['Primary teacher', '18000', '24000']])!.jobs, ctx).roles;

  it('adds beside the jobs already there, renaming a clash', () => {
    const merged = combineRoles(imported, imported, 'add');
    expect(merged.map((r) => r.name)).toEqual(['Primary teacher', 'Primary teacher (2)']);
  });

  it('replaces only the campuses the sheet covers', () => {
    const other = { ...imported[0], key: 'x', branch: 'b2', name: 'Keep me' };
    const merged = combineRoles([imported[0], other], imported, 'replace');
    expect(merged.map((r) => r.name)).toEqual(['Keep me', 'Primary teacher']);
  });

  it('puts a clashing level order right and says so', () => {
    const { roles, notes } = buildRoles([{ name: 'Odd', gradesText: '1-5', subjectsText: '', campusText: '', levels: [{ from: 0, to: null, min: 30000, ideal: 20000, max: 25000 }] }], ctx);
    expect(roles[0].tiers[0]).toMatchObject({ min: '20000', ideal: '25000', max: '30000' });
    expect(notes[0]).toMatch(/out of order/);
  });
});
