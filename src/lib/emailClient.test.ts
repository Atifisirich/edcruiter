import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emailIsConfigured, fromHeader, sendEmail } from './emailClient';

describe('fromHeader', () => {
  it('puts a name in front of a bare address', () => {
    expect(fromHeader('no-reply@edcruiter.com')).toBe('Edcruiter <no-reply@edcruiter.com>');
    expect(fromHeader('interviews@edcruiter.com', 'Green Valley School via Edcruiter')).toBe('Green Valley School via Edcruiter <interviews@edcruiter.com>');
  });

  it('quotes a name with punctuation, such as an apostrophe or a full stop', () => {
    expect(fromHeader('i@edcruiter.com', "St. Mary's School via Edcruiter")).toBe('"St. Mary\'s School via Edcruiter" <i@edcruiter.com>');
  });

  it('cannot be used to break out of the header or add a second one', () => {
    const header = fromHeader('i@edcruiter.com', 'Evil" <x@evil.com>\r\nBcc: victim@x.com');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header.match(/</g)).toHaveLength(1);
    expect(header.endsWith('<i@edcruiter.com>')).toBe(true);
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

  function stubResend() {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email_1' }) });
    vi.stubGlobal('fetch', fetchMock);
    return () => {
      const [url, init] = fetchMock.mock.calls[0];
      return { url, headers: init.headers, body: JSON.parse(init.body) };
    };
  }

  it('is not configured without both settings', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('RESEND_FROM_EMAIL', '');
    expect(emailIsConfigured()).toBe(false);
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(emailIsConfigured()).toBe(false);
    expect(await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't' })).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('sends an account email from the account address, as Edcruiter', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    vi.stubEnv('RESEND_INTERVIEW_FROM_EMAIL', 'interviews@edcruiter.com');
    const sent = stubResend();

    const out = await sendEmail({ to: 'teacher@school.edu', subject: 'Hi', html: '<p>x</p>', text: 'x' });

    expect(out).toEqual({ ok: true, id: 'email_1' });
    const { url, headers, body } = sent();
    expect(url).toBe('https://api.resend.com/emails');
    expect(headers.Authorization).toBe('Bearer re_test_key');
    expect(body).toMatchObject({ from: 'Edcruiter <no-reply@edcruiter.com>', to: 'teacher@school.edu', subject: 'Hi' });
    expect(body.reply_to).toBeUndefined();
  });

  it('sends an interview email from the interview address, in the school\'s name, with replies going to the school', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    vi.stubEnv('RESEND_INTERVIEW_FROM_EMAIL', 'interviews@edcruiter.com');
    const sent = stubResend();

    await sendEmail({
      to: 'teacher@school.edu', subject: 'Hi', html: 'h', text: 't',
      kind: 'interview', fromName: 'Green Valley School', replyTo: ' principal@gvs.edu ',
    });

    const { body } = sent();
    expect(body.from).toBe('Green Valley School via Edcruiter <interviews@edcruiter.com>');
    expect(body.reply_to).toBe('principal@gvs.edu');
  });

  it('falls back to the account address for interview mail when no interview address is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    vi.stubEnv('RESEND_INTERVIEW_FROM_EMAIL', '');
    const sent = stubResend();

    await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't', kind: 'interview' });

    expect(sent().body.from).toBe('Edcruiter Interviews <no-reply@edcruiter.com>');
  });

  it('ignores a reply-to that is not a real address', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    const sent = stubResend();

    await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't', kind: 'interview', replyTo: 'not an email' });

    expect(sent().body.reply_to).toBeUndefined();
  });

  it('reports a refusal from Resend instead of pretending it was sent', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@edcruiter.com');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'The edcruiter.com domain is not verified.' }) }));

    const out = await sendEmail({ to: 'a@b.in', subject: 's', html: 'h', text: 't' });
    expect(out).toEqual({ ok: false, reason: 'send_failed', detail: 'The edcruiter.com domain is not verified.' });
  });
});
