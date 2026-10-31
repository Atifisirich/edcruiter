/**
 * The instructions sent to the model when it writes a teaching profile, and the
 * reading of its reply. Kept free of database and network code so both are tested.
 */

import { defsInGroup, factorDef, type FactorDef, type RawFactor } from './teachingProfile';

export interface ProfileTextInput {
  candidateName: string;
  subject: string;
  segment: string;
  board?: string;
  qualification?: string;
  experience?: string;
  lessonPrompt?: string;
  lessonPlan: string;
  demoPrompt?: string;
  demoTranscript: string;
  scenarioPrompt?: string;
  scenarioTranscript: string;
  policyAcknowledgement?: string;
  resumeText: string;
  mcq?: { correct: number; total: number } | null;
  /** The marked questions, as stored: question, what they picked, the key and whether it was right. */
  mcqBlock?: string;
}

const FAIRNESS = `FAIRNESS RULES (these override everything else):
- Judge only what the candidate wrote or said, against the question they were asked.
- Never let name, gender, age, religion, caste, region, accent, skin colour, disability, family status, or the quality of their device or room change a score.
- Do not guess. If the submissions hold no real evidence for a factor, give it "score": null and say so.
- Use "the candidate" or "they". Never use he or she.`;

const SCALE = `SCORING SCALE (0-100). Use the whole range and do not inflate:
- 0-20: absent, wrong, abusive or refused
- 21-40: weak: major gaps or errors
- 41-60: developing: some sound ideas, noticeable gaps
- 61-79: solid: would do the job well with normal support
- 80-100: excellent: specific, accurate, classroom-ready, with real depth
A short, generic or copied answer cannot score above 60.`;

function clip(text: string, max: number): string {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max)}\n[...cut for length]` : t;
}

function factorLines(defs: FactorDef[]): string {
  return defs.map((d) => `- "${d.key}": ${d.label}. ${d.definition}`).join('\n');
}

/** Keys the text pass is asked for: everything judged from words, not from the video. */
export function textFactorDefs(): FactorDef[] {
  return (['area', 'extra', 'resume', 'communication', 'attitude'] as const)
    .flatMap((g) => defsInGroup(g))
    .filter((d) => d.source !== 'video');
}

export function buildTextPrompt(input: ProfileTextInput): string {
  const defs = textFactorDefs();
  const section = (title: string, prompt: string | undefined, body: string) =>
    `### ${title}\n${prompt ? `Question asked: ${prompt}\n` : ''}Candidate's response:\n"""\n${body ? clip(body, 6000) : '(nothing submitted)'}\n"""`;

  return `You are a senior school hiring assessor writing a structured profile of a teaching candidate for a principal.

Candidate: ${input.candidateName}
Applying for: ${input.subject} teacher, ${input.segment}${input.board ? `, ${input.board}` : ''}
${input.qualification ? `Qualification on form: ${input.qualification}\n` : ''}${input.experience ? `Experience on form: ${input.experience}\n` : ''}${input.mcq ? `Subject test: ${input.mcq.correct} of ${input.mcq.total} correct (already marked by the system).\n` : ''}
${FAIRNESS}

${SCALE}

${input.mcqBlock ? `### Subject test (marked by the system)
"""
${clip(input.mcqBlock, 5000)}
"""

` : ''}${section('1. Lesson plan', input.lessonPrompt, input.lessonPlan)}

${section('2. Teaching demonstration (spoken, transcribed)', input.demoPrompt, input.demoTranscript)}

${section('3. Classroom scenario (spoken, transcribed)', input.scenarioPrompt, input.scenarioTranscript)}

${input.policyAcknowledgement ? `### 4. School policy briefing\n"""\n${clip(input.policyAcknowledgement, 1500)}\n"""\n\n` : ''}### CV text
"""
${input.resumeText ? clip(input.resumeText, 6000) : '(no CV text available)'}
"""

For EACH factor below give a score, a reason, and a quote.
- "reason": one or two plain sentences saying why, in English.
- "quote": 4 to 25 words copied EXACTLY, word for word, from the candidate's own response above (for CV factors, from the CV text). Do not paraphrase. If there is no real evidence, set "score" to null, "reason" to "Not enough evidence" and "quote" to "".
- Safeguarding awareness is judged from the scenario and policy sections: does the candidate protect children first, report concerns and keep appropriate boundaries?
- Subject knowledge is judged from the lesson plan, the demonstration and the subject test. A quote may be a question from the subject test together with the answer the candidate selected, copied exactly.

Factors:
${factorLines(defs)}

Also give "relevancy": how directly each response answers the question that was asked (0-100, or null if nothing was submitted) for "lesson", "demo" and "scenario".

Also write "summary": 3 to 5 sentences for a principal, factual, no flattery. "strengths": up to 4 short points. "improvements": up to 4 short points. Base all of them on the evidence above.

Reply with ONLY valid JSON in exactly this shape:
{
  "summary": "...",
  "strengths": ["..."],
  "improvements": ["..."],
  "relevancy": { "lesson": 0, "demo": 0, "scenario": 0 },
  "factors": {
    "professionalism": { "score": 0, "reason": "...", "quote": "..." }
  }
}`;
}

/** Keys the video pass may be asked for, depending on the school's settings. */
export function videoFactorDefs(opts: { delivery: boolean; appearance: boolean }): FactorDef[] {
  const defs: FactorDef[] = [factorDef('articulation')!];
  if (opts.delivery) defs.push(...defsInGroup('delivery'));
  else defs.push(factorDef('voice_modulation')!);
  if (opts.appearance) defs.push(...defsInGroup('appearance'));
  return defs;
}

export function buildVideoPrompt(opts: { subject: string; segment: string; delivery: boolean; appearance: boolean }): string {
  const defs = videoFactorDefs(opts);
  return `You are watching a candidate's recorded 5-minute teaching demonstration for a ${opts.subject} teaching post (${opts.segment}). Describe the delivery as a careful, fair observer. These are impressions, not measurements, and a human will weigh them.

FAIRNESS RULES (these override everything else):
- Never let gender, age, religion, caste, region, skin colour, body shape, disability or accent change a score.
- Religious and cultural dress, a head covering, a beard, a turban, a bindi, a saree or any traditional or modest clothing is NEVER a reason to score lower.
- A poor camera, dim light, a plain wall or a noisy room is not the candidate's fault. Do not mark it down.
- Do not guess. If you cannot see or hear enough to judge a factor, give "score": null.
- Use "the candidate" or "they". Never use he or she.

${SCALE}
For these impressions, 50 means ordinary and acceptable. Do not give above 90 or below 10 from a single recording.

Factors:
${factorLines(defs)}

For each factor give "score", and a "reason" that names one specific thing you saw or heard (for example "looks at the camera for most of the explanation").

Reply with ONLY valid JSON in exactly this shape:
{
  "factors": {
    "articulation": { "score": 0, "reason": "..." }
  }
}`;
}

export interface ParsedModelProfile {
  summary: string;
  strengths: string[];
  improvements: string[];
  relevancy: Record<string, number | null>;
  factors: Record<string, RawFactor>;
}

function parseJsonBody(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.replace(/\s+/g, ' ').trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, max);
}

function factorMap(value: unknown): Record<string, RawFactor> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, RawFactor> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw && typeof raw === 'object') out[key] = raw as RawFactor;
  }
  return out;
}

export function parseTextReply(text: string): ParsedModelProfile | null {
  const body = parseJsonBody(text) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return null;
  const factors = factorMap(body.factors);
  if (Object.keys(factors).length === 0) return null;

  const rel = body.relevancy && typeof body.relevancy === 'object' ? (body.relevancy as Record<string, unknown>) : {};
  const relevancy: Record<string, number | null> = {};
  for (const id of ['lesson', 'demo', 'scenario']) {
    const n = typeof rel[id] === 'number' ? (rel[id] as number) : Number(rel[id]);
    relevancy[id] = Number.isFinite(n) && rel[id] !== null && rel[id] !== '' ? Math.max(0, Math.min(100, Math.round(n))) : null;
  }

  return {
    summary: typeof body.summary === 'string' ? body.summary.replace(/\s+/g, ' ').trim().slice(0, 900) : '',
    strengths: stringList(body.strengths, 4),
    improvements: stringList(body.improvements, 4),
    relevancy,
    factors,
  };
}

export function parseVideoReply(text: string): Record<string, RawFactor> | null {
  const body = parseJsonBody(text) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return null;
  const factors = factorMap(body.factors);
  return Object.keys(factors).length ? factors : null;
}
