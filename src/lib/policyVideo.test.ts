import fs from 'fs';
import { afterAll, describe, expect, it } from 'vitest';
import {
  asksPolicyQuestions, chunkCount, chunkFilename, expectedChunkBytes, parsePolicyAnswers, parsePolicyQuestions,
  parseRange, piecesFor, policyAnswersText, policyQuestionsOf, STARTER_POLICY_QUESTIONS, videoMime,
} from './policyVideo';
import { streamVideoBytes } from './policyVideoStore';
import { ensureUploadsDir, safeUploadPath } from './uploads';
import type { PolicyVideo } from './types';

describe('policy video pieces', () => {
  it('splits a video into 8 MB pieces, the last one shorter', () => {
    const MB = 1024 * 1024;
    expect(chunkCount(20 * MB)).toBe(3);
    expect(chunkCount(16 * MB)).toBe(2);
    expect(expectedChunkBytes(20 * MB, 0)).toBe(8 * MB);
    expect(expectedChunkBytes(20 * MB, 2)).toBe(4 * MB);
    expect(expectedChunkBytes(20 * MB, 3)).toBe(0);
  });

  it('accepts only real video types, ignoring codec details', () => {
    expect(videoMime('video/mp4')).toBe('video/mp4');
    expect(videoMime('video/webm;codecs=vp9')).toBe('video/webm');
    expect(videoMime('text/html')).toBeNull();
    expect(videoMime(undefined)).toBeNull();
  });

  it('reads the browser\'s byte ranges', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=100-', 100)).toBe('unsatisfiable');
    expect(parseRange('items=0-1', 100)).toBeNull();
  });

  it('maps a byte range onto the pieces that hold it', () => {
    expect(piecesFor(0, 9, 10)).toEqual([{ index: 0, from: 0, to: 9 }]);
    expect(piecesFor(5, 24, 10)).toEqual([
      { index: 0, from: 5, to: 9 },
      { index: 1, from: 0, to: 9 },
      { index: 2, from: 0, to: 4 },
    ]);
  });
});

describe('playing a video back from its pieces', () => {
  const id = `test${Date.now()}`;
  const whole = Buffer.from(Array.from({ length: 25 }, (_, i) => i));
  const video: PolicyVideo = { id, title: 't', mime: 'video/mp4', size: 25, chunk_size: 10, chunks: 3, uploaded_at: '', uploaded_by: '' };
  ensureUploadsDir();
  for (let i = 0; i < 3; i++) fs.writeFileSync(safeUploadPath(chunkFilename(id, i))!, whole.subarray(i * 10, i * 10 + 10));
  afterAll(() => { for (let i = 0; i < 3; i++) fs.rmSync(safeUploadPath(chunkFilename(id, i))!, { force: true }); });

  const read = async (start: number, end: number) => {
    const reader = streamVideoBytes(video, start, end).getReader();
    const parts: number[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(...value);
    }
    return parts;
  };

  it('returns exactly the bytes asked for, across pieces', async () => {
    expect(await read(0, 24)).toEqual([...whole]);
    expect(await read(7, 13)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(await read(20, 24)).toEqual([20, 21, 22, 23, 24]);
  });
});

describe('policy questions', () => {
  it('start from the starter set, and are asked only once there is a video or the school\'s own questions', () => {
    expect(policyQuestionsOf(undefined)).toBe(STARTER_POLICY_QUESTIONS);
    expect(asksPolicyQuestions({})).toBe(false);
    expect(asksPolicyQuestions({ policy_video: { id: 'v' } as PolicyVideo })).toBe(true);
    expect(asksPolicyQuestions({ policy_questions: [{ id: 'a', text: 'Do you agree to this?' }] })).toBe(true);
  });

  it('check the school\'s list before saving', () => {
    const ok = parsePolicyQuestions([{ id: 'pq_hours', text: '  Do you agree   to the hours? ' }, { text: 'Do you agree to the notice period?' }], () => 'pq_new');
    expect(ok).toEqual({ ok: true, questions: [{ id: 'pq_hours', text: 'Do you agree to the hours?' }, { id: 'pq_new', text: 'Do you agree to the notice period?' }] });
    expect(parsePolicyQuestions([]).ok).toBe(false);
    expect(parsePolicyQuestions([{ text: 'short' }]).ok).toBe(false);
    expect(parsePolicyQuestions([{ text: 'Do you agree to <script>?' }]).ok).toBe(false);
  });
});

describe('candidate answers', () => {
  const questions = [{ id: 'q1', text: 'Do you agree to the hours?' }, { id: 'q2', text: 'Do you agree to the notice period?' }];

  it('need an answer to every question, take the wording from the school, and keep a reason only for "don\'t agree"', () => {
    const out = parsePolicyAnswers(questions, {
      q1: { agreed: true, reason: 'ignored' },
      q2: { agreed: false, reason: '  Too long  ' },
      q9: { agreed: true },
    });
    expect(out).toEqual({
      ok: true,
      answers: [
        { question_id: 'q1', question: 'Do you agree to the hours?', agreed: true },
        { question_id: 'q2', question: 'Do you agree to the notice period?', agreed: false, reason: 'Too long' },
      ],
    });
    expect(parsePolicyAnswers(questions, { q1: { agreed: true } })).toMatchObject({ ok: false, error: expect.stringMatching(/1 still needs/) });
    expect(parsePolicyAnswers(questions, { q1: { agreed: 'yes' }, q2: { agreed: true } }).ok).toBe(false);
  });

  it('write a plain summary for the report', () => {
    const text = policyAnswersText(
      [{ question_id: 'q1', question: 'Hours?', agreed: true }, { question_id: 'q2', question: 'Notice?', agreed: false, reason: 'Too long' }],
      { title: 'Our policies', watched_to_end: true }
    );
    expect(text).toContain('Policy video "Our policies": watched to the end');
    expect(text).toContain('agreed with 1 of 2, did NOT agree with 1');
    expect(text).toContain('Notice? DO NOT AGREE (reason: Too long)');
  });
});
