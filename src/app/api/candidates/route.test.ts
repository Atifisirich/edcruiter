import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const setConsent = vi.fn();
const createCandidate = vi.fn();
let school: Record<string, unknown> | undefined;
vi.mock('@/lib/db', () => ({
  db: {
    createCandidate: (...a: unknown[]) => createCandidate(...a),
    setConsent: (...a: unknown[]) => setConsent(...a),
    addAuditLog: () => undefined,
    getSchoolById: () => school,
  },
}));

let staff: { user: { id: string; name: string; branch_id?: string } } | null = null;
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    getStaffContext: async () => staff,
    resolveSchoolId: () => 's1',
    assertSchoolActive: () => undefined,
    auditAsStaff: () => undefined,
  };
});
vi.mock('@/lib/ensurePack', () => ({ warmPack: async () => undefined }));
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock('@/lib/session', () => ({ CANDIDATE_COOKIE: 'c', createCandidateToken: () => 'tok' }));

const sendAssessmentInvite = vi.fn();
vi.mock('@/lib/assessmentInvite', () => ({
  sendAssessmentInvite: (...a: unknown[]) => sendAssessmentInvite(...a),
  sendApplicationLinks: async () => undefined,
}));
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...actual, after: () => undefined };
});

import { POST } from './route';

const connected = { id: 's1', name: 'Green Valley', whatsapp_hiring: { status: 'connected' } };
const lead = { school_id: 's1', name: 'Priya', email: 'p@x.in', phone: '+91 98765 43210', applied_subject: 'Biology', applied_segment: 'Secondary' };

const post = (body: object) =>
  POST(new NextRequest('http://localhost/api/candidates', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  school = connected;
  staff = { user: { id: 'u1', name: 'Admin' } };
  sendAssessmentInvite.mockResolvedValue({ ok: true, waMessageId: 'wamid.1' });
});

describe('a school adding a lead by hand', () => {
  it('records the school\'s permission and sends the approved invite straight away', async () => {
    const res = await post({ ...lead, school_attested: true, send_invite: true });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(setConsent).toHaveBeenCalledWith(expect.objectContaining({ granted: true, source: 'school_attested', wording_version: 'staff-add-v1' }));
    expect(sendAssessmentInvite).toHaveBeenCalledTimes(1);
    expect(body.invite).toEqual({ sent: true });
  });

  it('adds the candidate but sends nothing when the school did not confirm permission', async () => {
    const res = await post({ ...lead, send_invite: true });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(setConsent).toHaveBeenCalledWith(expect.objectContaining({ granted: false }));
    expect(sendAssessmentInvite).not.toHaveBeenCalled();
    expect(body.invite).toEqual({ sent: false, reason: 'no_consent' });
  });

  it('says so when the WhatsApp number is not connected', async () => {
    school = { id: 's1', name: 'Green Valley', whatsapp_hiring: { status: 'not_connected' } };
    const body = await (await post({ ...lead, school_attested: true, send_invite: true })).json();
    expect(sendAssessmentInvite).not.toHaveBeenCalled();
    expect(body.invite).toEqual({ sent: false, reason: 'not_connected' });
  });

  it('says so when there is no phone number', async () => {
    const body = await (await post({ ...lead, phone: '', school_attested: true, send_invite: true })).json();
    expect(sendAssessmentInvite).not.toHaveBeenCalled();
    expect(body.invite).toEqual({ sent: false, reason: 'no_phone' });
  });

  it('keeps the candidate and reports why when WhatsApp refuses the send', async () => {
    sendAssessmentInvite.mockResolvedValue({ ok: false, reason: 'rate_limited', detail: 'daily cap' });
    const res = await post({ ...lead, school_attested: true, send_invite: true });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.candidate.name).toBe('Priya');
    expect(body.invite).toMatchObject({ sent: false, reason: 'rate_limited' });
  });

  it('does not touch WhatsApp when no invite was asked for', async () => {
    const body = await (await post({ ...lead, school_attested: true })).json();
    expect(sendAssessmentInvite).not.toHaveBeenCalled();
    expect(body.invite).toBeUndefined();
    expect(setConsent).toHaveBeenCalledWith(expect.objectContaining({ granted: true, source: 'school_attested' }));
  });
});

describe('a teacher applying on the job board', () => {
  it('never gets an automatic school invite, and keeps their own consent choice', async () => {
    staff = null;
    const res = await post({ ...lead, school_attested: true, send_invite: true, whatsapp_consent: false });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(sendAssessmentInvite).not.toHaveBeenCalled();
    expect(body.invite).toBeUndefined();
    expect(setConsent).toHaveBeenCalledWith(expect.objectContaining({ granted: false, source: 'apply_form' }));
  });
});
