/**
 * Individual grades, not bands. A vacancy or a candidate is for any set of
 * grades (for example 1, 2 and 5). The rest of the app still reads one
 * "segment" string, so the grades are written into that string in a form the
 * existing test matching understands (see segmentTier in questionBank.ts), and
 * the exact grades are kept alongside it.
 */

export interface Grade {
  id: string;
  label: string;
  /** Position, used for ordering and for deciding the level. */
  order: number;
}

export const GRADES: Grade[] = [
  { id: 'nursery', label: 'Nursery', order: 0 },
  { id: 'lkg', label: 'LKG', order: 1 },
  { id: 'ukg', label: 'UKG', order: 2 },
  ...Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), label: String(i + 1), order: i + 3 })),
];

const BY_ID = new Map(GRADES.map((g) => [g.id, g]));

export const GRADE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Pre-primary', ids: ['nursery', 'lkg', 'ukg'] },
  { label: 'Grades 1–5', ids: ['1', '2', '3', '4', '5'] },
  { label: 'Grades 6–8', ids: ['6', '7', '8'] },
  { label: 'Grades 9–10', ids: ['9', '10'] },
  { label: 'Grades 11–12', ids: ['11', '12'] },
];

/** Keeps only real grades, once each, in school order. */
export function cleanGrades(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const wanted = new Set(input.map((g) => String(g).toLowerCase().trim()));
  return GRADES.filter((g) => wanted.has(g.id)).map((g) => g.id);
}

/** The level a set of grades belongs to, decided by the highest grade, so a test is never easier than the oldest class. */
export function levelName(grades: string[]): 'Pre-primary' | 'Primary' | 'Middle School' | 'Secondary' | 'Senior Secondary' {
  const top = Math.max(-1, ...cleanGrades(grades).map((id) => BY_ID.get(id)!.order));
  if (top <= 2) return 'Pre-primary';
  if (top <= 7) return 'Primary'; // grades 1-5
  if (top <= 10) return 'Middle School'; // grades 6-8
  if (top <= 12) return 'Secondary'; // grades 9-10
  return 'Senior Secondary';
}

function plainList(grades: string[]): string {
  const labels = grades.map((id) => BY_ID.get(id)!.label);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** "Grades 1, 2 and 5", "Grade 4", "Nursery and LKG". */
export function describeGrades(input: string[]): string {
  const grades = cleanGrades(input);
  if (grades.length === 0) return '';
  const numeric = grades.every((g) => /^\d+$/.test(g));
  if (numeric) return `${grades.length === 1 ? 'Grade' : 'Grades'} ${plainList(grades)}`;
  return plainList(grades);
}

/**
 * The one string the rest of the app stores as the segment, such as
 * "Primary (Grades 1, 2, 5)". It always carries the level name, which is what
 * test matching reads.
 */
export function segmentFromGrades(input: string[]): string {
  const grades = cleanGrades(input);
  if (grades.length === 0) return '';
  const orders = grades.map((g) => BY_ID.get(g)!.order);
  const contiguous = orders.every((o, i) => i === 0 || o === orders[i - 1] + 1);
  const numeric = grades.every((g) => /^\d+$/.test(g));
  const inside =
    numeric && contiguous && grades.length >= 3
      ? `Grades ${grades[0]}–${grades[grades.length - 1]}`
      : describeGrades(grades);
  return `${levelName(grades)} (${inside})`;
}

/** Best guess at the grades behind an older band such as "Primary (Grades 1–5, 6–11 yrs)", or a new segment string. */
export function gradesFromSegment(segment?: string): string[] {
  const s = (segment || '').trim();
  if (!s) return [];

  const named = ['nursery', 'lkg', 'ukg'].filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(s));
  const m = /grades?\s*(\d[\d\s,&–-]*(?:and\s*\d+)?)/i.exec(s);
  if (m) {
    const body = m[1].trim();
    const range = /^(\d{1,2})\s*[–-]\s*(\d{1,2})/.exec(body);
    let nums: number[];
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      nums = Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
    } else {
      nums = (body.match(/\d{1,2}/g) || []).map(Number);
    }
    return cleanGrades([...named, ...nums.filter((n) => n >= 1 && n <= 12).map(String)]);
  }
  if (named.length) return cleanGrades(named);

  const lower = s.toLowerCase();
  if (lower.includes('senior')) return cleanGrades(['11', '12']);
  if (lower.includes('pre')) return cleanGrades(['nursery', 'lkg', 'ukg']);
  if (lower.includes('pri')) return cleanGrades(['1', '2', '3', '4', '5']);
  if (lower.includes('mid')) return cleanGrades(['6', '7', '8']);
  if (lower.includes('sec')) return cleanGrades(['9', '10']);
  return [];
}
