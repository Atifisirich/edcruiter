import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { gridFromText, jobsFromAi, kindOfFile, readPayFile } from './payGuideImportFile';
import { readGrid } from './payGuideImport';

const ctx = { subjects: ['English'], branches: [{ id: 'b1', name: 'Tukkuguda' }, { id: 'b2', name: 'Manneguda' }], branch: 'b1' };

const book = (sheets: Record<string, unknown[][]>) => {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};

describe('opening a pay sheet', () => {
  it('reads an Excel file, and a sheet named after a campus belongs to that campus', async () => {
    const bytes = book({
      Tukkuguda: [['Role', 'Grades', '0-2 years', '2-5 years', '5+ years'], ['Primary teacher', '1-5', 18000, 22000, 28000]],
      Manneguda: [['Role', 'Grades', '0-2 years', '2-5 years', '5+ years'], ['Primary teacher', '1-5', 17000, 21000, 26000]],
    });
    const out = await readPayFile(bytes, 'pay.xlsx', ctx);
    expect(out.error).toBeUndefined();
    expect(out.method).toBe('sheet');
    expect(out.roles.map((r) => [r.name, r.branch, r.tiers[0].ideal])).toEqual([['Primary teacher', 'b1', '18000'], ['Primary teacher', 'b2', '17000']]);
  });

  it('reads a CSV, and the text of a PDF split into cells', async () => {
    const csv = new TextEncoder().encode('Role,0-2 yrs,2-5 yrs\nPrimary teacher,"18,000","22,000"\n');
    const fromCsv = await readPayFile(csv, 'pay.csv', ctx);
    expect(fromCsv.roles[0].tiers.map((t) => t.ideal)).toEqual(['18000', '22000']);

    const grid = gridFromText('Role     0-2 years   2-5 years\nPrimary teacher    18000    22000\n');
    expect(readGrid(grid)?.jobs[0].levels).toHaveLength(2);
  });

  it('says plainly when a file is the wrong kind or has no pay in it', async () => {
    expect((await readPayFile(new TextEncoder().encode('MZ'), 'run.exe', ctx)).error).toMatch(/Excel file/);
    const none = await readPayFile(book({ A: [['Name', 'Phone'], ['x', '98480 12345']] }), 'leads.xlsx', ctx);
    expect(none.error).toMatch(/No pay by experience/);
    expect(none.roles).toEqual([]);
  });

  it('knows a file by its bytes, not only its name', () => {
    expect(kindOfFile('anything.pdf', new TextEncoder().encode('%PDF-1.7'))).toBe('pdf');
    expect(kindOfFile('pay.xlsx', book({ A: [['x']] }))).toBe('sheet');
    expect(kindOfFile('pay.docx', book({ A: [['x']] }))).toBeNull();
    expect(kindOfFile('pay.csv', new TextEncoder().encode('a,b'))).toBe('csv');
  });
});

describe('what the AI hands back', () => {
  it('becomes plain jobs, with yearly figures turned into months', () => {
    const jobs = jobsFromAi({
      pay_basis: 'yearly',
      jobs: [
        { name: 'Primary', grades_text: '1-5', levels: [{ from_years: 0, to_years: 2, ideal: 240000 }, { from_years: 2, to_years: null, min: 300000, max: 360000 }], bed_topup: 24000 },
        { name: 'Empty', levels: [] },
        { levels: [{ from_years: 0 }] },
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].levels).toEqual([
      { from: 0, to: 2, min: undefined, ideal: 20000, max: undefined },
      { from: 2, to: null, min: 25000, ideal: undefined, max: 30000 },
    ]);
    expect(jobs[0].bed).toBe(2000);
  });
});
