/**
 * Turns the AI's paragraphs into short points a reader can scan: one sentence
 * each, marked as a good sign, something to watch, or plain information.
 * Wording is kept exactly; only "However," style openers are dropped once the
 * point is marked.
 */
import type { MetricTone } from './reportVerdict';
import type { PolicyAnswer } from './types';

export interface Point {
  text: string;
  tone: MetricTone;
}

const ABBREVIATIONS = ['e.g.', 'i.e.', 'vs.', 'etc.', 'approx.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'No.', 'Std.', 'St.'];
const DOT = '․';

const CONCERN = /\b(however|but|although|lacks?|lacking|missing|absence|absent|without|does not|did not|doesn't|didn't|fails?|failed|weak|limited|thin|no clear|not\b|unclear|immediately reveals|instead of|needs?|should|could have|too (?:fast|slow|long|short)|rushed|over-?reliance)\b/i;
const GOOD = /\b(strong|clear(?:ly)?|good|well|effective(?:ly)?|exhibits|demonstrates?|relatable|structures|includes|confident|engaging|warm|accurate|correct(?:ly)?|thoughtful|calm|organised|organized|excellent|appropriate)\b/i;
const OPENER = /^(however|but|although|on the other hand|that said|overall)\s*,?\s*/i;

/** Sentences, with abbreviations and decimals left whole. */
export function sentences(text: string | undefined | null): string[] {
  let t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  for (const a of ABBREVIATIONS) t = t.split(a).join(a.replace(/\./g, DOT));
  t = t.replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  return t
    .split(/(?<=[.!?])\s+(?=["'(“]?[A-Z0-9])/)
    .map((s) => s.split(DOT).join('.').trim())
    .filter(Boolean);
}

function capitalise(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Each sentence as a point, marked good, watch or plain. */
export function toPoints(text: string | undefined | null): Point[] {
  return sentences(text).map((s) => {
    const concern = CONCERN.test(s);
    const tone: MetricTone = concern ? 'watch' : GOOD.test(s) ? 'good' : 'none';
    return { text: concern ? capitalise(s.replace(OPENER, '')) : s, tone };
  });
}

/**
 * The older HR policy text ("- 60-Day Notice Period Acknowledged: YES") as
 * policy answers, so both formats look the same. Null when it is not that format.
 */
export function parsePolicyText(text: string | undefined | null): { answers: PolicyAnswer[]; note?: string } | null {
  if (!text || !/policy/i.test(text.split('\n')[0] || '')) return null;
  const answers: PolicyAnswer[] = [];
  let note: string | undefined;
  for (const line of text.split('\n')) {
    const extra = line.match(/^\s*-\s*(additional statement|comments?|notes?)\s*:\s*(.*?)\s*$/i);
    if (extra) {
      if (extra[2] && !/^none$/i.test(extra[2])) note = extra[2];
      continue;
    }
    // The answer is after the last colon, so times like 7:45 stay in the label.
    const m = line.match(/^\s*-\s*(.+):\s*(\S+)\s*$/);
    if (!m) continue;
    const [, label, value] = m;
    const yes = /^(yes|y|true|agreed?|acknowledged)$/i.test(value);
    const no = /^(no|n|false|disagreed?)$/i.test(value);
    if (!yes && !no) continue;
    answers.push({
      question_id: `line-${answers.length}`,
      question: label.replace(/\s+(Acknowledged|Signed|Accepted|Agreed)$/i, ''),
      agreed: yes,
    });
  }
  return answers.length ? { answers, note } : null;
}

/** A one-line "it was recorded" note, rather than an answer worth a box of its own. */
export function isPlaceholderSubmission(text: string | undefined | null): boolean {
  const t = (text || '').trim();
  return !!t && t.length < 120 && !t.includes('\n') && /\b(recorded|submitted|uploaded|received)\b/i.test(t);
}
