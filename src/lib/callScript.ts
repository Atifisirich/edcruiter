/**
 * The school's own call script: what the AI caller is called, how it sounds,
 * how it opens and closes the call, what it may tell candidates about the
 * school, extra rules, and the school's own variables.
 *
 * Any text (greeting, closing, school facts, instructions, questions and what
 * the school wants to hear) can use {{variables}}. They are filled in on our
 * server just before the call, so the voice agent only ever receives plain
 * finished text. Unknown variables are refused when the settings are saved.
 *
 * No server-only imports here: the settings screen uses it for its preview.
 */

import type { Candidate, CallScript, CallTone } from './types';

export const TONES: { value: CallTone; label: string; help: string }[] = [
  { value: 'warm', label: 'Warm and polite', help: 'Friendly, patient, says thank you often.' },
  { value: 'formal', label: 'Formal', help: 'Short, correct and to the point.' },
  { value: 'friendly', label: 'Casual and friendly', help: 'Relaxed, like a colleague on the phone.' },
];

/** Variables every school can use. Filled from the candidate and the school. */
export const BUILT_IN_VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: 'candidate_name', label: 'Candidate’s first name', sample: 'Mansi' },
  { key: 'candidate_full_name', label: 'Candidate’s full name', sample: 'Mansi Bhosle' },
  { key: 'role', label: 'Post applied for', sample: 'English teacher, Primary' },
  { key: 'subject', label: 'Subject applied for', sample: 'English' },
  { key: 'school_name', label: 'Your school’s name', sample: 'Your school' },
  { key: 'agent_name', label: 'The AI caller’s name', sample: 'Priya' },
];
const BUILT_IN_KEYS = new Set(BUILT_IN_VARIABLES.map((v) => v.key));

export const MAX_CUSTOM_VARIABLES = 15;
export const SCRIPT_LIMITS = { agent_name: 30, greeting: 400, closing: 300, school_info: 1500, instructions: 1000, var_value: 300 } as const;
export const CALL_MINUTE_CHOICES = [2, 3, 4, 5, 7, 10];

export const DEFAULT_SCRIPT: CallScript = {
  agent_name: 'Priya',
  tone: 'warm',
  greeting: 'Hello {{candidate_name}}, this is {{agent_name}}, an automated assistant calling from {{school_name}} about your application for the {{role}} post. Is this a good time to talk for three minutes?',
  closing: 'Thank you, {{candidate_name}}. The {{school_name}} team will be in touch about the next step. Have a good day.',
  school_info: '',
  instructions: '',
  max_minutes: 4,
  variables: [],
};

const KEY_RE = /^[a-z][a-z0-9_]{1,29}$/;
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '';
}

/** A variable name as the school typed it, turned into a usable key: "Campus address" → "campus_address". */
export function toVariableKey(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'v_$1').slice(0, 30);
}

/** The school's script with anything missing filled in. Never fails; never refuses. */
export function scriptOf(raw: Partial<CallScript> | null | undefined): CallScript {
  const r = raw ?? {};
  const seen = new Set<string>();
  const variables = (Array.isArray(r.variables) ? r.variables : [])
    .map((v) => ({ key: String(v?.key ?? '').trim().toLowerCase(), value: text(v?.value, SCRIPT_LIMITS.var_value) }))
    .filter((v) => KEY_RE.test(v.key) && !BUILT_IN_KEYS.has(v.key) && !seen.has(v.key) && (seen.add(v.key), true))
    .slice(0, MAX_CUSTOM_VARIABLES);
  return {
    agent_name: text(r.agent_name, SCRIPT_LIMITS.agent_name) || DEFAULT_SCRIPT.agent_name,
    tone: TONES.some((t) => t.value === r.tone) ? r.tone as CallTone : DEFAULT_SCRIPT.tone,
    greeting: text(r.greeting, SCRIPT_LIMITS.greeting) || DEFAULT_SCRIPT.greeting,
    closing: text(r.closing, SCRIPT_LIMITS.closing) || DEFAULT_SCRIPT.closing,
    school_info: text(r.school_info, SCRIPT_LIMITS.school_info),
    instructions: text(r.instructions, SCRIPT_LIMITS.instructions),
    max_minutes: CALL_MINUTE_CHOICES.includes(Number(r.max_minutes)) ? Number(r.max_minutes) : DEFAULT_SCRIPT.max_minutes,
    variables,
  };
}

/** Every variable name a text may use with this script. */
export function knownKeys(script: Pick<CallScript, 'variables'>): Set<string> {
  return new Set([...BUILT_IN_KEYS, ...script.variables.map((v) => v.key)]);
}

/** The {{names}} a text uses that are not defined. */
export function unknownVariables(value: string, known: Set<string>): string[] {
  return [...new Set([...value.matchAll(TOKEN_RE)].map((m) => m[1].toLowerCase()).filter((k) => !known.has(k)))];
}

/**
 * Checks one piece of text a school wrote: only known {{variables}}, and no
 * other < > { or }. Returns an error in plain words, or null.
 */
export function checkTemplate(value: string, known: Set<string>, where: string): string | null {
  const unknown = unknownVariables(value, known);
  if (unknown.length) return `${where} uses {{${unknown[0]}}}, which is not a variable. Add it under Your variables, or fix the spelling.`;
  if (/[<>{}]/.test(value.replace(TOKEN_RE, ''))) return `${where} cannot contain < > { or } except around a {{variable}}.`;
  return null;
}

/** Checks the school's whole script before saving. */
export function parseScript(raw: unknown): { ok: true; script: CallScript } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CallScript>;
  const rawVars = Array.isArray(r.variables) ? r.variables : [];
  const keys = rawVars.map((v) => String(v?.key ?? '').trim().toLowerCase()).filter(Boolean);
  if (keys.length > MAX_CUSTOM_VARIABLES) return { ok: false, error: `Up to ${MAX_CUSTOM_VARIABLES} of your own variables.` };
  for (const k of keys) {
    if (!KEY_RE.test(k)) return { ok: false, error: `“${k}” cannot be a variable name: use 2 to 30 small letters, numbers and _, starting with a letter.` };
    if (BUILT_IN_KEYS.has(k)) return { ok: false, error: `{{${k}}} is already filled in for you; pick another name.` };
  }
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) return { ok: false, error: `The variable {{${dup}}} is listed twice.` };
  const empty = rawVars.find((v) => v?.key && !text(v?.value, SCRIPT_LIMITS.var_value));
  if (empty) return { ok: false, error: `Give the variable {{${String(empty.key).toLowerCase()}}} a value, or remove it.` };
  if (rawVars.some((v) => /[<>{}]/.test(String(v?.value ?? '')))) return { ok: false, error: 'Variable values cannot contain < > { or }.' };
  if (/[<>{}]/.test(String(r.agent_name ?? ''))) return { ok: false, error: 'The caller’s name cannot contain < > { or }.' };

  const script = scriptOf(r);
  const known = knownKeys(script);
  const parts: [string, string][] = [
    [script.greeting, 'The greeting'], [script.closing, 'The closing'],
    [script.school_info, 'What the AI may tell candidates'], [script.instructions, 'Extra instructions'],
  ];
  for (const [value, where] of parts) {
    const err = checkTemplate(value, known, where);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, script };
}

/** The values for every variable, for one candidate at one school. */
export function variableValues(
  script: CallScript,
  candidate: Pick<Candidate, 'name' | 'applied_subject' | 'applied_segment'>,
  school: { name: string }
): Record<string, string> {
  const full = (candidate.name || '').trim();
  const values: Record<string, string> = {
    candidate_name: full.split(/\s+/)[0] || full,
    candidate_full_name: full,
    role: roleText(candidate),
    subject: candidate.applied_subject || 'teaching',
    school_name: school.name,
    agent_name: script.agent_name,
  };
  for (const v of script.variables) values[v.key] = v.value;
  return values;
}

/** "English teacher, Primary" from what the candidate applied for. */
export function roleText(candidate: Pick<Candidate, 'applied_subject' | 'applied_segment'>): string {
  return [candidate.applied_subject, 'teacher'].filter(Boolean).join(' ') + (candidate.applied_segment ? `, ${candidate.applied_segment.split('(')[0].trim()}` : '');
}

/** Fills in the {{variables}}. One that has no value is left out rather than read aloud. */
export function fillTemplate(value: string, values: Record<string, string>): string {
  return value.replace(TOKEN_RE, (_, k: string) => values[k.toLowerCase()] ?? '').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Sample values for the settings preview. */
export function sampleValues(script: CallScript, schoolName: string): Record<string, string> {
  const values: Record<string, string> = Object.fromEntries(BUILT_IN_VARIABLES.map((v) => [v.key, v.sample]));
  values.school_name = schoolName || values.school_name;
  values.agent_name = script.agent_name;
  for (const v of script.variables) values[v.key] = v.value;
  return values;
}
