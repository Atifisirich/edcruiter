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
import type {
  Candidate, QuestionImportance, School, ScreeningCall, ScreeningCallSettings, ScreeningCheck, ScreeningGroup,
  ScreeningLanguage, ScreeningQuestionSet,
} from './types';
import { cleanImportance, cleanRequirements, GROUP_KEYS, groupOf, normalizeRules } from './screeningFlow';
import { checkTemplate, DEFAULT_SCRIPT, fillTemplate, knownKeys, parseScript, roleText, rulesText, schoolFactsText, scriptOf, TONES, variableValues } from './callScript';
import type { CallScript } from './types';

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

export type FullScreeningSettings = Required<ScreeningCallSettings>;

const LANGUAGES: ScreeningLanguage[] = ['auto', 'English', 'Hindi', 'Telugu'];
export const DELAY_CHOICES = [0, 2, 5, 10, 30, 60];

function cleanEmails(input: unknown): string[] {
  const list = Array.isArray(input) ? input : [];
  return [...new Set(list.map((e) => String(e ?? '').trim().toLowerCase()).filter((e) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)))].slice(0, 10);
}

function num(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/** Every setting, with anything missing filled in and anything out of range put right. Never fails. */
export function screeningSettingsOf(school: Pick<School, 'screening_call'> | null | undefined): FullScreeningSettings {
  const s = school?.screening_call;
  const questions = s?.questions?.length ? s.questions : STARTER_SCREENING_QUESTIONS;
  const requirements = cleanRequirements(questions, s?.requirements);
  const sets: Partial<Record<ScreeningGroup, ScreeningQuestionSet>> = {};
  for (const g of GROUP_KEYS) {
    const own = s?.sets?.[g];
    if (!own?.questions?.length) continue;
    const reqs = cleanRequirements(own.questions, own.requirements);
    sets[g] = { questions: own.questions, requirements: reqs, importance: cleanImportance(reqs, own.importance) };
  }
  const ac = s?.auto_call;
  return {
    questions,
    requirements,
    importance: cleanImportance(requirements, s?.importance),
    sets,
    non_teaching_roles: (s?.non_teaching_roles ?? []).map((r) => String(r).trim()).filter(Boolean).slice(0, 30),
    auto_call_on_apply: s?.auto_call_on_apply === true,
    auto_call: {
      delay_min: DELAY_CHOICES.includes(Number(ac?.delay_min)) ? Number(ac?.delay_min) : 0,
      heads_up: ac?.heads_up === true,
      min_cv_score: num(ac?.min_cv_score ?? 0, 0, 10),
      groups: (ac?.groups ?? []).filter((g) => GROUP_KEYS.includes(g)),
    },
    language: LANGUAGES.includes(s?.language as ScreeningLanguage) ? s!.language as ScreeningLanguage : 'English',
    limits: { monthly_cap_inr: num(s?.limits?.monthly_cap_inr ?? 0, 0, 10_000_000), daily_max_calls: num(s?.limits?.daily_max_calls ?? 0, 0, 10_000) },
    notify: {
      emails: cleanEmails(s?.notify?.emails),
      good_fit_now: s?.notify?.good_fit_now === true,
      daily_digest: s?.notify?.daily_digest === true,
    },
    rules: normalizeRules(s?.rules),
    script: scriptOf(s?.script),
  };
}

/** The questions a candidate is asked: their kind of post's own set, or the main questions. */
export function questionSetFor(
  settings: FullScreeningSettings,
  candidate: Pick<Candidate, 'applied_subject' | 'applied_segment' | 'applied_grades'>
): ScreeningQuestionSet & { group: ScreeningGroup | null; own: boolean } {
  const group = groupOf(candidate, settings.non_teaching_roles);
  const own = group ? settings.sets[group] : undefined;
  if (own) return { ...own, group, own: true };
  return { questions: settings.questions, requirements: settings.requirements, importance: settings.importance, group, own: false };
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

/** Checks one list of questions as the school edited it. A question left blank is dropped with its requirement. */
function parseSet(raw: unknown, label: string, known: Set<string>): { ok: true; set: ScreeningQuestionSet } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.questions) ? r.questions : [];
  const rawReqs = Array.isArray(r.requirements) ? r.requirements : [];
  const rawImp = Array.isArray(r.importance) ? r.importance : [];
  const kept = list
    .map((q, i) => ({ q: typeof q === 'string' ? q.replace(/\s+/g, ' ').trim() : '', r: typeof rawReqs[i] === 'string' ? rawReqs[i] : '', imp: rawImp[i] }))
    .filter((x) => x.q);
  const questions = kept.map((x) => x.q);
  const requirements = cleanRequirements(questions, kept.map((x) => x.r));
  // Older clients send no importance: a written requirement is then a must-have.
  const importance: QuestionImportance[] = cleanImportance(requirements, Array.isArray(r.importance) ? kept.map((x) => x.imp) : undefined);
  const where = label ? ` (${label})` : '';
  if (questions.length === 0) return { ok: false, error: `Add at least one question${where}.` };
  if (questions.length > MAX_SCREENING_QUESTIONS) return { ok: false, error: `Up to ${MAX_SCREENING_QUESTIONS} questions${where}; a screening call should stay short.` };
  if (questions.some((q) => q.length < 8 || q.length > 200)) return { ok: false, error: `Each question needs 8 to 200 characters${where}.` };
  for (const [i, q] of questions.entries()) {
    const err = checkTemplate(q, known, `Question ${i + 1}${where}`) ?? checkTemplate(requirements[i] ?? '', known, `What you want to hear for question ${i + 1}${where}`);
    if (err) return { ok: false, error: err };
  }
  const missing = kept.findIndex((x, i) => (x.imp === 'must' || x.imp === 'prefer') && !requirements[i]);
  if (missing >= 0) return { ok: false, error: `Question ${missing + 1}${where} is a must-have or preference: write what answer you want to hear.` };
  return { ok: true, set: { questions, requirements, importance } };
}

/** Checks the school's edited settings before they are saved. */
export function parseScreeningSettings(input: unknown): { ok: true; settings: FullScreeningSettings } | { ok: false; error: string } {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const script = parseScript(raw.script);
  if (!script.ok) return script;
  const known = knownKeys(script.script);
  const main = parseSet(raw, '', known);
  if (!main.ok) return main;
  const sets: Partial<Record<ScreeningGroup, ScreeningQuestionSet>> = {};
  const rawSets = (raw.sets && typeof raw.sets === 'object' ? raw.sets : {}) as Record<string, unknown>;
  for (const g of GROUP_KEYS) {
    if (!rawSets[g]) continue;
    const parsed = parseSet(rawSets[g], GROUPS_LABEL[g], known);
    if (!parsed.ok) return parsed;
    sets[g] = parsed.set;
  }
  const roles = Array.isArray(raw.non_teaching_roles) ? raw.non_teaching_roles : [];
  if (roles.some((r) => /[<>{}]/.test(String(r)))) return { ok: false, error: 'Role names cannot contain < > { or }.' };
  // Everything else is put right rather than refused.
  const settings = screeningSettingsOf({
    screening_call: {
      ...main.set,
      sets,
      non_teaching_roles: roles.map((r) => String(r).replace(/\s+/g, ' ').trim().slice(0, 60)),
      auto_call_on_apply: raw.auto_call_on_apply === true,
      auto_call: raw.auto_call as ScreeningCallSettings['auto_call'],
      language: raw.language as ScreeningLanguage,
      limits: raw.limits as ScreeningCallSettings['limits'],
      notify: raw.notify as ScreeningCallSettings['notify'],
      rules: raw.rules as ScreeningCallSettings['rules'],
      script: script.script,
    },
  });
  return { ok: true, settings };
}

const GROUPS_LABEL: Record<ScreeningGroup, string> = {
  pre_primary: 'Pre-primary', primary: 'Primary', middle: 'Middle school', secondary: 'Secondary', senior_secondary: 'Senior secondary', non_teaching: 'Non-teaching',
};

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

/**
 * The variables the Sarvam agent's instructions read. Everything the school
 * wrote is filled in here, so the agent only gets finished plain text.
 */
export function callVariables(
  candidate: Pick<Candidate, 'name' | 'applied_subject' | 'applied_segment'>,
  school: Pick<School, 'name'>,
  questions: string[],
  language = 'English',
  script: CallScript = DEFAULT_SCRIPT
) {
  const values = variableValues(script, candidate, school);
  const fill = (t: string) => fillTemplate(t, values);
  return {
    // The Sarvam agent's instructions read this to choose the language it speaks.
    language,
    candidate_name: values.candidate_name,
    school_name: school.name,
    role: roleText(candidate),
    question_count: String(questions.length),
    questions: questions.map((q, i) => `${i + 1}. ${fill(q)}`).join('\n'),
    agent_name: script.agent_name,
    tone: TONES.find((t) => t.value === script.tone)!.help,
    greeting: fill(script.greeting),
    closing: fill(script.closing),
    school_info: schoolFactsText(script, values) || 'Nothing extra. If asked something you do not know, say the school team will answer it.',
    instructions: rulesText(script, values) || 'None.',
    max_minutes: String(script.max_minutes),
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
  interest: 'interested' | 'not_interested' | 'unclear';
  /** Set when the candidate asked to be called at another time instead of finishing the call. */
  callback?: { when_text: string; at: string };
}

function transcriptText(transcript: { role: string; text: string }[]): string {
  return transcript.map((t) => `${t.role === 'agent' ? 'AI caller' : 'Candidate'}: ${t.text}`).join('\n');
}

/** "Wednesday 18 November 2026, 2:05 pm" in India time, so the AI can turn "tomorrow at 4" into a real time. */
function istNowText(now: Date): string {
  return now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Turns the transcript into an answer per question, a summary and a recommendation. Plain fallback without Gemini. */
export async function analyseCall(
  questions: string[],
  transcript: { role: 'agent' | 'user'; text: string }[],
  requirements: string[] = [],
  importance: QuestionImportance[] = [],
  now: Date = new Date()
): Promise<CallAnalysis> {
  const musts = questions
    .map((q, i) => ({ question: q, requirement: requirements[i] || '', importance: (importance[i] === 'prefer' ? 'prefer' : importance[i] === 'ask' ? 'ask' : 'must') as QuestionImportance }))
    .filter((m) => m.requirement && m.importance !== 'ask')
    .map((m) => ({ question: m.question, requirement: m.requirement, importance: m.importance as 'must' | 'prefer' }));
  const fallback: CallAnalysis = {
    answers: questions.map((q) => ({ question: q, answer: 'See the transcript.' })),
    summary: transcript.length ? 'The call was completed. Read the transcript for the answers.' : 'No conversation was recorded.',
    recommendation: 'maybe',
    // Without a reading of the call, no must-have can be said to be met.
    checks: musts.map((m) => ({ ...m, result: 'unclear' as const, note: 'Could not be read from the call.' })),
    interest: 'unclear',
  };
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || transcript.length === 0) return fallback;
  const prompt = `This is the transcript of a short screening phone call between an AI caller and a person who applied for a job at a school in India. The call may be in English, Hindi or Telugu; always reply in English.
It is now ${istNowText(now)} (India time).
Read it and reply with ONLY JSON:
{"answers": [{"question": "...", "answer": "..."}], "summary": "...", "recommendation": "proceed" | "maybe" | "not_suitable", "checks": [{"requirement": "...", "result": "met" | "not_met" | "unclear", "note": "..."}], "interest": "interested" | "not_interested" | "unclear", "callback": null | {"when_text": "...", "at": "YYYY-MM-DDTHH:mm:00+05:30"}}
- One entry in "answers" for each of these questions, in this order, with the question copied exactly. The answer is what the candidate said, in one short plain sentence. If they did not answer it, write "Not answered".
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}
- "summary": two or three plain sentences a school principal can read in ten seconds.
${musts.length ? `- "checks": one entry for each item below, in this order, with the requirement copied exactly. "met" if what the candidate said satisfies it, "not_met" if what they said clearly does not, "unclear" if they did not say enough. "note" is a few words on why.
${musts.map((m, i) => `${i + 1}. For the question "${m.question}": ${m.requirement}`).join('\n')}` : '- "checks": an empty array.'}
- "interest": "not_interested" only if the candidate clearly said they no longer want this job; "interested" if they said they do or carried on willingly; otherwise "unclear".
- "callback": only if the candidate asked to be called at another time INSTEAD of finishing the call now (for example "I am in class, call me after 4"). "when_text" is what they said, in English. "at" is that time as a full date and time in India time; if they gave no time, two hours from now. Otherwise null.
- "recommendation": "proceed" if they are interested and nothing rules them out; "not_suitable" if they are not interested or something clearly rules them out (for example no B.Ed where required, or cannot join); otherwise "maybe". Only the requirements above may rule someone out; do not invent others.

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
      return { question: m.question, requirement: m.requirement, importance: m.importance, result, ...(c?.note ? { note: String(c.note).slice(0, 160) } : {}) };
    });
    const interest = parsed.interest === 'interested' || parsed.interest === 'not_interested' ? parsed.interest : 'unclear';
    const cb = parsed.callback as { when_text?: unknown; at?: unknown } | null | undefined;
    const callback = cb && typeof cb === 'object' && interest !== 'not_interested'
      ? { when_text: String(cb.when_text || 'later').slice(0, 120), at: typeof cb.at === 'string' && Number.isFinite(Date.parse(cb.at)) ? new Date(cb.at).toISOString() : '' }
      : undefined;
    return { answers, summary: String(parsed.summary || fallback.summary).slice(0, 800), recommendation, checks, interest, ...(callback ? { callback } : {}) };
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
  questions: string[],
  script: CallScript = DEFAULT_SCRIPT
): Promise<{ role: 'agent' | 'user'; text: string }[]> {
  const first = candidate.name.split(' ')[0] || candidate.name;
  const values = variableValues(script, candidate, school);
  const greeting = fillTemplate(script.greeting, values);
  const closing = fillTemplate(script.closing, values);
  const info = schoolFactsText(script, values);
  const tone = TONES.find((t) => t.value === script.tone)!.help;
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
The caller is called ${script.agent_name}. Tone: ${tone}
The caller opens with exactly: "${greeting}"
Then asks these questions one at a time:
${questions.map((q, i) => `${i + 1}. ${fillTemplate(q, values)}`).join('\n')}
${info ? `If the candidate asks about the school, the caller may only use these facts: ${info}\nHave the candidate ask one short question that the caller answers from these facts.\n` : ''}Then the caller ends with exactly: "${closing}"
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
    { role: 'agent', text: greeting },
    { role: 'user', text: 'Yes, go ahead.' },
  ];
  for (const q of questions) {
    turns.push({ role: 'agent', text: fillTemplate(q, values) });
    turns.push({ role: 'user', text: 'Yes, that works for me.' });
  }
  turns.push({ role: 'agent', text: closing || `Thank you, ${first}. The school will be in touch about the next step.` });
  return turns;
}
