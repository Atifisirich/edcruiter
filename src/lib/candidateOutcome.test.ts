import { beforeEach, describe, expect, it, vi } from 'vitest';

const store: { candidate: Record<string, unknown> | undefined; school: Record<string, unknown> | undefined } = {
  candidate: undefined,
  school: undefined,
};
const updateCandidate = vi.fn((_schoolId: string, _id: string, updates: Record<string, unknown>) => {
  store.candidate = { ...store.candidate, ...updates };
  return store.candidate;
});

vi.mock('./db', () => ({
  db: {
    getCandidateById: () => store.candidate,
    getSchoolById: () => store.school,
    updateCandidate: (...args: [string, string, Record<string, unknown>]) => updateCandidate(...args),
  },
}));
const sendTemplateMessage = vi.fn();
vi.mock('./whatsappClient', () => ({ sendTemplateMessage: (...a: unknown[]) => sendTemplateMessage(...a) }));
const sendEmail = vi.fn();
vi.mock('./emailClient', () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));

import { notifyCandidateDeclined } from './candidateOutcome';

const connectedSchool = { id: 's1', name: 'Green Valley School', whatsapp_hiring: { status: 'live' } };

beforeEach(() => {
  vi.clearAllMocks();
  store.candidate = { id: 'c1', school_id: 's1', name: 'Priya', phone: '9876543210', email: 'priya@example.com', applied_subject: 'Biology' };
  store.school = connectedSchool;
  sendTemplateMessage.mockResolvedValue({ ok: true, waMessageId: 'wamid.1' });
  sendEmail.mockResolvedValue({ ok: true, id: 'e1' });
});

describe('notifyCandidateDeclined', () => {
  it('sends on WhatsApp and email with name, school and subject, then marks the candidate notified', async () => {
    const result = await notifyCandidateDeclined('s1', 'c1');
    expect(result).toEqual({ whatsapp: true, email: true });
    expect(sendTemplateMessage).toHaveBeenCalledWith(expect.objectContaining({
      template: 'application_outcome',
      bodyParams: ['Priya', 'Green Valley School', 'Biology'],
    }));
    expect(store.candidate?.outcome_notified_at).toBeTruthy();
  });

  it('never messages the same candidate twice', async () => {
    store.candidate = { ...store.candidate, outcome_notified_at: '2026-10-01T00:00:00Z' };
    const result = await notifyCandidateDeclined('s1', 'c1');
    expect(result.skipped).toBe('already_notified');
    expect(sendTemplateMessage).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips the placeholder .local email that lead imports get', async () => {
    store.candidate = { ...store.candidate, email: 'lead.9876543210@school.local' };
    await notifyCandidateDeclined('s1', 'c1');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('skips WhatsApp when the school has no connected number', async () => {
    store.school = { ...connectedSchool, whatsapp_hiring: { status: 'not_connected' } };
    const result = await notifyCandidateDeclined('s1', 'c1');
    expect(sendTemplateMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ whatsapp: false, email: true });
  });

  it('does not mark the candidate notified when nothing was actually delivered', async () => {
    sendTemplateMessage.mockResolvedValue({ ok: false, reason: 'no_consent' });
    sendEmail.mockResolvedValue({ ok: false, reason: 'not_configured' });
    const result = await notifyCandidateDeclined('s1', 'c1');
    expect(result).toEqual({ whatsapp: false, email: false });
    expect(updateCandidate).not.toHaveBeenCalled();
  });
});
