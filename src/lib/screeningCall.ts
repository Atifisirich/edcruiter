/**
 * The AI screening phone call: before any interview, an AI voice agent rings
 * the candidate, asks the school's screening questions, and the school gets a
 * summary, an answer per question and a recommendation.
 *
 * How it works across many schools: the platform has ONE Sarvam voice agent
 * and ONE phone line (like the shared WhatsApp number). The agent's
 * instructions say "ask the questions you are given". Each call sends that
 * school's own questions, its name, and the candidate's name and role as call
 * variables. When the call ends, Sarvam posts the transcript to our webhook,
 * and Gemini turns it into an answer per question, a summary and a
 * recommendation.
 *
 * Demo mode: until the Sarvam keys are set on the server, no phone call is
 * made. A sample conversation is written from the candidate's own details so
 * the feature can be shown, and it is clearly labelled as a demo everywhere.
 */

import { GoogleGenAI } from '@google/genai';
import { createHmac } from 'crypto';
import { logAiUsage } from './aiUsage';
import type { Candidate, School, ScreeningCall, ScreeningCallSettings, ScreeningCheck } from './types';
import { cleanRequirements, normalizeRules } from './screeningFlow';

export const STARTER_SCREENING_QUESTIONS = [
  'Are you still interested in this teaching position?',
  'What is your notice period, and when could you join?',
  'How many years have you taught, and which grades and boards?',
  'Do you have a B.Ed degree?',
  'What is your current salary, and what salary do you expect?',
  'Can you travel to our campus every day?',
];

export const MAX_SCREENING_QUESTIONS = 12;
/** What a school pays per started minute of an answered call, unless the platform owner sets another rate. */
export const STANDARD_PRICE_PER_MINUTE_INR = 9;
/** Sarvam pay-as-you-go agent rate plus its phone line (₹0.20 per 30 seconds), per started minute. */
export const COST_PER_MINUTE_INR = 3.5 + 0.4;

export function screeningSettingsOf(school: Pick<School, 'screening_call'> | null | undefined): Required<ScreeningCallSettings> {
  const questions = school?.screening_call?.questions?.length ? school.screening_call.questions : STARTER_SCREENING_QUESTIONS;
  return {
    questions,
    requirements: cleanRequirements(questions, school?.screening_call?.requirements),
    auto_call_on_apply: school?.screening_call?.auto_call_on_apply === true,
    rules: normalizeRules(school?.screening_call?.rules),
  };
}

/** The school's rate per started minute. */
export function pricePerMinuteOf(school: Pick<School, 'screening_call_price_per_min_inr'> | null | undefined): number {
  const p = school?.screening_call_price_per_min_inr;
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : STANDARD_PRICE_PER_MINUTE_INR;
}

/** Whole minutes billed for a call: every started minute counts, as Sarvam bills it. */
export function billedMinutes(durationSec: number | undefined): number {
  return durationSec && durationSec > 0 ? Math.ceil(durationSec / 60) : 0;
}

/** What the school is charged for an answered call of this length. */
export function callChargeInr(school: Pick<School, 'screening_call_price_per_min_inr'> | null | undefined, durationSec: number | undefined): number {
  return billedMinutes(durationSec) * pricePerMinuteOf(school);
}

/** Checks the school's edited settings before they are saved. */
export function parseScreeningSettings(input: unknown): { ok: true; settings: Required<ScreeningCallSettings> } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const list = Array.isArray(raw.questions) ? raw.questions : [];
  const rawReqs = Array.isArray(raw.requirements) ? raw.requirements : [];
  // A question left blank is dropped together with its must-have.
  const kept = list
    .map((q, i) => ({ q: typeof q === 'string' ? q.replace(/\s+/g, ' ').trim() : '', r: typeof rawReqs[i] === 'string' ? rawReqs[i] : '' }))
    .filter((x) => x.q);
  const questions = kept.map((x) => x.q);
  const requirements = cleanRequirements(questions, kept.map((x) => x.r));
  if (questions.length === 0) return { ok: false, error: 'Add at least one question.' };
  if (questions.length > MAX_SCREENING_QUESTIONS) return { ok: false, error: `Up to ${MAX_SCREENING_QUESTIONS} questions; a screening call should stay short.` };
  if (questions.some((q) => q.length < 8 || q.length > 200)) return { ok: false, error: 'Each question needs 8 to 200 characters.' };
  if (questions.some((q) => /[<>{}]/.test(q))) return { ok: false, error: 'Questions cannot contain < > { or }.' };
  if (requirements.some((r) => /[<>{}]/.test(r))) return { ok: false, error: 'Must-haves cannot contain < > { or }.' };
  return { ok: true, settings: { questions, requirements, auto_call_on_apply: raw.auto_call_on_apply === true, rules: normalizeRules(raw.rules) } };
}

/** A phone number as Sarvam wants it: +91 and ten digits for an Indian mobile. Null when it is not a usable number. */
export function toCallNumber(phone: string | undefined): string | null {
  const digits = (phone || '').replace(/[^\d+]/g, '');
  if (/^\+\d{10,15}$/.test(digits)) return digits;
  const bare = digits.replace(/^\+/, '').replace(/^0+/, '');
  if (/^[6-9]\d{9}$/.test(bare)) return `+91${bare}`;
  if (/^91[6-9]\d{9}$/.test(bare)) return `+${bare}`;
  return null;
}

// --- Sarvam ---------------------------------------------------------------

interface SarvamEnv {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  appId: string;
  appVersion: number;
  connectionId: string;
  agentNumber: string;
}

/** The Sarvam settings from the server's environment, or null when real calls are not set up yet (demo mode). */
export function sarvamEnv(): SarvamEnv | null {
  const e = process.env;
  const env = {
    apiKey: e.SARVAM_API_KEY || '',
    orgId: e.SARVAM_ORG_ID || '',
    workspaceId: e.SARVAM_WORKSPACE_ID || '',
    appId: e.SARVAM_APP_ID || '',
    appVersion: Number(e.SARVAM_APP_VERSION || '1'),
    connectionId: e.SARVAM_CONNECTION_ID || '',
    agentNumber: e.SARVAM_AGENT_NUMBER || '',
  };
  return env.apiKey && env.orgId && env.workspaceId && env.appId && env.connectionId && env.agentNumber ? env : null;
}

/** Signs a call id so only Sarvam's callback for that call is accepted by our webhook. */
export function webhookToken(callId: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET || 'dev').update(`screening-call:${callId}`).digest('base64url');
}

/** The variables the Sarvam agent's instructions read. */
export function callVariables(candidate: Pick<Candidate, 'name' | 'applied_subject' | 'applied_segment'>, school: Pick<School, 'name'>, questions: string[]) {
  return {
    candidate_name: candidate.name.split(' ')[0] || candidate.name,
    school_name: school.name,
    role: [candidate.applied_subject, 'teacher'].filter(Boolean).join(' ') + (candidate.applied_segment ? `, ${candidate.applied_segment.split('(')[0].trim()}` : ''),
    question_count: String(questions.length),
    questions: questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
  };
}

/** Asks Sarvam to ring the candidate now. Returns Sarvam's attempt id. */
export async function placeSarvamCall(env: SarvamEnv, input: {
  callId: string;
  phone: string;
  variables: Record<string, string>;
  appUrl: string;
}): Promise<string> {
  const url = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${encodeURIComponent(env.orgId)}/workspaces/${encodeURIComponent(env.workspaceId)}/outbounds`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-API-Key': env.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_config: {
        app_id: env.appId,
        app_version: env.appVersion,
        connection_config: { connection_id: env.connectionId, agent_phone_number: env.agentNumber },
        agent_variables: input.variables,
      },
      user_config: { user_phone_number: input.phone },
      webhook_config: {
        url: `${input.appUrl.replace(/\/$/, '')}/api/screening-calls/webhook?call=${encodeURIComponent(input.callId)}&token=${webhookToken(input.callId)}`,
        metadata: { call_id: input.callId },
      },
    }),
  });
  const data = await res.json().catch(() => ({})) as { attempt_id?: string; detail?: unknown };
  if (!res.ok || !data.attempt_id) {
    const why = Array.isArray(data.detail) ? data.detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join('; ') : '';
    throw new Error(`Sarvam did not place the call (${res.status})${why ? `: ${why}` : ''}`);
  }
  return data.attempt_id;
}

/** Sarvam's call outcome, in our words. */
export function statusFromSarvam(status: unknown): ScreeningCall['status'] {
  switch (status) {
    case 'connected': return 'completed';
    case 'no_answer': return 'no_answer';
    case 'busy': return 'busy';
    default: return 'failed';
  }
}

/** Platform cost of a connected call: Sarvam charges whole started minutes. */
export function callCostInr(durationSec: number | undefined): number {
  return Math.round(billedMinutes(durationSec) * COST_PER_MINUTE_INR * 100) / 100;
}

// --- Reading the conversation ---------------------------------------------

export interface CallAnalysis {
  answers: { question: string; answer: string }[];
  summary: string;
  recommendation: 'proceed' | 'maybe' | 'not_suitable';
  checks: ScreeningCheck[];
}

function transcriptText(transcript: { role: string; text: string }[]): string {
  return transcript.map((t) => `${t.role === 'agent' ? 'AI caller' : 'Candidate'}: ${t.text}`).join('\n');
}

/** Turns the transcript into an answer per question, a summary and a recommendation. Plain fallback without Gemini. */
export async function analyseCall(questions: string[], transcript: { role: 'agent' | 'user'; text: string }[], requirements: string[] = []): Promise<CallAnalysis> {
  const musts = questions.map((q, i) => ({ question: q, requirement: requirements[i] || '' })).filter((m) => m.requirement);
  const fallback: CallAnalysis = {
    answers: questions.map((q) => ({ question: q, answer: 'See the transcript.' })),
    summary: transcript.length ? 'The call was completed. Read the transcript for the answers.' : 'No conversation was recorded.',
    recommendation: 'maybe',
    // Without a reading of the call, no must-have can be said to be met.
    checks: musts.map((m) => ({ ...m, result: 'unclear' as const, note: 'Could not be read from the call.' })),
  };
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || transcript.length === 0) return fallback;
  const prompt = `This is the transcript of a short screening phone call between an AI caller and a teacher who applied to a school in India.
Read it and reply with ONLY JSON:
{"answers": [{"question": "...", "answer": "..."}], "summary": "...", "recommendation": "proceed" | "maybe" | "not_suitable", "checks": [{"requirement": "...", "result": "met" | "not_met" | "unclear", "note": "..."}]}
- One entry in "answers" for each of these questions, in this order, with the question copied exactly. The answer is what the candidate said, in one short plain sentence. If they did not answer it, write "Not answered".
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
- "summary": two or three plain sentences a school principal can read in ten seconds.
${musts.length ? `- "checks": one entry for each must-have below, in this order, with the requirement copied exactly. "met" if what the candidate said satisfies it, "not_met" if what they said clearly does not, "unclear" if they did not say enough. "note" is a few words on why.
${musts.map((m, i) => `${i + 1}. For the question "${m.question}": ${m.requirement}`).join('\n')}` : '- "checks": an empty array.'}
- "recommendation": "proceed" if they are interested and nothing rules them out; "not_suitable" if they are not interested or something clearly rules them out (for example no B.Ed where required, or cannot join); otherwise "maybe".

Transcript:
${transcriptText(transcript)}`;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt, config: { responseMimeType: 'application/json', temperature: 0.2 } });
    logAiUsage('screening-call-analysis', response, 'gemini-flash-lite-latest');
    const parsed = JSON.parse((response.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '')) as Partial<CallAnalysis>;
    const answers = questions.map((q, i) => ({ question: q, answer: String(parsed.answers?.[i]?.answer || 'Not answered').slice(0, 400) }));
    const recommendation = parsed.recommendation === 'proceed' || parsed.recommendation === 'not_suitable' ? parsed.recommendation : 'maybe';
    const rawChecks = Array.isArray(parsed.checks) ? parsed.checks : [];
    const checks: ScreeningCheck[] = musts.map((m, i) => {
      const c = rawChecks[i] as Partial<ScreeningCheck> | undefined;
      const result = c?.result === 'met' || c?.result === 'not_met' ? c.result : 'unclear';
      return { question: m.question, requirement: m.requirement, result, ...(c?.note ? { note: String(c.note).slice(0, 160) } : {}) };
    });
    return { answers, summary: String(parsed.summary || fallback.summary).slice(0, 800), recommendation, checks };
  } catch (err) {
    console.warn('Screening call analysis failed:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Demo mode only: a sample conversation written from the candidate's own
 * details, so the feature can be shown before real calls are set up. Never
 * presented as a real call (the record is mode 'demo').
 */
export async function demoTranscript(
  candidate: Pick<Candidate, 'name' | 'applied_subject' | 'applied_segment' | 'notice_period' | 'experience_band' | 'qualification' | 'current_salary' | 'expected_salary' | 'current_location'>,
  school: Pick<School, 'name'>,
  questions: string[]
): Promise<{ role: 'agent' | 'user'; text: string }[]> {
  const first = candidate.name.split(' ')[0] || candidate.name;
  const known = [
    candidate.notice_period && `notice period ${candidate.notice_period}`,
    candidate.experience_band && `experience ${candidate.experience_band}`,
    candidate.qualification && `qualification ${candidate.qualification}`,
    candidate.current_salary && `current salary ${candidate.current_salary}`,
    candidate.expected_salary && `expected salary ${candidate.expected_salary}`,
    candidate.current_location && `lives in ${candidate.current_location}`,
  ].filter(Boolean).join('; ');
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Write a short, realistic phone screening conversation (Indian English) between a polite AI caller from ${school.name} and ${candidate.name}, who applied for a ${candidate.applied_subject || 'teaching'} post (${candidate.applied_segment || 'school'}).
The caller greets them by first name, says it is an automated screening call from ${school.name}, asks if it is a good time, then asks these questions one at a time, then thanks them and says the school will be in touch:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
The candidate answers naturally and briefly${known ? `, consistent with what they told the school: ${known}` : ''}.
Reply with ONLY a JSON array of turns: [{"role": "agent" | "user", "text": "..."}].`;
      const response = await ai.models.generateContent({ model: 'gemini-flash-lite-latest', contents: prompt, config: { responseMimeType: 'application/json', temperature: 0.7 } });
      logAiUsage('screening-call-demo', response, 'gemini-flash-lite-latest');
      const turns = JSON.parse((response.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '')) as { role?: string; text?: string }[];
      const clean = (Array.isArray(turns) ? turns : [])
        .filter((t) => typeof t?.text === 'string' && t.text.trim())
        .map((t) => ({ role: t.role === 'user' ? 'user' as const : 'agent' as const, text: String(t.text).slice(0, 600) }));
      if (clean.length >= 4) return clean;
    } catch (err) {
      console.warn('Demo screening call writing failed:', err instanceof Error ? err.message : err);
    }
  }
  // Without Gemini: a plain script from the questions.
  const turns: { role: 'agent' | 'user'; text: string }[] = [
    { role: 'agent', text: `Hello ${first}, this is an automated screening call from ${school.name} about your application. Is this a good time to talk for three minutes?` },
    { role: 'user', text: 'Yes, go ahead.' },
  ];
  for (const q of questions) {
    turns.push({ role: 'agent', text: q });
    turns.push({ role: 'user', text: 'Yes, that works for me.' });
  }
  turns.push({ role: 'agent', text: `Thank you, ${first}. The school will be in touch about the next step.` });
  return turns;
}
