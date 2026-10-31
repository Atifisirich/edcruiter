/**
 * Minimal transactional email sender via Resend's HTTP API — no SDK
 * dependency, same plain-fetch approach as whatsappClient.ts's `callGraph`.
 * Gracefully no-ops (logs, never throws) when RESEND_API_KEY /
 * RESEND_FROM_EMAIL aren't set, so a caller can always `await` this without
 * a configuration check first, the same way a WhatsApp send resolves to a
 * "not configured" outcome instead of crashing the request that triggered
 * it. Callers describe the message (account or interview); what the message
 * says lives with the caller, in files such as accountEmails.ts and
 * assessmentInvite.ts.
 */

import { isValidEmail } from './emailAddress';

export type EmailOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_configured' | 'send_failed'; detail?: string };

/** True when RESEND_API_KEY and RESEND_FROM_EMAIL are both set, so an email can really be sent. */
export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

/**
 * Two kinds of email leave from two addresses on the same verified domain, so a
 * teacher can tell a login email from a message about their application:
 *   account   - sign-up, password reset, team invitations, data deletion
 *               (RESEND_FROM_EMAIL, shown as "Edcruiter")
 *   interview - candidate invitations and outcomes, interview scheduling
 *               (RESEND_INTERVIEW_FROM_EMAIL, falling back to the account address;
 *               shown as "<School> via Edcruiter")
 */
export type EmailKind = 'account' | 'interview';

// A school name goes into a mail header, so anything that could end the name or
// start a new header line is removed first.
function displayName(name: string): string {
  const safe = name.replace(/[<>"\\\r\n,;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Edcruiter';
  return /^[\w ]+$/.test(safe) ? safe : `"${safe}"`;
}

/**
 * A bare address is sent as `Name <address>` so the inbox shows a name instead
 * of "no-reply". A value that already carries a display name is used as given.
 */
export function fromHeader(from: string, name = 'Edcruiter'): string {
  return from.includes('<') ? from : `${displayName(name)} <${from}>`;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind?: EmailKind;
  /** Interview emails only: the school the message is on behalf of. */
  fromName?: string;
  /** Where a reply should go, for example the school's hiring contact. */
  replyTo?: string;
}): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const kind = params.kind ?? 'account';
  const from = kind === 'interview'
    ? process.env.RESEND_INTERVIEW_FROM_EMAIL || process.env.RESEND_FROM_EMAIL
    : process.env.RESEND_FROM_EMAIL;
  const name = kind === 'interview'
    ? (params.fromName ? `${params.fromName} via Edcruiter` : 'Edcruiter Interviews')
    : 'Edcruiter';
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
        from: fromHeader(from, name),
        ...(params.replyTo && isValidEmail(params.replyTo.trim()) ? { reply_to: params.replyTo.trim() } : {}),
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
