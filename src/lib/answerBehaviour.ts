/**
 * How a candidate's written answers were produced, turned into plain-language
 * signals for the reviewer.
 *
 * A browser cannot see another app running on the same computer, such as an AI
 * overlay that reads the screen and suggests answers. What it can see is how the
 * answers arrive. A person composing their own lesson plan stops to think,
 * deletes and rewrites, and varies their pace. A person copying an answer from
 * elsewhere tends to type steadily with almost no corrections, and to click
 * through questions at an even pace. None of this is proof (a fast, fluent typist
 * can trigger it), so it is shown to the reviewer as something to weigh, and it
 * never changes a score.
 */

/** What the browser measures. The server completes it from the submitted text. */
export interface TypingRaw {
  /** Printable keys pressed. */
  chars_typed: number;
  deletions: number;
  /** Gaps of four seconds or more between key presses. */
  pauses_over_4s: number;
  /** Seconds between key presses, ignoring gaps over eight seconds. */
  active_seconds: number;
  /** Phone and tablet keyboards do not report keys reliably, so typing is not judged there. */
  touch: boolean;
}

export interface McqRaw {
  /** Milliseconds from the first answer to each question's first answer, in the order given. */
  first_answer_ms: number[];
  /** Times an answer was changed after being picked. */
  changes: number;
}

export interface TypingStats extends TypingRaw {
  chars_final: number;
  words_final: number;
}

export interface McqTiming {
  answered: number;
  median_gap_seconds: number;
  /** Answers that came less than three seconds after the one before. */
  fast_answers: number;
  /** How uneven the pace was: 0 is perfectly even. */
  pace_variation: number;
  changes: number;
}

export interface AnswerBehaviour {
  typing?: TypingStats;
  mcq?: McqTiming;
  signals: string[];
}

const num = (v: unknown, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(max, Math.round(n)));
};

export function cleanTypingRaw(raw: unknown): TypingRaw | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    chars_typed: num(r.chars_typed, 200_000),
    deletions: num(r.deletions, 200_000),
    pauses_over_4s: num(r.pauses_over_4s, 100_000),
    active_seconds: num(r.active_seconds, 86_400),
    touch: r.touch === true,
  };
}

export function cleanMcqRaw(raw: unknown): McqRaw | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.first_answer_ms) ? r.first_answer_ms : [];
  return {
    first_answer_ms: list.slice(0, 200).map((v) => num(v, 86_400_000)),
    changes: num(r.changes, 10_000),
  };
}

export function mcqTiming(raw: McqRaw): McqTiming | undefined {
  const times = [...raw.first_answer_ms].sort((a, b) => a - b);
  if (times.length < 2) return undefined;
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / 1000);
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
  return {
    answered: times.length,
    median_gap_seconds: Math.round(median * 10) / 10,
    fast_answers: gaps.filter((g) => g < 3).length,
    pace_variation: mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0,
    changes: raw.changes,
  };
}

export function wordsIn(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** The signals worth a reviewer's attention. Empty when nothing stands out. */
export function behaviourSignals(b: Pick<AnswerBehaviour, 'typing' | 'mcq'>): string[] {
  const out: string[] = [];
  const t = b.typing;

  if (t && !t.touch && t.words_final >= 150 && t.chars_typed > 0) {
    const typedShare = t.chars_final > 0 ? t.chars_typed / t.chars_final : 1;
    if (t.chars_final >= 400 && typedShare < 0.7) {
      out.push(`Only about ${Math.round(typedShare * 100)}% of the lesson plan was typed on the keyboard. The rest arrived another way, such as autocomplete, dictation or an extension.`);
    }
    if (t.deletions / t.chars_typed < 0.008) {
      out.push('Almost nothing was deleted or rewritten while typing. People composing their own plan usually revise as they go.');
    }
    if (t.pauses_over_4s <= 1) {
      out.push('Typed steadily with almost no pauses to think.');
    }
    if (t.active_seconds >= 60) {
      const wpm = t.words_final / (t.active_seconds / 60);
      if (wpm > 75) out.push(`Typing averaged ${Math.round(wpm)} words a minute, faster than most people can compose.`);
    }
  }

  const m = b.mcq;
  if (m && m.answered >= 15) {
    if (m.median_gap_seconds < 5) {
      out.push(`Questions were answered about every ${m.median_gap_seconds} seconds, which is faster than reading each one.`);
    }
    if (m.fast_answers / m.answered > 0.5) {
      out.push('More than half of the questions were answered in under 3 seconds.');
    }
    if (m.pace_variation < 0.3) {
      out.push('The pace between answers was unusually even.');
    }
  }
  return out;
}

export function buildBehaviour(typingRaw: unknown, mcqRaw: unknown, lessonText: string): AnswerBehaviour | undefined {
  const typedRaw = cleanTypingRaw(typingRaw);
  const typing: TypingStats | undefined = typedRaw
    ? { ...typedRaw, chars_final: lessonText.length, words_final: wordsIn(lessonText) }
    : undefined;
  const mRaw = cleanMcqRaw(mcqRaw);
  const mcq = mRaw ? mcqTiming(mRaw) : undefined;
  if (!typing && !mcq) return undefined;
  return { typing, mcq, signals: behaviourSignals({ typing, mcq }) };
}
