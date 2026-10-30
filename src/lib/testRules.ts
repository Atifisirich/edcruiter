/** The shortest lesson plan the written stage accepts. Shown to the candidate and enforced on the server. */
export const MIN_LESSON_WORDS = 150;

export function countWords(text: string | undefined | null): number {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

export interface GradableMcq {
  id: string;
  question_text: string;
  options: string[];
  correct_option: string;
}

export interface McqGrade {
  block: string;
  correct: number;
  total: number;
  unanswered: string[];
}

/**
 * Marks the candidate's picks against the stored answer key. Marking happens on
 * the server because the key is never sent to the browser, and because text the
 * browser wrote itself ("(Correct)") cannot be trusted.
 */
export function gradeMcqs(questions: GradableMcq[], answers: Record<string, unknown>): McqGrade {
  const unanswered: string[] = [];
  let correct = 0;
  const lines = questions.map((q) => {
    const picked = typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '';
    if (!picked || !q.options.includes(picked)) {
      unanswered.push(q.id);
      return `Q: ${q.question_text}\nSelected: (no valid answer)\nKey: ${q.correct_option} (Incorrect)`;
    }
    const isRight = picked === q.correct_option;
    if (isRight) correct += 1;
    return `Q: ${q.question_text}\nSelected: ${picked}\nKey: ${q.correct_option} (${isRight ? 'Correct' : 'Incorrect'})`;
  });
  return { block: lines.join('\n\n'), correct, total: questions.length, unanswered };
}
