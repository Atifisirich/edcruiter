import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireCandidateOrStaff = vi.fn();
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, requireCandidateOrStaff: (...a: unknown[]) => requireCandidateOrStaff(...a) };
});

const profile = { candidate_id: 'c1', school_id: 's1', status: 'ready', overall: { score: 70 }, factors: [], relevancy: [], measured: {}, observations: {}, strengths: [], improvements: [], summary: '', generated_at: '2026-10-31T06:00:00.000Z', version: 1 };
vi.mock('@/lib/db', () => ({
  db: {
    getSchoolById: () => ({ id: 's1', name: 'Green Valley', shortlist_bands: null, report_settings: undefined }),
    getTeachingProfile: () => profile,
    getCandidateById: () => ({ id: 'c1', school_id: 's1', name: 'Priya', email: 'p@x.in', phone: '9', applied_subject: 'Biology', applied_segment: 'Secondary' }),
  },
}));

import { GET as getProfile, POST as postProfile } from './route';
import { GET as getReport } from '../report/route';

const params = { params: Promise.resolve({ id: 'c1' }) };
const req = (method = 'GET') => new NextRequest('http://localhost/api/candidates/c1/profile', { method });

beforeEach(() => vi.clearAllMocks());

describe('the teaching profile is for the school, never the candidate', () => {
  it('refuses a candidate session on every route', async () => {
    requireCandidateOrStaff.mockResolvedValue({ kind: 'candidate', schoolId: 's1' });
    expect((await getProfile(req(), params)).status).toBe(403);
    expect((await postProfile(req('POST'), params)).status).toBe(403);
    expect((await getReport(req(), params)).status).toBe(403);
  });

  it('refuses someone who is not signed in', async () => {
    const { AuthError } = await import('@/lib/auth');
    requireCandidateOrStaff.mockRejectedValue(new AuthError('Sign in to continue.', 401));
    expect((await getProfile(req(), params)).status).toBe(401);
    expect((await getReport(req(), params)).status).toBe(401);
  });

  it('gives school staff the profile and the PDF', async () => {
    requireCandidateOrStaff.mockResolvedValue({ kind: 'staff', schoolId: 's1', ctx: { user: { id: 'u1', name: 'Admin', email: 'a@x.in' }, role: 'SCHOOL_ADMIN', isSuperAdmin: false, schoolId: 's1' } });

    const res = await getProfile(req(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.status).toBe('ready');
    expect(body.settings).toEqual({ delivery: true, appearance: false });

    const pdf = await getReport(req(), params);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.headers.get('content-disposition')).toContain('Teaching-report-Priya.pdf');
    expect(pdf.headers.get('cache-control')).toContain('no-store');
  });
});
