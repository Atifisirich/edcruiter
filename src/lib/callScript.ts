/**
 * The school's own call script: what the AI caller is called, how it sounds,
 * how it opens and closes the call, what it may tell candidates about the
 * school, the rules it follows, and the school's own details.
 *
 * For the school this is plain language. A text has "blanks" written in square
 * brackets, like [Candidate's first name] or [Salary range]; they are filled in
 * for each candidate just before the call. Underneath, a blank is stored as
 * {{key}} (toDisplay / fromDisplay convert between the two), and the voice
 * agent only ever receives finished text.
 *
 * No server-only imports here: the settings screen uses it for its preview.
 */

import type { Candidate, CallScript, CallTone, CallVariable, ScreeningLanguage } from './types';

export const TONES: { value: CallTone; label: string; help: string; example: string }[] = [
  { value: 'warm', label: 'Warm and polite', help: 'Friendly, patient, says thank you often.', example: 'Thank you so much for your time. Please take your time to answer.' },
  { value: 'formal', label: 'Formal', help: 'Short, correct and to the point.', example: 'Good day. Please answer each question briefly.' },
  { value: 'friendly', label: 'Casual and friendly', help: 'Relaxed, like a colleague on the phone.', example: 'Great, thanks! Just a few quick questions.' },
];

export const LANGUAGE_CHOICES: { value: ScreeningLanguage; label: string }[] = [
  { value: 'English', label: 'English' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Telugu', label: 'Telugu' },
  { value: 'auto', label: 'The candidate’s own language (English, else Hindi, else Telugu)' },
];

/** What the school sees for each blank the system fills in. */
export const BUILT_IN_VARIABLES: { key: string; label: string; sample: string }[] = [
  { key: 'candidate_name', label: 'Candidate\'s first name', sample: 'Mansi' },
  { key: 'candidate_full_name', label: 'Candidate\'s full name', sample: 'Mansi Bhosle' },
  { key: 'role', label: 'Post applied for', sample: 'English teacher, Primary' },
  { key: 'subject', label: 'Subject', sample: 'English' },
  { key: 'school_name', label: 'School name', sample: 'Your school' },
  { key: 'agent_name', label: 'Caller\'s name', sample: 'Priya' },
];
const BUILT_IN_KEYS = new Set(BUILT_IN_VARIABLES.map((v) => v.key));

export const MAX_CUSTOM_VARIABLES = 15;
export const SCRIPT_LIMITS = { agent_name: 30, greeting: 400, closing: 300, school_info: 1500, instructions: 1000, var_label: 40, var_value: 300 } as const;
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
  rule_flags: [],
};

/** One click sets the tone, the opening and the closing; the school can then change any of them. */
export const STYLE_PRESETS: { key: string; label: string; help: string; tone: CallTone; greeting: string; closing: string }[] = [
  {
    key: 'warm', label: 'Warm', help: 'Friendly and patient. The standard.', tone: 'warm',
    greeting: DEFAULT_SCRIPT.greeting, closing: DEFAULT_SCRIPT.closing,
  },
  {
    key: 'formal', label: 'Formal', help: 'Short and correct.', tone: 'formal',
    greeting: 'Good day {{candidate_name}}. This is {{agent_name}}, an automated assistant calling on behalf of {{school_name}} regarding your application for the {{role}} post. Is this a convenient time for a short call?',
    closing: 'Thank you for your time, {{candidate_name}}. The {{school_name}} team will contact you regarding the next step. Goodbye.',
  },
  {
    key: 'quick', label: 'Quick and casual', help: 'Relaxed and brief.', tone: 'friendly',
    greeting: 'Hi {{candidate_name}}! {{agent_name}} here, calling for {{school_name}} about your {{role}} application. Got two minutes for a few quick questions?',
    closing: 'Brilliant, thanks {{candidate_name}}! {{school_name}} will be in touch soon. Bye for now!',
  },
];

/** Rules a school can tick instead of writing them. */
export const RULE_PRESETS: { key: string; label: string; text: string }[] = [
  { key: 'no_salary', label: 'Do not discuss salary', text: 'Do not discuss salary or pay. If asked, say the school team will talk about it in the next step.' },
  { key: 'no_dates', label: 'Do not promise an interview date', text: 'Do not give or promise any interview date or time. Say the school team will share it.' },
  { key: 'short_answers', label: 'Keep every reply very short', text: 'Keep every reply to one or two short sentences.' },
  { key: 'best_time', label: 'Ask the best time to reach them next', text: 'After the questions, ask which day and time is best to reach them next, and note it.' },
];

/** Details most schools want to fill in. One click adds a row. */
export const FACT_SUGGESTIONS = ['School timings', 'Salary range', 'School address', 'Transport', 'Joining date', 'HR contact number'];

const KEY_RE = /^[a-z][a-z0-9_]{1,29}$/;
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const BLANK_RE = /\[\s*([^[\]\n]{1,60}?)\s*\]/g;
const RULE_KEYS = new Set(RULE_PRESETS.map((r) => r.key));

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max) : '';
}

/** A name the school typed, kept readable and free of characters used for blanks. */
function labelText(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[<>{}[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, SCRIPT_LIMITS.var_label) : '';
}

const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/** A name the school typed, turned into a usable key: "Campus address" → "campus_address". */
export function toVariableKey(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'v_$1').slice(0, 30);
}

/** What the school sees as a detail's name. */
export function labelOf(v: Pick<CallVariable, 'key' | 'label'>): string {
  return v.label?.trim() || v.key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** The school's script with anything missing filled in. Never fails; never refuses. */
export function scriptOf(raw: Partial<CallScript> | null | undefined): CallScript {
  const r = raw ?? {};
  const seen = new Set<string>();
  const variables: CallVariable[] = (Array.isArray(r.variables) ? r.variables : [])
    .map((v) => ({ key: String(v?.key ?? '').trim().toLowerCase(), label: labelText(v?.label), value: text(v?.value, SCRIPT_LIMITS.var_value), share: v?.share === false ? false : undefined }))
    .filter((v) => KEY_RE.test(v.key) && !BUILT_IN_KEYS.has(v.key) && v.value && !seen.has(v.key) && (seen.add(v.key), true))
    .slice(0, MAX_CUSTOM_VARIABLES)
    .map((v) => ({ key: v.key, ...(v.label ? { label: v.label } : {}), value: v.value, ...(v.share === false ? { share: false } : {}) }));
  return {
    agent_name: text(r.agent_name, SCRIPT_LIMITS.agent_name) || DEFAULT_SCRIPT.agent_name,
    tone: TONES.some((t) => t.value === r.tone) ? r.tone as CallTone : DEFAULT_SCRIPT.tone,
    // Stored text gets more room than the screen shows: a blank is longer stored ({{candidate_name}}) than some read.
    greeting: text(r.greeting, SCRIPT_LIMITS.greeting * 2) || DEFAULT_SCRIPT.greeting,
    closing: text(r.closing, SCRIPT_LIMITS.closing * 2) || DEFAULT_SCRIPT.closing,
    school_info: text(r.school_info, SCRIPT_LIMITS.school_info * 2),
    instructions: text(r.instructions, SCRIPT_LIMITS.instructions * 2),
    max_minutes: CALL_MINUTE_CHOICES.includes(Number(r.max_minutes)) ? Number(r.max_minutes) : DEFAULT_SCRIPT.max_minutes,
    variables,
    rule_flags: [...new Set((Array.isArray(r.rule_flags) ? r.rule_flags : []).filter((k): k is string => typeof k === 'string' && RULE_KEYS.has(k)))],
  };
}

/** Every blank a text may use with this script, with the name the school sees. */
export function blanksOf(script: Pick<CallScript, 'variables'>): { key: string; label: string; custom: boolean }[] {
  return [
    ...BUILT_IN_VARIABLES.map((v) => ({ key: v.key, label: v.label, custom: false })),
    ...script.variables.map((v) => ({ key: v.key, label: labelOf(v), custom: true })),
  ];
}

/** Every variable name a text may use with this script. */
export function knownKeys(script: Pick<CallScript, 'variables'>): Set<string> {
  return new Set([...BUILT_IN_KEYS, ...script.variables.map((v) => v.key)]);
}

/** Stored text → what the school reads: {{candidate_name}} shows as [Candidate's first name]. */
export function toDisplay(value: string, script: Pick<CallScript, 'variables'>): string {
  const names = new Map(blanksOf(script).map((b) => [b.key, b.label]));
  return value.replace(TOKEN_RE, (whole, k: string) => (names.has(k.toLowerCase()) ? `[${names.get(k.toLowerCase())}]` : whole));
}

/** What the school typed → stored text. A [Name] that is not one of their blanks is left as typed (and flagged). */
export function fromDisplay(value: string, script: Pick<CallScript, 'variables'>): string {
  const keys = new Map(blanksOf(script).map((b) => [norm(b.label), b.key]));
  return value.replace(BLANK_RE, (whole, label: string) => (keys.has(norm(label)) ? `{{${keys.get(norm(label))}}}` : whole));
}

/** The [Names] in a stored text that are not one of the school's blanks. */
export function strayBlanks(value: string): string[] {
  return [...new Set([...value.matchAll(BLANK_RE)].map((m) => m[0]))];
}

/** The {{names}} a text uses that are not defined. */
export function unknownVariables(value: string, known: Set<string>): string[] {
  return [...new Set([...value.matchAll(TOKEN_RE)].map((m) => m[1].toLowerCase()).filter((k) => !known.has(k)))];
}

function prettyKey(k: string): string {
  return k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Checks one piece of text a school wrote: only known blanks, and no stray
 * brackets or braces. Returns an error in plain words, or null.
 */
export function checkTemplate(value: string, known: Set<string>, where: string): string | null {
  const unknown = unknownVariables(value, known);
  if (unknown.length) return `${where} uses [${prettyKey(unknown[0])}], which is not one of your blanks. Add it under “Your school’s details”, or fix the spelling.`;
  const rest = value.replace(TOKEN_RE, '');
  const stray = strayBlanks(rest)[0];
  if (stray) return `${where} has ${stray}, which is not one of your blanks. Pick it from the list, or remove the brackets.`;
  if (/[<>{}[\]]/.test(rest)) return `${where} cannot contain < > { } [ ] on their own.`;
  return null;
}

/** Checks the school's whole script before saving. */
export function parseScript(raw: unknown): { ok: true; script: CallScript } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CallScript>;
  const rawVars = (Array.isArray(r.variables) ? r.variables : [])
    // A detail with a name and no value yet is dropped, not refused: nothing is lost by it.
    .filter((v) => v && (String(v.key ?? '').trim() || labelText(v.label)) && text(v.value, SCRIPT_LIMITS.var_value));
  if (rawVars.length > MAX_CUSTOM_VARIABLES) return { ok: false, error: `Up to ${MAX_CUSTOM_VARIABLES} details of your own.` };
  const builtInNames = new Set(BUILT_IN_VARIABLES.map((v) => norm(v.label)));
  const usedNames = new Set<string>();
  const usedKeys = new Set<string>();
  const prepared: CallVariable[] = [];
  for (const v of rawVars) {
    const label = labelText(v.label);
    const key = String(v.key ?? '').trim().toLowerCase() || toVariableKey(label);
    const name = label || prettyKey(key);
    if (!KEY_RE.test(key)) return { ok: false, error: `“${name}” cannot be used as a name: use letters and numbers, starting with a letter.` };
    if (BUILT_IN_KEYS.has(key) || builtInNames.has(norm(name))) return { ok: false, error: `“${name}” is already filled in for you. Pick another name.` };
    if (usedKeys.has(key) || usedNames.has(norm(name))) return { ok: false, error: `You have two details called “${name}”.` };
    usedKeys.add(key);
    usedNames.add(norm(name));
    if (/[<>{}]/.test(String(v.value ?? ''))) return { ok: false, error: `The value of “${name}” cannot contain < > { or }.` };
    prepared.push({ key, label, value: String(v.value), share: v.share });
  }
  if (/[<>{}[\]]/.test(String(r.agent_name ?? ''))) return { ok: false, error: 'The caller’s name cannot contain < > { } [ ].' };

  const script = scriptOf({ ...r, variables: prepared });
  const known = knownKeys(script);
  const parts: [string, string][] = [
    [script.greeting, 'The opening'], [script.closing, 'The closing'],
    [script.school_info, 'What candidates may be told'], [script.instructions, 'Your extra rules'],
  ];
  for (const [value, where] of parts) {
    const err = checkTemplate(value, known, where);
    if (err) return { ok: false, error: err };
  }
  return { ok: true, script };
}

/** The values for every blank, for one candidate at one school. */
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

/** Fills in the blanks. One that has no value is left out rather than read aloud. */
export function fillTemplate(value: string, values: Record<string, string>): string {
  return value.replace(TOKEN_RE, (_, k: string) => values[k.toLowerCase()] ?? '').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Everything the AI may tell a candidate about the school: the details marked as shareable, then the free text. */
export function schoolFactsText(script: CallScript, values: Record<string, string>): string {
  const facts = script.variables.filter((v) => v.share !== false).map((v) => `${labelOf(v)}: ${v.value}`);
  return [...facts, fillTemplate(script.school_info, values)].filter(Boolean).join('\n');
}

/** The rules the AI follows for this school: the ticked ones, then the school's own words. */
export function rulesText(script: CallScript, values: Record<string, string>): string {
  const ticked = RULE_PRESETS.filter((r) => script.rule_flags?.includes(r.key)).map((r) => r.text);
  return [...ticked, fillTemplate(script.instructions, values)].filter(Boolean).join('\n');
}

/** Seconds to say a text out loud, at a calm phone pace. */
export function speakSeconds(value: string): number {
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 2.4));
}

/** Sample values for the settings preview. */
export function sampleValues(script: CallScript, schoolName: string, sample?: { name?: string; post?: string }): Record<string, string> {
  const values: Record<string, string> = Object.fromEntries(BUILT_IN_VARIABLES.map((v) => [v.key, v.sample]));
  values.school_name = schoolName || values.school_name;
  values.agent_name = script.agent_name;
  const full = (sample?.name || '').trim();
  if (full) { values.candidate_full_name = full; values.candidate_name = full.split(/\s+/)[0]; }
  if (sample?.post?.trim()) { values.role = sample.post.trim(); values.subject = sample.post.trim().split(/\s+/)[0]; }
  for (const v of script.variables) values[v.key] = v.value;
  return values;
}
