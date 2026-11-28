/**
 * Applicants counted by subject. Candidates carry whatever was typed or
 * imported ("primary_english_teacher", "Maths", "mathematics_facilitator"), so
 * the same subject is first brought together. Pure, so it is tested without a page.
 */
import { normalizeSubject } from './subjectMatch';
import { countByTab } from './candidateProgress';

export const NO_SUBJECT = 'not-stated';

const NOT_A_SUBJECT = new Set(['', 'general', 'all subjects', 'teacher', 'not stated', 'subject pending']);
const FILLER = /\b(primary|pre primary|preprimary|secondary|senior|teacher|teachers|facilitator|faculty|educator|pgt|tgt|prt)\b/g;

/** One comparable key per subject. "Mother teacher" is a role of its own and is kept. */
export function subjectKey(subject?: string): string {
  const plain = (subject || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (NOT_A_SUBJECT.has(plain)) return NO_SUBJECT;
  if (plain.includes('mother teacher')) return 'mother teacher';
  const stripped = plain.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  if (!stripped) return plain;
  return normalizeSubject(stripped);
}

export function subjectLabel(key: string): string {
  if (key === NO_SUBJECT) return 'Subject not stated';
  return key.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SubjectCount {
  key: string;
  label: string;
  total: number;
  in_progress: number;
  ready: number;
  shortlisted: number;
  selected: number;
}

type CountInput = Parameters<typeof countByTab>[0][number] & { applied_subject?: string };

/** Most applicants first; "Subject not stated" last. */
export function countBySubject(candidates: CountInput[]): SubjectCount[] {
  const groups = new Map<string, CountInput[]>();
  for (const c of candidates) {
    const key = subjectKey(c.applied_subject);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()]
    .map(([key, people]) => {
      const tabs = countByTab(people);
      return { key, label: subjectLabel(key), total: people.length, in_progress: tabs.in_progress, ready: tabs.ready, shortlisted: tabs.shortlisted, selected: tabs.selected };
    })
    .sort((a, b) => Number(a.key === NO_SUBJECT) - Number(b.key === NO_SUBJECT) || b.total - a.total || a.label.localeCompare(b.label));
}
