/**
 * Minimal transactional email sender via Resend's HTTP API — no SDK
 * dependency, same plain-fetch approach as whatsappClient.ts's `callGraph`.
 * Gracefully no-ops (logs, never throws) when RESEND_API_KEY /
 * RESEND_FROM_EMAIL aren't set, so a caller can always `await` this without
 * a configuration check first, the same way a WhatsApp send resolves to a
 * "not configured" outcome instead of crashing the request that triggered
 * it. Right now the only caller is the account-deletion confirmation flow;
 * if more transactional email is added later, give each its own well-named
 * function the way sendTemplateMessage/sendFreeformMessage split WhatsApp
 * sends, rather than growing this file's single function with special cases.
 */

export type EmailOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_configured' | 'send_failed'; detail?: string };

/** True when RESEND_API_KEY and RESEND_FROM_EMAIL are both set, so an email can really be sent. */
export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * RESEND_FROM_EMAIL can be a bare address. It is sent as "Edcruiter <address>"
 * so the inbox shows the product name instead of "no-reply". A value that already
 * carries a display name is used as given.
 */
export function fromHeader(from: string): string {
  return from.includes('<') ? from : `Edcruiter <${from}>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.info(`[email] Not configured (RESEND_API_KEY / RESEND_FROM_EMAIL) — skipping send to ${params.to}: "${params.subject}"`);
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromHeader(from),
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text
      })
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (json as { message?: string }).message || `HTTP ${res.status}`;
      console.error(`[email] Send failed to ${params.to}: ${detail}`);
      return { ok: false, reason: 'send_failed', detail };
    }

    const id = (json as { id?: string }).id || '';
    return { ok: true, id };
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Network error contacting Resend.';
    console.error(`[email] Send failed to ${params.to}: ${detail}`);
    return { ok: false, reason: 'send_failed', detail };
  }
}
