/**
 * Reading a lead spreadsheet the way HR actually gets one: from a job portal,
 * a Facebook lead form or an ad, with or without a heading row, sometimes with
 * a title above the headings, phone numbers that Excel turned into numbers,
 * and extra columns for the form's own questions ("Do you have B.Ed?").
 *
 * The name and phone columns are found by what is in them, not only by their
 * heading, and HR can correct the guess before anything is saved. Every other
 * column is kept as the person's form answers. Pure, so it is tested without
 * a browser.
 */

export const MAX_LEAD_ROWS = 5000;
const MAX_ANSWERS = 25;

export type LeadField = 'name' | 'phone' | 'email' | 'subject' | 'segment' | 'qualification' | 'experience' | 'prior_org' | 'location';

export interface SheetColumn {
  index: number;
  /** The heading as written, or "Column C" when the sheet has none. */
  header: string;
  /** The first few values, to help HR tell columns apart. */
  sample: string[];
}

export interface SheetRead {
  /** Which row held the headings (0-based), or null when the sheet starts straight with people. */
  headerRow: number | null;
  columns: SheetColumn[];
  mapping: Partial<Record<LeadField, number>>;
  /** The people's rows, headings and empty rows left out. */
  rows: string[][];
  /** How many rows were left out because the sheet had more than MAX_LEAD_ROWS. */
  cutOff: number;
}

export interface LeadSheetRow {
  name: string;
  phone: string;
  email: string;
  subject: string;
  segment: string;
  qualification: string;
  experience: string;
  prior_org: string;
  location: string;
  /** Every other column: the lead form's questions and their answers. */
  answers: { q: string; a: string }[];
}

/**
 * One cell as text. A whole number of 7 or more digits (a phone Excel stored as
 * a number) is written out in full, never as "9.19877E+11".
 */
export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '';
    return Number.isInteger(v) && Math.abs(v) >= 1e6 ? v.toFixed(0) : String(v);
  }
  return String(v).replace(/\s+/g, ' ').trim();
}

/** The phone number in a cell, as written but without labels like "p:" (Facebook) or "Mob:". Only the first of two numbers. */
export function phoneIn(cell: string): string {
  const first = cell.split(/[\/,;|]| or /i)[0] ?? '';
  const cleaned = first.replace(/^\s*(p|tel|ph|mob|mobile|phone)\s*[:.-]\s*/i, '').trim();
  if (!/^[\s+().\-\d]+$/.test(cleaned)) return '';
  const digits = cleaned.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? cleaned : '';
}

const isPhone = (cell: string) => phoneIn(cell) !== '';
const isEmail = (cell: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell.trim());
const isYesNo = (cell: string) => /^(yes|no|y|n|true|false|haan|nahi)$/i.test(cell.trim());
const looksLikeName = (cell: string) => {
  const t = cell.trim();
  if (!/^[A-Za-z][A-Za-z.' -]{1,59}$/.test(t) || isYesNo(t)) return false;
  const words = t.split(/\s+/).length;
  return words >= 1 && words <= 5;
};

const norm = (h: string) => h.toLowerCase().replace(/[_/]+/g, ' ').replace(/[^a-z0-9.& ]+/g, ' ').replace(/\s+/g, ' ').trim();
const shortHeader = (h: string) => norm(h).split(' ').filter(Boolean).length <= 4 && !h.includes('?');

const NAME_HEADER = /^(full name|name|candidate|candidate name|applicant|applicant name|teacher|teacher name|your name|first name|lead name|contact name)$/;
const NOT_A_PERSON = /school|father|mother|institute|college|company|organi[sz]ation|spouse|guardian|reference|referr/;
const PHONE_HEADER = /phone|mobile|mob|whatsapp|contact|cell|number|ph no|tel/;
const OTHER_HEADERS: [Exclude<LeadField, 'name' | 'phone' | 'email'>, RegExp][] = [
  ['subject', /^(subject|subjects|applied subject|subject applied|discipline|department)$/],
  ['segment', /^(segment|grade|grades|level|class|classes)$/],
  ['qualification', /^(qualification|qualifications|highest qualification|degree|education|educational qualification)$/],
  ['experience', /^(experience|exp|total experience|years of experience|work experience|teaching experience)$/],
  ['prior_org', /^(previous school|prior school|last school|current school|current organisation|current organization|organisation|organization|employer)$/],
  ['location', /^(place|city|location|area|current location|address|town|district)$/],
];

/** Reads a sheet given as rows of cells (from Excel or CSV). */
export function readSheet(matrix: unknown[][]): SheetRead {
  const all = matrix.map((r) => (Array.isArray(r) ? r : []).map(cellText));
  const filled = all.filter((r) => r.some((c) => c));
  if (!filled.length) return { headerRow: null, columns: [], mapping: {}, rows: [], cutOff: 0 };

  // The people start at the first row with a phone number; the headings are the fullest row above it.
  const firstPerson = filled.findIndex((r) => r.some(isPhone));
  let headerRow: number | null = null;
  if (firstPerson > 0) {
    let best = -1;
    for (let i = 0; i < firstPerson; i++) {
      const n = filled[i].filter(Boolean).length;
      if (n >= best) { best = n; headerRow = i; }
    }
  } else if (firstPerson < 0) {
    // No phone numbers anywhere: treat the first row as headings if it reads like them.
    headerRow = filled[0].every((c) => !c || !/\d{4,}/.test(c)) && filled.length > 1 ? 0 : null;
  }

  const headings = headerRow === null ? [] : filled[headerRow];
  const people = headerRow === null ? filled : filled.slice(headerRow + 1);
  const rows = people.slice(0, MAX_LEAD_ROWS);
  const cutOff = Math.max(0, people.length - MAX_LEAD_ROWS);
  const width = Math.max(headings.length, ...rows.slice(0, 200).map((r) => r.length), 0);

  const columns: SheetColumn[] = [];
  for (let i = 0; i < width; i++) {
    const header = headings[i] || `Column ${columnLetter(i)}`;
    columns.push({ index: i, header, sample: rows.map((r) => r[i] ?? '').filter(Boolean).slice(0, 3) });
  }

  return { headerRow, columns, mapping: guessMapping(columns, rows, headerRow !== null), rows, cutOff };
}

export function columnLetter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function share(rows: string[][], col: number, test: (c: string) => boolean): number {
  const vals = rows.slice(0, 100).map((r) => r[col] ?? '').filter(Boolean);
  return vals.length ? vals.filter(test).length / vals.length : 0;
}

function guessMapping(columns: SheetColumn[], rows: string[][], hasHeadings: boolean): Partial<Record<LeadField, number>> {
  const map: Partial<Record<LeadField, number>> = {};
  const used = new Set<number>();
  const take = (f: LeadField, i: number | undefined) => { if (i !== undefined && i >= 0) { map[f] = i; used.add(i); } };
  const h = (c: SheetColumn) => (hasHeadings ? norm(c.header) : '');

  // Phone: the column most full of phone numbers; a phone-like heading wins a tie.
  const phoneScores = columns.map((c) => share(rows, c.index, isPhone) + (PHONE_HEADER.test(h(c)) ? 0.05 : 0));
  const bestPhone = phoneScores.reduce((b, s, i) => (s > (phoneScores[b] ?? -1) ? i : b), -1);
  if (bestPhone >= 0 && phoneScores[bestPhone] >= 0.3) take('phone', bestPhone);

  const emailCol = columns.find((c) => !used.has(c.index) && share(rows, c.index, isEmail) >= 0.3);
  take('email', emailCol?.index);

  // Name: a heading that says so (not "School name" or "Father's name"), else the column that reads most like names.
  const byHeading = columns.find((c) => !used.has(c.index) && NAME_HEADER.test(h(c)) && !NOT_A_PERSON.test(h(c)));
  if (byHeading) take('name', byHeading.index);
  else {
    // Names are mostly two or more words and mostly different; a place or a "Yes" column repeats and is one word.
    const scores = columns.map((c) => {
      if (used.has(c.index) || NOT_A_PERSON.test(h(c))) return 0;
      const vals = rows.slice(0, 100).map((r) => r[c.index] ?? '').filter(Boolean);
      if (!vals.length) return 0;
      const multi = vals.filter((v) => v.trim().split(/\s+/).length >= 2).length / vals.length;
      const distinct = new Set(vals.map((v) => v.toLowerCase())).size / vals.length;
      const names = share(rows, c.index, looksLikeName);
      return names >= 0.5 ? names * (0.6 + 0.4 * multi) * (0.5 + 0.5 * distinct) : 0;
    });
    const best = scores.reduce((b, s, i) => (s > (scores[b] ?? -1) ? i : b), -1);
    if (best >= 0 && scores[best] > 0) take('name', best);
  }

  // The rest only by a short heading, so a form question such as "Do you have teaching experience?" stays a question.
  if (hasHeadings) {
    for (const [field, re] of OTHER_HEADERS) {
      const c = columns.find((col) => !used.has(col.index) && shortHeader(col.header) && re.test(norm(col.header)));
      take(field, c?.index);
    }
  }
  return map;
}

/** The people, using the columns HR confirmed. Rows without a name or a phone are kept here; the server skips and lists them. */
export function leadRowsFrom(read: Pick<SheetRead, 'rows' | 'columns'>, mapping: Partial<Record<LeadField, number>>): LeadSheetRow[] {
  const used = new Set(Object.values(mapping).filter((v): v is number => typeof v === 'number'));
  // "First name" and "Last name" in two columns make one name.
  const nameHeader = mapping.name !== undefined ? norm(read.columns[mapping.name]?.header ?? '') : '';
  const last = nameHeader === 'first name' ? read.columns.find((c) => /^(last name|surname)$/.test(norm(c.header)))?.index : undefined;
  if (last !== undefined) used.add(last);
  const at = (r: string[], f: LeadField) => (mapping[f] === undefined ? '' : (r[mapping[f]!] ?? '').trim());

  return read.rows.map((r) => {
    const answers: { q: string; a: string }[] = [];
    for (const c of read.columns) {
      if (used.has(c.index) || answers.length >= MAX_ANSWERS) continue;
      const a = (r[c.index] ?? '').trim();
      if (a) answers.push({ q: c.header.slice(0, 120), a: a.slice(0, 300) });
    }
    const rawPhone = at(r, 'phone');
    return {
      name: [at(r, 'name'), last !== undefined ? (r[last] ?? '').trim() : ''].filter(Boolean).join(' '),
      phone: phoneIn(rawPhone) || rawPhone,
      email: isEmail(at(r, 'email')) ? at(r, 'email') : '',
      subject: at(r, 'subject'),
      segment: at(r, 'segment'),
      qualification: at(r, 'qualification'),
      experience: at(r, 'experience'),
      prior_org: at(r, 'prior_org'),
      location: at(r, 'location'),
      answers,
    };
  });
}

/** CSV text as rows of cells, quotes handled. */
export function csvMatrix(text: string): string[][] {
  return text.replace(/^﻿/, '').split(/\r?\n/).map((line) => {
    const cols: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; continue; }
      if (ch === ',' && !quoted) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

/** For the AI on the call: what the person already told the school, one line each. */
export function answersText(answers: { q: string; a: string }[] | undefined): string {
  return (answers ?? []).slice(0, MAX_ANSWERS).map((x) => `${x.q.replace(/[?:]\s*$/, '')}: ${x.a}`).join('\n');
}
