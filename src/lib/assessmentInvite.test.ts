import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateCandidate = vi.fn();
vi.mock('./db', () => ({ db: { updateCandidate: (...a: unknown[]) => updateCandidate(...a) } }));
const sendTemplateMessage = vi.fn();
vi.mock('./whatsappClient', () => ({ sendTemplateMessage: (...a: unknown[]) => sendTemplateMessage(...a) }));

const sendEmail = vi.fn();
vi.mock('./emailClient', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { sendAssessmentInvite, sendInviteEmail, signInLinkFor, INVITE_LINK_VALIDITY_SEC } from './assessmentInvite';
import { readCandidateToken } from './session';
import type { Candidate, School } from './types';

const school = { id: 's1', name: 'Green Valley School', primary_contact: { name: 'Principal', email: 'principal@gvs.edu', phone: '' } } as School;
const candidate = {
  id: 'c1', school_id: 's1', name: 'Priya', phone: '9876543210', email: 'priya@example.com',
  applied_subject: 'Biology', invite_code: 'EDC-BIOL-1A2B',
} as Candidate;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = 'test-secret-for-invite-tests-1234567890';
  sendTemplateMessage.mockResolvedValue({ ok: true, waMessageId: 'wamid.1' });
});

describe('sendAssessmentInvite', () => {
  it('fills the approved template in order: name, school, subject, application ID', async () => {
    await sendAssessmentInvite(school, candidate);
    const call = sendTemplateMessage.mock.calls[0][0];
    expect(call.template).toBe('assessment_invite');
    expect(call.bodyParams).toEqual(['Priya', 'Green Valley School', 'Biology', 'EDC-BIOL-1A2B']);
    expect(call.toRaw).toBe('9876543210');
    expect(call.candidateId).toBe('c1');
  });

  it('gives the button a sign-in token for this candidate that lasts about a week', async () => {
    await sendAssessmentInvite(school, candidate);
    const token = sendTemplateMessage.mock.calls[0][0].buttonParam as string;
    const session = readCandidateToken(token);
    expect(session?.cid).toBe('c1');
    expect(session?.school_id).toBe('s1');
    const remaining = (session!.exp as number) - Math.floor(Date.now() / 1000);
    expect(remaining).toBeGreaterThan(INVITE_LINK_VALIDITY_SEC - 60);
    expect(remaining).toBeLessThanOrEqual(INVITE_LINK_VALIDITY_SEC);
  });

  it('records when it was sent, but only if it really went out', async () => {
    await sendAssessmentInvite(school, candidate);
    expect(updateCandidate).toHaveBeenCalledWith('s1', 'c1', expect.objectContaining({ whatsapp_invite_sent_at: expect.any(String) }));

    updateCandidate.mockClear();
    sendTemplateMessage.mockResolvedValue({ ok: false, reason: 'no_consent' });
    await sendAssessmentInvite(school, candidate);
    expect(updateCandidate).not.toHaveBeenCalled();
  });

  it('makes one saveable link that signs this candidate in for a week', () => {
    const url = new URL(signInLinkFor(candidate));
    expect(url.pathname).toBe('/api/candidates/magic-login');
    const session = readCandidateToken(url.searchParams.get('token') || undefined);
    expect(session?.cid).toBe('c1');
    expect(session?.school_id).toBe('s1');
  });

  it('emails the sign-in link as an interview email, in the school\'s name, with replies going to the school', async () => {
    sendEmail.mockResolvedValue({ ok: true, id: 'e1' });
    expect(await sendInviteEmail(school, candidate)).toBe(true);
    const call = sendEmail.mock.calls[0][0];
    expect(call).toMatchObject({ to: 'priya@example.com', kind: 'interview', fromName: 'Green Valley School', replyTo: 'principal@gvs.edu' });
    expect(call.text).toContain('/api/candidates/magic-login?token=');
  });

  it('does not email a lead that has no real address', async () => {
    expect(await sendInviteEmail(school, { ...candidate, email: 'priya@lead.local' } as Candidate)).toBe(false);
    expect(await sendInviteEmail(school, { ...candidate, email: '' } as Candidate)).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('falls back to the candidate id when no invite code was generated', async () => {
    await sendAssessmentInvite(school, { ...candidate, invite_code: undefined } as Candidate);
    expect(sendTemplateMessage.mock.calls[0][0].bodyParams[3]).toBe('c1');
  });
});
