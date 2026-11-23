/**
 * Reads the written stage's stored text back into parts for the report: each
 * multiple-choice question with the candidate's pick, the key and whether it was
 * right, and the lesson plan. The text is written by gradeMcqs in testRules.ts.
 */

export interface ParsedMcq {
  question: string;
  /** Null when the candidate gave no valid answer. */
  selected: string | null;
  key: string;
  correct: boolean;
}

export interface ParsedWritten {
  mcqs: ParsedMcq[];
  lessonPlan: string;
}

const LESSON_MARK = '--- LESSON PLAN ---';

/** Null when the text is not in the marked format, so the caller shows it as it is. */
export function parseWrittenSubmission(text: string | undefined | null): ParsedWritten | null {
  if (!text) return null;
  const idx = text.indexOf(LESSON_MARK);
  const mcqPart = (idx >= 0 ? text.slice(0, idx) : text).replace(/^\s*MCQ TEST\s*/, '');
  const lessonPlan = idx >= 0 ? text.slice(idx + LESSON_MARK.length).trim() : '';
  const mcqs: ParsedMcq[] = [];
  for (const block of mcqPart.split(/\n\s*\n/)) {
    const q = block.match(/^\s*Q:\s*([\s\S]*?)\n\s*Selected:\s*(.*)\n\s*Key:\s*(.*?)\s*\((Correct|Incorrect)\)\s*$/);
    if (!q) continue;
    const selected = q[2].trim();
    mcqs.push({
      question: q[1].trim(),
      selected: !selected || selected === '(no valid answer)' ? null : selected,
      key: q[3].trim(),
      correct: q[4] === 'Correct',
    });
  }
  if (!mcqs.length && idx < 0) return null;
  return { mcqs, lessonPlan };
}

/** Dimensions about subject knowledge go with the test; the rest go with the lesson plan. */
export function isSubjectDimension(dimension: string): boolean {
  return /subject|content|knowledge|mcq|accuracy/i.test(dimension);
}
