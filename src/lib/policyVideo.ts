/**
 * The school's policy video and the "Do you agree…?" questions after it
 * (stage 5). Pure: no database, no files. The routes that store the video,
 * play it back and save the answers use these.
 *
 * Why the video is kept in pieces: the live server refuses a single request
 * larger than about 30 MB, and a few-minute animated video is often hundreds.
 * So the browser sends it in 8 MB pieces, each saved as its own file, and
 * playback reads the right bytes back out of those pieces. Nothing outside
 * the app (no cloud bucket settings) has to change, and any size works.
 */

import type { PolicyAnswer, PolicyQuestion, School } from './types';

export const VIDEO_CHUNK_BYTES = 8 * 1024 * 1024;
/** 2 GB: far more than any policy video needs; a guard against filling the disk by mistake. */
export const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_POLICY_QUESTIONS = 20;
export const MAX_REASON_CHARS = 500;

export const VIDEO_MIME_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** The video type from what the browser reports, without codec details, or null when it is not a supported video. */
export function videoMime(type: string | undefined): string | null {
  const base = (type || '').split(';')[0].trim().toLowerCase();
  return VIDEO_MIME_EXT[base] ? base : null;
}

export function chunkCount(size: number, chunkSize = VIDEO_CHUNK_BYTES): number {
  return Math.max(1, Math.ceil(size / chunkSize));
}

/** How many bytes piece `index` must hold. */
export function expectedChunkBytes(size: number, index: number, chunkSize = VIDEO_CHUNK_BYTES): number {
  const start = index * chunkSize;
  return Math.max(0, Math.min(chunkSize, size - start));
}

/** The file one piece is kept in. Ids are server-made, so this never takes user input. */
export function chunkFilename(videoId: string, index: number): string {
  return `pv_${videoId}_${index}.part`;
}

/**
 * Reads a browser's Range header ("bytes=1000-", "bytes=0-499", "bytes=-500")
 * against a file of `size` bytes. Returns the inclusive byte range, null for no
 * usable Range (send it all), or 'unsatisfiable'.
 */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'unsatisfiable' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

/** Which piece files, and which bytes in each, make up bytes start..end (inclusive). */
export function piecesFor(start: number, end: number, chunkSize = VIDEO_CHUNK_BYTES): { index: number; from: number; to: number }[] {
  const out: { index: number; from: number; to: number }[] = [];
  for (let pos = start; pos <= end; ) {
    const index = Math.floor(pos / chunkSize);
    const from = pos - index * chunkSize;
    const to = Math.min(chunkSize - 1, end - index * chunkSize);
    out.push({ index, from, to });
    pos = index * chunkSize + to + 1;
  }
  return out;
}

// --- The questions after the video -----------------------------------------

/** Where every school starts. They edit, add or delete these on the Policies page. */
export const STARTER_POLICY_QUESTIONS: PolicyQuestion[] = [
  { id: 'pq_hours', text: 'Do you agree to the school’s working hours, as explained in the video?' },
  { id: 'pq_notice', text: 'Do you agree to the notice period you must give before leaving the school?' },
  { id: 'pq_probation', text: 'Do you agree to the probation period and how your work will be reviewed during it?' },
  { id: 'pq_leave', text: 'Do you agree to the school’s leave rules?' },
  { id: 'pq_conduct', text: 'Do you agree to the dress code and the staff code of conduct?' },
  { id: 'pq_safeguarding', text: 'Do you agree to follow the school’s child safety (safeguarding) rules at all times?' },
  { id: 'pq_verification', text: 'Do you agree to a background and police verification check before joining?' },
];

/** The school's questions: its own once it has saved some, the starter set until then. */
export function policyQuestionsOf(school: Pick<School, 'policy_questions'> | null | undefined): PolicyQuestion[] {
  return school?.policy_questions?.length ? school.policy_questions : STARTER_POLICY_QUESTIONS;
}

/**
 * Whether candidates are asked the questions: when the school has a video, or
 * has written its own questions. A school that has done neither keeps the
 * stage as it was, since the starter questions talk about "the video".
 */
export function asksPolicyQuestions(school: Pick<School, 'policy_video' | 'policy_questions'> | null | undefined): boolean {
  return !!school?.policy_video || !!school?.policy_questions?.length;
}

/** Checks the school's edited list before it is saved. */
export function parsePolicyQuestions(
  input: unknown,
  newId: () => string = () => `pq_${Math.random().toString(36).slice(2, 8)}`
): { ok: true; questions: PolicyQuestion[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Add at least one question.' };
  if (input.length > MAX_POLICY_QUESTIONS) return { ok: false, error: `Up to ${MAX_POLICY_QUESTIONS} questions.` };
  const out: PolicyQuestion[] = [];
  const ids = new Set<string>();
  for (const raw of input as Record<string, unknown>[]) {
    const text = typeof raw?.text === 'string' ? raw.text.replace(/\s+/g, ' ').trim() : '';
    if (text.length < 8 || text.length > 300) return { ok: false, error: 'Each question needs 8 to 300 characters.' };
    if (/[<>]/.test(text)) return { ok: false, error: 'Questions cannot contain < or >.' };
    let id = typeof raw?.id === 'string' && /^[A-Za-z0-9_]{1,40}$/.test(raw.id) ? raw.id : newId();
    if (ids.has(id)) id = newId();
    ids.add(id);
    out.push({ id, text });
  }
  return { ok: true, questions: out };
}

/**
 * Checks a candidate's answers against the school's questions as they are now.
 * Every question needs an answer; a "don't agree" may carry a short reason.
 * The question wording is taken from the school, never from the browser.
 */
export function parsePolicyAnswers(
  questions: PolicyQuestion[],
  input: unknown
): { ok: true; answers: PolicyAnswer[] } | { ok: false; error: string } {
  const given = (input && typeof input === 'object' ? input : {}) as Record<string, { agreed?: unknown; reason?: unknown } | undefined>;
  const answers: PolicyAnswer[] = [];
  let missing = 0;
  for (const q of questions) {
    const a = given[q.id];
    if (!a || typeof a.agreed !== 'boolean') { missing++; continue; }
    const reason = !a.agreed && typeof a.reason === 'string' ? a.reason.replace(/\s+/g, ' ').trim().slice(0, MAX_REASON_CHARS) : '';
    answers.push({ question_id: q.id, question: q.text, agreed: a.agreed, ...(reason ? { reason } : {}) });
  }
  if (missing > 0) return { ok: false, error: `Please answer every policy question. ${missing} still ${missing === 1 ? 'needs' : 'need'} an answer.` };
  return { ok: true, answers };
}

/** The answers as plain lines, for the written record the report and AI profile read. */
export function policyAnswersText(answers: PolicyAnswer[], video?: { title: string; watched_to_end: boolean }): string {
  const lines: string[] = [];
  if (video) lines.push(`Policy video "${video.title}": ${video.watched_to_end ? 'watched to the end' : 'NOT watched to the end'}`);
  const no = answers.filter((a) => !a.agreed).length;
  lines.push(`Policy questions: agreed with ${answers.length - no} of ${answers.length}${no ? `, did NOT agree with ${no}` : ''}`);
  for (const a of answers) {
    lines.push(`- ${a.question} ${a.agreed ? 'AGREE' : `DO NOT AGREE${a.reason ? ` (reason: ${a.reason})` : ''}`}`);
  }
  return lines.join('\n');
}
