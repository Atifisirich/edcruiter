import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Cand = Record<string, unknown>;
let candidate: Cand;
const updateCandidate = vi.fn((_s: string, _id: string, patch: Cand) => { Object.assign(candidate, patch); return candidate; });
vi.mock('@/lib/db', () => ({
  db: {
    getCandidateById: () => candidate,
    getSchoolById: () => ({ id: 's1', name: 'Green Valley' }),
    updateCandidate: (...a: [string, string, Cand]) => updateCandidate(...a),
  },
}));

let who: { kind: 'candidate' } | { kind: 'staff'; role: string } = { kind: 'candidate' };
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    assertSchoolActive: () => undefined,
    auditAsStaff: () => undefined,
    requireCandidateOrStaff: async () =>
      who.kind === 'candidate'
        ? { kind: 'candidate', schoolId: 's1' }
        : { kind: 'staff', schoolId: 's1', ctx: { role: who.role, user: { id: 'u1', name: 'Staff' } } },
  };
});

let runtime: ReturnType<typeof import('@/lib/aiInterview').interviewRuntime> = null;
const fetchSarvamTranscript = vi.fn();
const analyseInterview = vi.fn(async () => ({ summary: 'ok', recommendation: 'good', overall: 70, scored: true, topics: [], strengths: [], concerns: [], flags: [], followups: [] }));
vi.mock('@/lib/aiInterview', async () => {
  const actual = await vi.importActual<typeof import('@/lib/aiInterview')>('@/lib/aiInterview');
  return {
    ...actual,
    interviewRuntime: () => runtime,
    fetchSarvamTranscript: (...a: unknown[]) => fetchSarvamTranscript(...a),
    analyseInterview: (...a: unknown[]) => (analyseInterview as unknown as (...x: unknown[]) => unknown)(...a),
  };
});

import { GET, POST } from './route';

const post = (body: object) => POST(new NextRequest('http://localhost/api/voice-interview', { method: 'POST', body: JSON.stringify({ candidate_id: 'c1', ...body }) }));
const get = () => GET(new NextRequest('http://localhost/api/voice-interview?candidate_id=c1'));

beforeEach(() => {
  vi.clearAllMocks();
  candidate = { id: 'c1', school_id: 's1', name: 'Asha Rao', applied_subject: 'Chemistry', applied_segment: 'Secondary (Grades 9 and 10)' };
  who = { kind: 'candidate' };
  runtime = { apiKey: 'k', orgId: 'o', workspaceId: 'w', appId: 'a' };
});

describe('inviting', () => {
  it('lets HR and the admin invite, and not a reviewer or the candidate', async () => {
    who = { kind: 'staff', role: 'HR' };
    expect((await post({ action: 'invite' })).status).toBe(200);
    expect((candidate.ai_interview as { status: string }).status).toBe('invited');
    who = { kind: 'staff', role: 'REPORTING_MANAGER' };
    expect((await post({ action: 'invite' })).status).toBe(403);
    who = { kind: 'candidate' };
    expect((await post({ action: 'invite' })).status).toBe(403);
  });
  it('does not start a second invitation while one is open', async () => {
    who = { kind: 'staff', role: 'SCHOOL_ADMIN' };
    await post({ action: 'invite' });
    const first = (candidate.ai_interview as { id: string }).id;
    await post({ action: 'invite' });
    expect((candidate.ai_interview as { id: string }).id).toBe(first);
  });
});

describe('starting', () => {
  it('turns a candidate away who was never invited', async () => {
    expect((await post({ action: 'start' })).status).toBe(403);
  });
  it('turns a candidate away who has already done it', async () => {
    candidate.ai_interview = { id: 'i1', status: 'completed' };
    expect((await post({ action: 'start' })).status).toBe(403);
  });
  it('says it is not switched on when the agent is not set up', async () => {
    runtime = null;
    who = { kind: 'staff', role: 'HR' };
    expect((await post({ action: 'start' })).status).toBe(503);
  });
  it('gives an invited candidate the session details, with the plan as variables and no API key', async () => {
    candidate.ai_interview = { id: 'old', status: 'invited', invited_at: 'x' };
    const res = await post({ action: 'start', language: 'Telugu' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runtime).toEqual({ org_id: 'o', workspace_id: 'w', app_id: 'a' });
    expect(JSON.stringify(body)).not.toContain('"k"');
    expect(body.variables.language).toBe('Telugu');
    expect(body.variables.candidate_name).toBe('Asha Rao');
    expect((candidate.ai_interview as { status: string }).status).toBe('in_progress');
  });
  it('lets staff run a demo any time, marked as a demo', async () => {
    who = { kind: 'staff', role: 'HR' };
    expect((await post({ action: 'start' })).status).toBe(200);
    expect((candidate.ai_interview as { by_staff?: boolean }).by_staff).toBe(true);
  });
  it('ignores a language it does not offer', async () => {
    candidate.ai_interview = { id: 'old', status: 'invited' };
    const body = await (await post({ action: 'start', language: 'Klingon' })).json();
    expect(body.variables.language).toBe('English');
  });
});

describe('finishing', () => {
  const started = () => { candidate.ai_interview = { id: 'i1', status: 'in_progress', language: 'English', plan: [], transcript: [] }; };
  it('keeps the transcript Sarvam holds, not the browser\'s', async () => {
    started();
    fetchSarvamTranscript.mockResolvedValue({ turns: [{ role: 'agent', text: 'Real question' }, { role: 'user', text: 'Real answer' }] });
    const res = await post({ action: 'finish', interview_id: 'i1', duration_sec: 600, transcript: [{ role: 'user', content: 'forged answer' }] });
    expect(res.status).toBe(200);
    const saved = candidate.ai_interview as { transcript: { text: string }[]; transcript_source: string; status: string };
    expect(saved.transcript_source).toBe('sarvam');
    expect(saved.transcript.map((t) => t.text)).toEqual(['Real question', 'Real answer']);
    expect(saved.status).toBe('completed');
  });
  it('falls back to the browser transcript, marked as unchecked', async () => {
    started();
    fetchSarvamTranscript.mockResolvedValue(null);
    vi.useFakeTimers();
    const pending = post({ action: 'finish', interview_id: 'i1', duration_sec: 400, transcript: [{ role: 'user', content: 'hello there' }] });
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect((candidate.ai_interview as { transcript_source: string }).transcript_source).toBe('browser');
  });
  it('marks an interview with nothing said as abandoned', async () => {
    started();
    await post({ action: 'finish', interview_id: 'i1', duration_sec: 2, transcript: [] });
    expect((candidate.ai_interview as { status: string }).status).toBe('abandoned');
  });
  it('refuses an interview that is not the current one', async () => {
    started();
    expect((await post({ action: 'finish', interview_id: 'other', duration_sec: 60 })).status).toBe(409);
  });
});

describe('what each person can read', () => {
  beforeEach(() => {
    candidate.ai_interview = { id: 'i1', status: 'completed', language: 'English', report: { summary: 'secret' }, transcript: [{ role: 'user', text: 'x' }] };
  });
  it('gives a candidate only where it stands', async () => {
    const body = await (await get()).json();
    expect(body.viewer).toBe('candidate');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body.interview).toEqual({ id: 'i1', status: 'completed', language: 'English' });
  });
  it('gives staff the whole report', async () => {
    who = { kind: 'staff', role: 'HR' };
    const body = await (await get()).json();
    expect(body.viewer).toBe('staff');
    expect(body.interview.report.summary).toBe('secret');
  });
});

describe('a sample report', () => {
  it('is made from a made-up conversation and labelled a sample', async () => {
    who = { kind: 'staff', role: 'HR' };
    expect((await post({ action: 'sample' })).status).toBe(200);
    const saved = candidate.ai_interview as { mode: string; transcript_source: string; transcript: unknown[] };
    expect(saved.mode).toBe('sample');
    expect(saved.transcript_source).toBe('sample');
    expect(saved.transcript.length).toBeGreaterThan(10);
  });
  it('is not open to a candidate', async () => {
    expect((await post({ action: 'sample' })).status).toBe(403);
  });
});
