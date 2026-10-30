import type { AssessmentPack } from './types';
import { segmentTier } from './questionBank';

const SYNONYMS: Array<[RegExp, string]> = [
  [/\b(bio|biology|life science|life sciences)\b/, 'biology'],
  [/\b(math|maths|mathematics)\b/, 'mathematics'],
  [/\b(phy|physics)\b/, 'physics'],
  [/\b(chem|chemistry)\b/, 'chemistry'],
  [/\b(eng|english|english literature|english language)\b/, 'english'],
  [/\b(cs|computer|computers|computer science|computer applications|information technology|it|ict|informatics)\b/, 'computer science'],
  [/\b(social|social studies|social science|sst|history|geography|civics|economics)\b/, 'social studies'],
  [/\b(hindi)\b/, 'hindi'],
  [/\b(telugu)\b/, 'telugu'],
  [/\b(sanskrit)\b/, 'sanskrit'],
  [/\b(evs|environmental|environmental studies)\b/, 'environmental studies'],
  [/\b(general science|science)\b/, 'general science']
];

/**
 * Reduces what a school or candidate typed ("Biology / Life Sciences",
 * "Maths", "Computer Applications") to one comparable subject. Anything
 * unrecognised is compared as its own lower-cased text, never folded into
 * physics the way the old bucket did, which gave a Computer Science teacher a
 * physics test and a Chemistry teacher physics questions too.
 */
export function normalizeSubject(subject?: string): string {
  const s = (subject || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  for (const [pattern, name] of SYNONYMS) {
    if (pattern.test(s)) return name;
  }
  return s;
}

export function sameSubject(a?: string, b?: string): boolean {
  const x = normalizeSubject(a);
  return x !== '' && x === normalizeSubject(b);
}

/** Subjects the built-in question bank really covers (it has nothing for the rest). */
export function hasBuiltInBank(subject?: string): boolean {
  return ['biology', 'mathematics', 'physics', 'english'].includes(normalizeSubject(subject));
}

/** The active test written for this exact subject and grade level, if the school has one. */
export function pickActivePack(packs: AssessmentPack[], subject?: string, segment?: string): AssessmentPack | null {
  const tier = segmentTier(segment);
  return packs.find((p) => p.status === 'active' && sameSubject(p.subject, subject) && segmentTier(p.segment) === tier) || null;
}
