/**
 * Reads a school's own pay sheet (Excel, CSV or the text of a PDF) into jobs with
 * pay by years of experience, in the same shape the Pay Guide editor uses. It
 * understands the two ways schools lay these sheets out:
 *   - wide: one row per job, one column per stretch of experience (0-2 yrs, 2-5 yrs, 5+),
 *     each cell a pay, a range, or three small columns for lowest / usual / highest;
 *   - long: one row per job and level, with experience and pay in columns.
 * Nothing here saves anything. The admin sees the result and decides. Pure, so it
 * is tested without a file or a page.
 */

import { cleanGrades } from './grades';
import { autoRange, newKey, type EditRole, type EditTier } from './payGuideEdit';
import { MAX_MONTHLY, MAX_TIERS, MIN_MONTHLY } from './payGuide';

export type Grid = string[][];
export type PayBasis = 'auto' | 'monthly' | 'yearly';

export interface ImportContext {
  subjects: string[];
  branches: { id: string; name: string }[];
  /** The campus the jobs are for when the sheet does not say (empty: every campus). */
  branch: string;
  basis?: PayBasis;
}

export interface ImportResult {
  roles: EditRole[];
  notes: string[];
  method: 'sheet' | 'ai' | 'none';
}

/** One job as read from a sheet or by the AI, before it is turned into an editable job. */
export interface RawJob {
  name: string;
  gradesText: string;
  subjectsText: string;
  campusText: string;
  levels: { from: number; to: number | null | undefined; min?: number; ideal?: number; max?: number }[];
  bed?: number;
  masters?: number;
}

const clean = (v: unknown): string => String(v ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const lc = (v: string) => v.toLowerCase().replace(/[–—−]/g, '-');

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

const YEARLY_WORDS = /per\s*annum|annual|\blpa\b|\bctc\b|yearly|p\.\s?a\.|per\s*year|\/\s*year|\/\s*yr/;
const MONTHLY_WORDS = /per\s*month|monthly|\bpm\b|p\.\s?m\.|\/\s*month|\/\s*mo\b|in hand|take[- ]?home/;

/** Whether the figures in a sheet look yearly or monthly, from the words around them. */
export function guessBasis(text: string): 'monthly' | 'yearly' {
  const t = lc(text);
  if (/\blpa\b/.test(t)) return 'yearly';
  if (MONTHLY_WORDS.test(t)) return 'monthly';
  return YEARLY_WORDS.test(t) ? 'yearly' : 'monthly';
}

interface Amount { raw: number; mult: number }

/** One figure: "25,000", "₹25k", "2.4 lakh", "Rs. 30000/-". */
function amountOf(text: string): Amount | null {
  const t = lc(text).replace(/[₹,]/g, '').replace(/\brs\b\.?|\binr\b|\/-|\bonly\b|\bpm\b|per month|\/\s*month/g, ' ').replace(/\s+/g, ' ').trim();
  const m = /^(\d+(?:\.\d+)?)\s*(k|thousand|l|lac|lacs|lakh|lakhs|lpa|cr)?(?![a-z])/.exec(t);
  if (!m) return null;
  const u = m[2];
  const mult = !u ? 1 : u === 'k' || u === 'thousand' ? 1000 : u === 'cr' ? 10_000_000 : 100_000;
  return { raw: Number(m[1]), mult };
}

const sane = (n: number) => Number.isFinite(n) && n >= MIN_MONTHLY && n <= MAX_MONTHLY;

/** A pay cell: one figure, or a range like "25,000 - 30,000" or "25-30k". Monthly rupees. */
export function parsePay(text: string, basis: 'monthly' | 'yearly'): { min: number; max: number } | { single: number } | null {
  const raw = clean(text);
  if (!raw || /^(-|n\/?a|nil|na|tbd)$/i.test(raw)) return null;
  const whole = lc(raw);
  const annual = basis === 'yearly' || /\blpa\b/.test(whole) || (YEARLY_WORDS.test(whole) && !MONTHLY_WORDS.test(whole));
  const toMonthly = (n: number) => (annual ? Math.round(n / 12) : Math.round(n));
  const parts = whole.split(/\s*(?:-|\bto\b)\s*/).filter(Boolean);
  if (parts.length === 2) {
    const a = amountOf(parts[0]);
    const b = amountOf(parts[1]);
    if (a && b) {
      // "25-30k": the unit on the end belongs to both.
      const am = a.mult === 1 && b.mult > 1 && a.raw < 1000 ? b.mult : a.mult;
      const x = a.raw * am;
      const y = b.raw * b.mult;
      const lo = toMonthly(Math.min(x, y));
      const hi = toMonthly(Math.max(x, y));
      return sane(lo) && sane(hi) ? { min: lo, max: hi } : null;
    }
  }
  const one = amountOf(whole);
  if (!one) return null;
  const v = toMonthly(one.raw * one.mult);
  return sane(v) ? { single: v } : null;
}

const oneOf = (p: ReturnType<typeof parsePay>): number | undefined => (p ? ('single' in p ? p.single : Math.round((p.min + p.max) / 2)) : undefined);

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export interface Span { from: number; to: number | null | undefined }

const Y = '(?:years?|yrs?|y)';

/**
 * "0-2 years", "2 to 5 yrs", "5+", "above 5", "under 2", "fresher". An undefined
 * end means "until the next level starts". Null when the text is not about
 * experience. A bare "3 years" counts only when not strict.
 */
export function parseExperience(text: string, strict = true): Span | null {
  const t = lc(clean(text)).replace(/\./g, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (/^(?:fresher|freshers|fresh|entry(?: level)?|no experience|nil)$/.test(t)) return { from: 0, to: undefined };
  let m = new RegExp(`^(?:under|below|less than|upto|up to|<=?|within)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*${Y}?$`).exec(t);
  if (m) return { from: 0, to: Number(m[1]) };
  m = new RegExp(`^(?:above|over|more than|>=?|at least|min(?:imum)?)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*\\+?\\s*${Y}?(?:\\s*(?:and above|or more))?$`).exec(t);
  if (m) return { from: Number(m[1]), to: null };
  m = new RegExp(`^(\\d{1,2}(?:\\.\\d+)?)\\s*(?:\\+|plus|and above|and over|or more|& above|onwards?)\\s*${Y}?(?:\\s*(?:and above|or more|onwards?))?$`).exec(t);
  if (m) return { from: Number(m[1]), to: null };
  m = new RegExp(`^(\\d{1,2}(?:\\.\\d+)?)\\s*${Y}?\\s*(?:-|to|till)\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*${Y}?(?:\\s*(?:of )?(?:experience|exp))?$`).exec(t);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return b > a && b <= 60 ? { from: a, to: b } : null;
  }
  m = new RegExp(`^(\\d{1,2}(?:\\.\\d+)?)\\s*${Y}(?:\\s*(?:of )?(?:experience|exp))?$`).exec(t);
  if (m) return strict ? null : { from: Number(m[1]), to: undefined };
  return null;
}

/** Fills each level's end from where the next one begins; the last is "and above". Drops levels that make no sense. */
export function closeLevels<T extends { from: number; to: number | null | undefined }>(levels: T[]): (T & { to: number | null })[] {
  const sorted = [...levels].sort((a, b) => a.from - b.from);
  const out: (T & { to: number | null })[] = [];
  sorted.forEach((l, i) => {
    if (out.length && out[out.length - 1].from === l.from) return; // two starting together: keep the first
    const next = sorted.slice(i + 1).find((x) => x.from > l.from);
    let to: number | null = l.to === undefined ? (next ? next.from : null) : l.to;
    if (to !== null && to <= l.from) to = next ? next.from : null;
    if (to !== null && next && to > next.from) to = next.from; // never run into the next level
    out.push({ ...l, to });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Grades from words
// ---------------------------------------------------------------------------

const CONTEXT = /\b(?:grades?|class(?:es)?|std|standard|gr)\b/;

function numberRun(chunk: string, out: Set<string>) {
  for (const part of chunk.split(/\s*(?:,|&|\band\b|\bplus\b)\s*/)) {
    const p = part.trim();
    const r = /^(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|to|till|through)\s*(\d{1,2})(?:st|nd|rd|th)?$/.exec(p);
    if (r) {
      const a = Number(r[1]);
      const b = Number(r[2]);
      if (a >= 1 && b <= 12 && a <= b) for (let g = a; g <= b; g++) out.add(String(g));
      continue;
    }
    const s = /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(p);
    if (s && Number(s[1]) >= 1 && Number(s[1]) <= 12) out.add(String(Number(s[1])));
  }
}

/** The grades a job's name or grades cell talks about: "Grades 1-5", "PRT", "Pre-primary", "Class 6 to 8", "TGT". */
export function gradesFromText(text: string, fromGradesColumn = false): string[] {
  let t = ` ${lc(clean(text))} `.replace(/[()[\]/]/g, ' ').replace(/\s+/g, ' ');
  const out = new Set<string>();
  const take = (re: RegExp, ids: string[]) => {
    if (re.test(t)) { ids.forEach((i) => out.add(i)); t = t.replace(re, ' '); }
  };
  if (/\ball (?:grades|classes)\b|\bwhole school\b|\bnursery to (?:12|xii)\b/.test(t)) {
    return cleanGrades(['nursery', 'lkg', 'ukg', ...Array.from({ length: 12 }, (_, i) => String(i + 1))]);
  }
  take(/\bpre[- ]?primary\b|\bpre[- ]?school\b|\bplay ?group\b|\bkindergarten\b|\bfoundational\b|\bearly years\b/, ['nursery', 'lkg', 'ukg']);
  take(/\bnursery\b|\bnur\b/, ['nursery']);
  take(/\blkg\b|\bjunior kg\b|\bjr\.? kg\b|\bkg ?1\b/, ['lkg']);
  take(/\bukg\b|\bsenior kg\b|\bsr\.? kg\b|\bkg ?2\b/, ['ukg']);
  take(/\bsenior secondary\b|\bsr\.? secondary\b|\bpgt\b|\bxi\b ?(?:-|to|&|and)? ?\bxii\b/, ['11', '12']);
  take(/\bupper primary\b|\bmiddle(?: school| wing)?\b|\btgt\b/, ['6', '7', '8']);
  take(/\bsecondary\b/, ['9', '10']);
  take(/\bprt\b|\bprimary\b|\bjunior school\b/, ['1', '2', '3', '4', '5']);
  // "Grades 1, 2 and 5", "Class 6 to 8", "Std 9-10"
  const re = /\b(?:grades?|class(?:es)?|std|standard|gr)\b\s*:?\s*((?:\d{1,2}(?:st|nd|rd|th)?(?:\s*(?:,|&|and|plus|-|to|till|through)\s*)?)+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) numberRun(m[1], out);
  // A grades column can say just "1-5" or "6,7,8".
  if (fromGradesColumn || (out.size === 0 && CONTEXT.test(t))) numberRun(t.replace(/\b(?:grades?|class(?:es)?|std|standard|gr)\b|:/g, ' ').trim(), out);
  return cleanGrades([...out]);
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

type Kind = 'role' | 'grades' | 'subjects' | 'campus' | 'bed' | 'masters' | 'exp' | 'from' | 'to' | 'pay' | 'min' | 'ideal' | 'max';

/** What a column heading is asking for. Null when it is none of these. */
export function headerKind(text: string): Kind | null {
  const t = lc(clean(text)).replace(/[._:*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/\bb ?ed\b|\bbachelor of education\b/.test(t)) return 'bed';
  if (/\bm ?ed\b|\bmasters?\b|\bpost ?grad|\bm ?a\b|\bm ?sc\b/.test(t)) return 'masters';
  if (/exp|year|yrs/.test(t)) {
    if (/\b(?:from|min|minimum|start|lower)\b/.test(t)) return 'from';
    if (/\b(?:to|max|maximum|end|upto|upper)\b/.test(t)) return 'to';
    return 'exp';
  }
  if (/\b(?:min|minimum|lowest|floor)\b/.test(t) || /^(?:low|from)\b/.test(t)) return 'min';
  if (/^(?:ideal|usual|avg|average|mid|middle|typical|target|standard|normal|offer|expected)\b/.test(t)) return 'ideal';
  if (/\b(?:max|maximum|highest|ceiling|cap)\b/.test(t) || /^(?:high|upto|up to)\b/.test(t)) return 'max';
  if (/subject/.test(t)) return 'subjects';
  if (/campus|branch|location|centre|center|\bunit\b/.test(t)) return 'campus';
  if (/salary|\bpay\b|amount|ctc|remuneration|package|stipend|wage|rupees|\brs\b|\binr\b|₹/.test(t)) return 'pay';
  if (/\b(?:grades?|class(?:es)?|std|standard)\b/.test(t) && !/\b(?:role|post|designation|job)\b/.test(t)) return 'grades';
  if (/\b(?:role|job|post|position|designation|category|stage|staff|cadre|teacher|section|wing|level|name|title|particulars?|description)\b/.test(t)) return 'role';
  return null;
}

const rowText = (row: string[]) => row.map(clean).filter(Boolean).join(' ');

interface TierColumn { col: number; span: Span; min?: number; ideal?: number; max?: number }

/** The row that holds the experience headings, with the columns they sit over. */
function findTierHeader(grid: Grid): { row: number; tiers: TierColumn[] } | null {
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const found: TierColumn[] = [];
    grid[r].forEach((c, i) => {
      const span = clean(c) ? parseExperience(c, true) : null;
      if (span) found.push({ col: i, span });
    });
    if (found.length >= 2) return { row: r, tiers: found };
  }
  return null;
}

/** Where, in a block of columns under one heading, the lowest / usual / highest sit, from the little headings beneath. */
function subColumns(row: string[] | undefined, from: number, to: number): { min?: number; ideal?: number; max?: number } {
  const out: { min?: number; ideal?: number; max?: number } = {};
  if (!row) return out;
  for (let c = from; c < Math.min(to, row.length); c++) {
    const k = headerKind(row[c] ?? '');
    if (k === 'min' || k === 'ideal' || k === 'max') out[k] ??= c;
  }
  return Object.keys(out).length >= 2 ? out : {};
}

// ---------------------------------------------------------------------------
// Reading a grid
// ---------------------------------------------------------------------------

type Cols = Partial<Record<Kind, number>>;

function columnsFrom(header: string[][], width: number, skip: Set<number>): Cols {
  const cols: Cols = {};
  for (let c = 0; c < width; c++) {
    if (skip.has(c)) continue;
    // A heading can sit on any of the header rows.
    const text = header.map((row) => clean(row[c])).filter(Boolean).join(' ');
    const k = headerKind(text);
    if (k && cols[k] === undefined) cols[k] = c;
  }
  return cols;
}

const cellAt = (row: string[], c: number | undefined) => (c === undefined ? '' : clean(row[c]));
const hasDigit = (v: string) => /\d/.test(v);

function parseWide(grid: Grid, basis: 'monthly' | 'yearly'): RawJob[] | null {
  const head = findTierHeader(grid);
  if (!head) return null;
  const { row: hr, tiers } = head;
  const subRow = grid[hr + 1];
  const blocks = tiers.map((t, i) => {
    const end = tiers[i + 1]?.col ?? t.col + 4;
    return { ...t, ...subColumns(subRow, t.col, Math.min(end, t.col + 4)) };
  });
  const threeCol = blocks.some((b) => b.min !== undefined || b.max !== undefined);
  const skip = new Set<number>();
  blocks.forEach((b) => {
    skip.add(b.col);
    [b.min, b.ideal, b.max].forEach((c) => c !== undefined && skip.add(c));
  });
  const width = Math.max(...grid.map((r) => r.length));
  const cols = columnsFrom([grid[hr - 2] ?? [], grid[hr - 1] ?? [], grid[hr]], width, skip);
  const firstTier = Math.min(...blocks.map((b) => b.col));
  // The job's name: the heading that says so, else the first text column to the left of the pay.
  let nameCol = cols.role ?? cols.grades;
  if (nameCol === undefined) {
    for (let c = 0; c < firstTier; c++) {
      if (grid.slice(hr + 1).some((r) => clean(r[c]) && !hasDigit(clean(r[c])))) { nameCol = c; break; }
    }
  }
  if (nameCol === undefined) return null;

  const jobs: RawJob[] = [];
  let lastName = '';
  let lastCampus = '';
  let section = '';
  for (let r = hr + (threeCol ? 2 : 1); r < grid.length; r++) {
    const row = grid[r];
    const levels: RawJob['levels'] = [];
    for (const b of blocks) {
      if (threeCol && (b.min !== undefined || b.ideal !== undefined || b.max !== undefined)) {
        const mn = oneOf(parsePay(cellAt(row, b.min), basis));
        const id = oneOf(parsePay(cellAt(row, b.ideal), basis));
        const mx = oneOf(parsePay(cellAt(row, b.max), basis));
        if (mn === undefined && id === undefined && mx === undefined) continue;
        levels.push({ from: b.span.from, to: b.span.to, min: mn, ideal: id, max: mx });
      } else {
        const p = parsePay(cellAt(row, b.col), basis);
        if (!p) continue;
        levels.push('single' in p ? { from: b.span.from, to: b.span.to, ideal: p.single } : { from: b.span.from, to: b.span.to, min: p.min, max: p.max });
      }
    }
    const name = cellAt(row, nameCol);
    const campus = cellAt(row, cols.campus);
    if (levels.length === 0) {
      // A heading line such as "Primary wing" that the jobs under it belong to.
      if (name && row.filter((x) => clean(x)).length <= 2 && !hasDigit(name)) section = name;
      continue;
    }
    if (name) lastName = name;
    if (campus) lastCampus = campus;
    const baseName = name || lastName;
    if (!baseName) continue;
    const gradesText = cellAt(row, cols.grades !== nameCol ? cols.grades : undefined);
    const hintless = gradesFromText(`${baseName} ${gradesText}`).length === 0;
    jobs.push({
      name: hintless && section && !baseName.toLowerCase().includes(section.toLowerCase()) ? `${section} - ${baseName}` : baseName,
      gradesText: hintless && section ? `${section} ${gradesText}` : gradesText,
      subjectsText: cellAt(row, cols.subjects),
      campusText: campus || lastCampus,
      levels,
      bed: oneOf(parsePay(cellAt(row, cols.bed), basis)),
      masters: oneOf(parsePay(cellAt(row, cols.masters), basis)),
    });
  }
  return jobs.length ? jobs : null;
}

function parseLong(grid: Grid, basis: 'monthly' | 'yearly'): RawJob[] | null {
  let hr = -1;
  let cols: Cols = {};
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const c = columnsFrom([grid[r]], grid[r].length, new Set());
    const hasExp = c.exp !== undefined || c.from !== undefined;
    const hasPay = c.pay !== undefined || c.ideal !== undefined || c.min !== undefined || c.max !== undefined;
    if (hasExp && hasPay) { hr = r; cols = c; break; }
  }
  if (hr < 0) return null;
  const map = new Map<string, RawJob>();
  let lastName = '';
  let lastCampus = '';
  for (let r = hr + 1; r < grid.length; r++) {
    const row = grid[r];
    if (cellAt(row, cols.role)) lastName = cellAt(row, cols.role);
    if (cellAt(row, cols.campus)) lastCampus = cellAt(row, cols.campus);
    const name = lastName;
    const campus = lastCampus;
    let span: Span | null = null;
    if (cols.exp !== undefined) span = parseExperience(cellAt(row, cols.exp), false);
    else {
      const fromTxt = cellAt(row, cols.from);
      const toTxt = cellAt(row, cols.to);
      if (fromTxt !== '' && Number.isFinite(Number(fromTxt))) {
        span = { from: Number(fromTxt), to: toTxt === '' || !Number.isFinite(Number(toTxt)) ? null : Number(toTxt) };
      }
    }
    if (!span || !name) continue;
    const pay = cols.pay !== undefined ? parsePay(cellAt(row, cols.pay), basis) : null;
    const mn = oneOf(parsePay(cellAt(row, cols.min), basis));
    const id = oneOf(parsePay(cellAt(row, cols.ideal), basis));
    const mx = oneOf(parsePay(cellAt(row, cols.max), basis));
    let level: RawJob['levels'][number];
    if (pay) level = 'single' in pay ? { ...span, ideal: pay.single } : { ...span, min: pay.min, max: pay.max };
    else if (mn !== undefined || id !== undefined || mx !== undefined) level = { ...span, min: mn, ideal: id, max: mx };
    else continue;
    const gradesText = cellAt(row, cols.grades);
    const key = `${name.toLowerCase()}|${campus.toLowerCase()}|${gradesText.toLowerCase()}`;
    const job = map.get(key) ?? { name, gradesText, subjectsText: cellAt(row, cols.subjects), campusText: campus, levels: [] };
    job.levels.push(level);
    job.bed ??= oneOf(parsePay(cellAt(row, cols.bed), basis));
    job.masters ??= oneOf(parsePay(cellAt(row, cols.masters), basis));
    map.set(key, job);
  }
  return map.size ? [...map.values()] : null;
}

/** The jobs in one sheet's rows, or null when it does not look like a pay sheet. */
export function readGrid(grid: Grid, basis: PayBasis = 'auto'): { jobs: RawJob[]; yearly: boolean } | null {
  const rows = grid.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  if (rows.length < 2) return null;
  const resolved: 'monthly' | 'yearly' = basis === 'auto' ? guessBasis(rows.slice(0, 20).map(rowText).join(' ')) : basis;
  const jobs = parseWide(rows, resolved) ?? parseLong(rows, resolved);
  return jobs ? { jobs, yearly: resolved === 'yearly' } : null;
}

// ---------------------------------------------------------------------------
// From what was read to editable jobs
// ---------------------------------------------------------------------------

const to500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

function pickCampus(text: string, ctx: ImportContext, notes: string[], jobName: string): string {
  const t = clean(text).toLowerCase();
  if (!t) return ctx.branch;
  const hit = ctx.branches.find((b) => b.name.toLowerCase() === t) ?? ctx.branches.find((b) => t.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(t));
  if (hit) return hit.id;
  if (/^(?:all|every|both|common)\b/.test(t)) return '';
  notes.push(`“${jobName}”: the campus “${clean(text)}” is not one of yours, so it was put under the campus you are on.`);
  return ctx.branch;
}

/** Turns what was read into jobs the Pay Guide editor opens, with notes on anything that needs the admin's eye. */
export function buildRoles(jobs: RawJob[], ctx: ImportContext): { roles: EditRole[]; notes: string[] } {
  const notes: string[] = [];
  const roles: EditRole[] = [];
  const used = new Set<string>();
  const subjectByLower = new Map(ctx.subjects.map((s) => [s.toLowerCase(), s]));
  for (const j of jobs) {
    const base = clean(j.name).slice(0, 60);
    if (base.length < 2) continue;
    let name = base;
    const branch = pickCampus(j.campusText, ctx, notes, name);
    let n = 2;
    while (used.has(`${branch}|${name.toLowerCase()}`)) name = `${base.slice(0, 54)} (${n++})`;
    used.add(`${branch}|${name.toLowerCase()}`);

    const own = gradesFromText(j.gradesText, true);
    const grades = own.length ? own : gradesFromText(`${name} ${j.gradesText}`);
    if (grades.length === 0) notes.push(`“${name}”: could not tell which grades this covers. Choose them.`);

    const subjects: string[] = [];
    for (const s of clean(j.subjectsText).split(/\s*(?:,|;|\/|&|\band\b)\s*/).filter(Boolean)) {
      const hit = subjectByLower.get(s.toLowerCase());
      if (hit) subjects.push(hit);
      else if (!/^(?:all|any|every|-|na|n\/a)/i.test(s)) notes.push(`“${name}”: the subject “${s}” is not on your school's list, so it was left out.`);
    }

    let levels = closeLevels(j.levels.filter((l) => Number.isFinite(l.from) && l.from >= 0 && l.from <= 50));
    if (levels.length > MAX_TIERS) {
      notes.push(`“${name}”: only the first ${MAX_TIERS} levels of experience were kept.`);
      levels = levels.slice(0, MAX_TIERS);
    }
    const tiers: EditTier[] = levels.map((l) => {
      let { min, ideal, max } = l;
      let auto = false;
      if (ideal !== undefined && (min === undefined || max === undefined)) {
        const r = autoRange(ideal);
        min ??= r.min;
        max ??= r.max;
        auto = min === r.min && max === r.max;
      } else if (ideal === undefined && min !== undefined && max !== undefined) ideal = to500((min + max) / 2);
      else if (ideal === undefined && min !== undefined) { ideal = min; max = autoRange(min).max; }
      else if (ideal === undefined && max !== undefined) { ideal = max; min = autoRange(max).min; }
      const ends = { from: String(l.from), to: l.to === null ? '' : String(l.to) };
      if (min === undefined || ideal === undefined || max === undefined) return { ...ends, min: '', ideal: '', max: '', auto: true };
      if (!(min <= ideal && ideal <= max)) {
        [min, ideal, max] = [min, ideal, max].sort((a, b) => a - b);
        notes.push(`“${name}”: the pay for ${l.from}${l.to === null ? '+' : ` to ${l.to}`} years was out of order (lowest, usual, highest), so it was put in order.`);
      }
      return { ...ends, min: String(min), ideal: String(ideal), max: String(max), auto };
    });
    if (tiers.length === 0) {
      notes.push(`“${name}”: no pay was found, so it was left out.`);
      continue;
    }
    // A stretch of experience with no pay would be priced at the lowest level, so say so.
    const gaps: string[] = [];
    if (levels[0].from > 0) gaps.push(`under ${levels[0].from}`);
    levels.forEach((l, i) => { if (l.to !== null && levels[i + 1] && levels[i + 1].from > l.to) gaps.push(`${l.to} to ${levels[i + 1].from}`); });
    if (gaps.length) notes.push(`“${name}”: there is no pay for ${gaps.join(' and ')} years of experience. Add it, or those teachers will be priced at the lowest level.`);

    roles.push({
      key: newKey(), branch, name, grades, subjects, decider: '', tiers,
      bed: j.bed && sane(j.bed) ? String(j.bed) : '', masters: j.masters && sane(j.masters) ? String(j.masters) : '',
      positions: '', budget: '',
    });
  }
  return { roles, notes };
}

/** What to do with imported jobs next to the ones already in the editor. */
export function combineRoles(existing: EditRole[], imported: EditRole[], mode: 'add' | 'replace'): EditRole[] {
  const campuses = new Set(imported.map((r) => r.branch));
  const kept = mode === 'replace' ? existing.filter((r) => !campuses.has(r.branch)) : existing;
  const names = new Set(kept.map((r) => `${r.branch}|${r.name.trim().toLowerCase()}`));
  const fresh = imported.map((r) => {
    let name = r.name;
    let n = 2;
    while (names.has(`${r.branch}|${name.toLowerCase()}`)) name = `${r.name.slice(0, 50)} (${n++})`;
    names.add(`${r.branch}|${name.toLowerCase()}`);
    return { ...r, name };
  });
  return [...kept, ...fresh];
}
