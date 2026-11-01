import { GoogleGenAI } from '@google/genai';
import { logAiUsage } from './aiUsage';

export type TaskKind = 'lesson' | 'demo' | 'scenario';

const KIND_BRIEF: Record<TaskKind, string> = {
  lesson: 'a lesson-plan task. The candidate writes a plan for one lesson. Ask for a clear outcome, a hook, one common misconception, mixed-ability work and an exit check.',
  demo: 'a short teaching demonstration the candidate records on camera. Name one specific topic to teach and what to include (a hook, one visual, a check question, a close).',
  scenario: 'a classroom scenario the candidate answers on camera in about two minutes. It must include a child-safety moment: a student says something that worries the teacher about their safety, and the candidate says what they would do and who they would tell.',
};

/**
 * Writes a different task for a candidate who left a stage half way and came
 * back, so the wording they saw before is no use to them. A cheap, fast model is
 * enough for one short paragraph. Returns null when it cannot (no key, an error,
 * or a timeout), and the caller falls back to the school's own task.
 */
export async function freshTask(input: {
  kind: TaskKind;
  subject: string;
  segment: string;
  board: string;
  avoid: string[];
}): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) return null;
  const prompt = `Write ONE new task for a teacher-hiring test at an Indian school (${input.board} curriculum).
It is ${KIND_BRIEF[input.kind]}
Subject: ${input.subject}. Grades: ${input.segment}.
It must use a different topic or situation from each of these earlier tasks:
${input.avoid.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)'}
Keep it to two or three sentences, in plain English a teacher can follow. Return only the task text, with no heading or quotation marks.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await Promise.race([
      ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt, config: { temperature: 0.9 } }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
    ]);
    if (!response) return null;
    logAiUsage('fresh-task', response, 'gemini-flash-lite-latest');
    const text = (response.text || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
    return text.length >= 40 && text.length <= 900 ? text : null;
  } catch (err) {
    console.warn('Fresh task writing failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
