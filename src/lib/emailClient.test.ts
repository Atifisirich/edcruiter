import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailIsConfigured, fromHeader, sendEmail } from './emailClient';

describe('fromHeader', () => {
  it('puts the product name in front of a bare address', () => {
    expect(fromHeader('no-reply@edcruiter.com')).toBe('Edcruiter <no-reply@edcruiter.com>');
  });

  it('leaves a value that already has a display name alone', () => {
    expect(fromHeader('Edcruiter Team <hello@edcruiter.com>')).toBe('Edcruiter Team <hello@edcruiter.com>');
  });
});

describe('sending', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is not configured without both settings', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_FROM_EMAIL', '');
    expect(emailIsConfigured()).toBe(false);
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(emailIsConfigured()).toBe(false);
    expect(await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't' })).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('sends through Resend with the named sender and the key as a bearer token', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email_1' }) });
    vi.stubGlobal('fetch', fetchMock);

    const out = await sendEmail({ to: 'teacher@school.edu', subject: 'Hi', html: '<p>x</p>', text: 'x' });

    expect(out).toEqual({ ok: true, id: 'email_1' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test_key');
    expect(JSON.parse(init.body)).toMatchObject({ from: 'Edcruiter <no-reply@edcruiter.com>', to: 'teacher@school.edu', subject: 'Hi' });
  });

  it('reports a refusal from Resend instead of pretending it was sent', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'The edcruiter.com domain is not verified.' }) }));

    const out = await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't' });
    expect(out).toEqual({ ok: false, reason: 'send_failed', detail: 'The edcruiter.com domain is not verified.' });
  });
});
