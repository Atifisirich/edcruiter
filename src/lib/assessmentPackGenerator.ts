import { GoogleGenAI } from '@google/genai';
import type { AssessmentPack } from './types';
import { buildFallbackPack } from './buildAssessmentPack';

export const SUBJECT_MCQ_COUNT = 25;
export const PEDAGOGY_MCQ_COUNT = 5;

type Mcq = AssessmentPack['mcqs'][number];

function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Keeps only questions that can be marked: a real question, four different
 * options, and an answer that is one of them. The options are shuffled so the
 * right answer is not always the first one, and questions repeating an earlier
 * one are dropped. Pure, so it is tested without calling the model.
 */
export function validateAiMcqs(
  raw: unknown,
  category: 'subject' | 'pedagogy',
  seen: Set<string> = new Set(),
  random: () => number = Math.random
): Mcq[] {
  if (!Array.isArray(raw)) return [];
  const out: Mcq[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;
    const text = typeof q.question_text === 'string' ? q.question_text.trim() : '';
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
    const unique = Array.from(new Map(options.map((o) => [norm(o), o])).values());
    const answer = typeof q.correct_option === 'string' ? q.correct_option.trim() : '';
    if (text.length < 15 || unique.length !== 4 || options.length !== 4) continue;

    const matched = unique.find((o) => norm(o) === norm(answer));
    if (!matched) continue;
    if (seen.has(norm(text))) continue;
    seen.add(norm(text));

    out.push({
      id: '',
      question_text: text,
      options: shuffled(unique, random),
      correct_option: matched,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : undefined,
      category
    });
  }
  return out;
}

function numbered(mcqs: Mcq[], prefix: string): Mcq[] {
  return mcqs.map((q, i) => ({ ...q, id: `${prefix}_${i + 1}` }));
}

function mcqPrompt(subject: string, segment: string, board: string, subjectCount: number, pedagogyCount: number, avoid: string[]): string {
  return `You are a senior academic director writing a hiring test for school teachers.

Write multiple-choice questions to test a ${subject} teacher for ${segment} on the ${board} board, in India.

Write exactly:
- ${subjectCount} SUBJECT questions. Each tests the teacher's own command of ${subject} content at the level they will teach (${segment}, ${board} syllabus): concepts, worked problems, common errors, definitions, applications. They must be about the subject itself, not about teaching method. Cover different topics across the syllabus; do not repeat a topic.
- ${pedagogyCount} PEDAGOGY questions about how to teach ${subject} well to ${segment} (misconceptions, checking understanding, differentiation, classroom management).

Rules for every question:
- Exactly 4 options, only one correct, the others plausible but clearly wrong to an expert.
- correct_option must be copied exactly from options.
- Do not put "All of the above" or "None of the above".
- Do not make the correct option the longest one by habit.
${avoid.length ? `- Do not repeat these questions:\n${avoid.slice(0, 40).map((t) => `  * ${t.slice(0, 120)}`).join('\n')}` : ''}

Return only JSON:
{
  "subject_mcqs": [ { "question_text": "...", "options": ["...","...","...","..."], "correct_option": "...", "explanation": "one line" } ],
  "pedagogy_mcqs": [ same shape ],
  "lesson_prompt": "a lesson-plan task for this subject and grade",
  "lesson_rubric": "how to score that lesson plan, 1-10 on named dimensions",
  "demo_prompt": "a 5-minute teaching demo task for this subject and grade",
  "demo_rubric": "how to score the demo",
  "scenario_prompt": "a classroom scenario they answer on camera",
  "scenario_rubric": "how to score the scenario"
}`;
}

async function askModel(ai: GoogleGenAI, prompt: string): Promise<Record<string, unknown> | null> {
  for (const model of ['gemini-3.5-flash', 'gemini-flash-lite-latest']) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json', temperature: 0.6 }
      });
      const text = (response.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch (err) {
      console.warn(`Test writing with ${model} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export type GeneratedPackData = Omit<AssessmentPack, 'id' | 'created_at' | 'status' | 'school_id'>;

/**
 * Writes a test for one subject and grade. Needs real AI-written questions: if
 * it cannot get a full set after three tries it fails, rather than padding the
 * test with template questions (which the old code did, with the right answer
 * always first).
 */
export async function generateAssessmentPackData(input: { subject: string; segment: string; board: string }): Promise<GeneratedPackData> {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('AI test writing is not switched on for this site yet.');
  const ai = new GoogleGenAI({ apiKey });

  const seen = new Set<string>();
  let subjectMcqs: Mcq[] = [];
  let pedagogyMcqs: Mcq[] = [];
  let prompts: Record<string, unknown> = {};

  for (let attempt = 0; attempt < 3; attempt++) {
    const needSubject = SUBJECT_MCQ_COUNT - subjectMcqs.length;
    const needPedagogy = PEDAGOGY_MCQ_COUNT - pedagogyMcqs.length;
    if (needSubject <= 0 && needPedagogy <= 0) break;

    const parsed = await askModel(
      ai,
      mcqPrompt(input.subject, input.segment, input.board, Math.max(needSubject, 0), Math.max(needPedagogy, 0), Array.from(seen))
    );
    if (!parsed) continue;
    if (!prompts.lesson_prompt) prompts = parsed;

    subjectMcqs = [...subjectMcqs, ...validateAiMcqs(parsed.subject_mcqs, 'subject', seen)].slice(0, SUBJECT_MCQ_COUNT);
    pedagogyMcqs = [...pedagogyMcqs, ...validateAiMcqs(parsed.pedagogy_mcqs, 'pedagogy', seen)].slice(0, PEDAGOGY_MCQ_COUNT);
  }

  if (subjectMcqs.length < SUBJECT_MCQ_COUNT || pedagogyMcqs.length < PEDAGOGY_MCQ_COUNT) {
    throw new Error(
      `Could only write ${subjectMcqs.length} of ${SUBJECT_MCQ_COUNT} subject questions and ${pedagogyMcqs.length} of ${PEDAGOGY_MCQ_COUNT} teaching questions for ${input.subject}. Try again.`
    );
  }

  const fallback = buildFallbackPack({ school_id: '', ...input });
  const text = (key: string, fb: string) => (typeof prompts[key] === 'string' && (prompts[key] as string).trim() ? (prompts[key] as string).trim() : fb);
  const subjectNumbered = numbered(subjectMcqs, 'mcq_subj');
  const pedagogyNumbered = numbered(pedagogyMcqs, 'mcq_ped') as GeneratedPackData['pedagogy_mcqs'];

  return {
    title: `${input.subject} · ${input.segment}`,
    subject: input.subject,
    segment: input.segment,
    board: input.board,
    mcqs: [...subjectNumbered, ...(pedagogyNumbered as Mcq[])],
    pedagogy_mcqs: pedagogyNumbered,
    lesson_prompt: text('lesson_prompt', fallback.lesson_prompt),
    lesson_rubric: text('lesson_rubric', fallback.lesson_rubric),
    demo_prompt: text('demo_prompt', fallback.demo_prompt),
    demo_rubric: text('demo_rubric', fallback.demo_rubric),
    scenario_prompt: text('scenario_prompt', fallback.scenario_prompt),
    scenario_rubric: text('scenario_rubric', fallback.scenario_rubric)
  };
}
