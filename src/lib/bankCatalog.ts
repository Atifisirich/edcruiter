/**
 * The platform question bank, arranged for people to read: which subjects and
 * grades it covers, how many questions each has, and the questions themselves.
 * Pure: the caller passes the bank files and the usage counts.
 */

import type { BankQuestion, BankState } from './testBank';
import { SUBJECT_QUESTIONS } from './testBank';

export const SUBJECT_LABEL: Record<string, string> = {
  english: 'English',
  mathematics: 'Mathematics',
  hindi: 'Hindi',
  'environmental studies': 'EVS (Environmental Studies)',
  'general science': 'Science',
  'social studies': 'Social Studies',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'computer science': 'Computer Science',
  pedagogy: 'Teaching practice (every subject)',
};

/** Fewer questions than this for a grade and a candidate gets the school's own AI test instead. */
export const ENOUGH_FOR_A_DRAW = SUBJECT_QUESTIONS;

export interface GradeSummary { grade: string; count: number; topics: number }
export interface SubjectSummary {
  key: string;
  label: string;
  total: number;
  retired: number;
  grades: GradeSummary[];
}

const GRADE_ORDER = ['pre-nursery', 'nursery', 'lkg', 'ukg', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '*'];
const gradeRank = (g: string) => {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? 99 : i;
};

export function summarize(banks: Record<string, BankQuestion[]>, state: BankState): SubjectSummary[] {
  const retired = new Set(state.retired);
  return Object.entries(banks).map(([key, questions]) => {
    const byGrade = new Map<string, { count: number; topics: Set<string> }>();
    for (const q of questions) {
      for (const g of q.g) {
        const entry = byGrade.get(g) || { count: 0, topics: new Set<string>() };
        entry.count += 1;
        entry.topics.add(q.t);
        byGrade.set(g, entry);
      }
    }
    return {
      key,
      label: SUBJECT_LABEL[key] || key,
      total: questions.length,
      retired: questions.filter((q) => retired.has(q.id)).length,
      grades: [...byGrade.entries()]
        .sort(([a], [b]) => gradeRank(a) - gradeRank(b))
        .map(([grade, v]) => ({ grade, count: v.count, topics: v.topics.size })),
    };
  });
}

export interface CatalogQuestion {
  id: string;
  topic: string;
  kind: 'subject' | 'teaching';
  question: string;
  answer: string;
  wrong: string[];
  explanation?: string;
  /** How many candidates have been given it. */
  used: number;
  retired: boolean;
}

/** Every question for one subject and grade ("*" = the questions for every grade), grouped by topic order. */
export function questionsFor(bank: BankQuestion[], grade: string, state: BankState): CatalogQuestion[] {
  const retired = new Set(state.retired);
  return bank
    .filter((q) => q.g.includes(grade))
    .map((q) => ({
      id: q.id,
      topic: q.t,
      kind: q.k === 'p' ? 'teaching' as const : 'subject' as const,
      question: q.q,
      answer: q.a,
      wrong: q.w,
      explanation: q.e || undefined,
      used: state.exposures[q.id] || 0,
      retired: retired.has(q.id),
    }))
    .sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id));
}
