import { db } from './db';
import { decryptSecret } from './secrets';
import { School, WhatsAppMessageLog } from './types';
import { toWhatsAppE164 } from './whatsapp';

/**
 * WhatsApp Cloud API client. Every send goes through `sendTemplateMessage` or
 * `sendFreeformMessage`, both of which:
 *   1. write a log row as `queued` before calling Meta, so a crash mid-send
 *      still leaves a record and something a retry can find;
 *   2. check consent and, for templates, the rolling 24h unique-recipient
 *      cap, so a bulk import cannot exceed what a new number is allowed to
 *      send or message someone who never agreed to be contacted;
 *   3. read the structured error body Meta returns on failure and store the
 *      real code and title, rather than collapsing every outcome to a
 *      boolean the previous `/api/whatsapp/invite` route did with
 *      `delivery = res.ok ? 'sent' : 'queued'`.
 *
 * See docs and the field build order in the WhatsApp runbook. Category and
 * copy rules (a template must not start/end on a variable, adjacent
 * variables are rejected, etc.) are enforced by Meta at template-approval
 * time, not here.
 */

const GRAPH_VERSION = 'v21.0';

export type TemplateName =
  | 'assessment_invite'
  | 'stage_reminder'
  | 'shortlisted'
  | 'round_scheduled'
  | 'offer_released'
  | 'application_outcome';

export const TEMPLATE_CATALOG: Record<TemplateName, { bodyParams: number; hasUrlButton: boolean; category: 'UTILITY' }> = {
  // {{1}} name, {{2}} school, {{3}} subject, {{4}} application ID (the invite
  // code). The approved wording must not call {{4}} a "sign-in code" or
  // "reference": Meta's template classifier treated that phrasing as an
  // Authentication message and refused it as Utility.
  assessment_invite: { bodyParams: 4, hasUrlButton: true, category: 'UTILITY' },
  stage_reminder: { bodyParams: 3, hasUrlButton: true, category: 'UTILITY' },
  shortlisted: { bodyParams: 3, hasUrlButton: true, category: 'UTILITY' },
  round_scheduled: { bodyParams: 4, hasUrlButton: true, category: 'UTILITY' },
  offer_released: { bodyParams: 4, hasUrlButton: true, category: 'UTILITY' },
  // {{1}} name, {{2}} school, {{3}} subject. No button: nothing left to open.
  application_outcome: { bodyParams: 3, hasUrlButton: false, category: 'UTILITY' },
};

export class WhatsAppConfigError extends Error {}

type Credentials = { phoneNumberId: string; token: string };

/**
 * Resolves the phone number ID and access token to send as. A school on the
 * shared platform number falls back to WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID;
 * a school with its own WABA decrypts its stored token. Throws rather than
 * silently sending from the wrong identity.
 */
export function resolveCredentials(school: School): Credentials {
  const wa = school.whatsapp_hiring;
  if (!wa) {
    throw new WhatsAppConfigError('This school has not connected a WhatsApp number yet.');
  }

  if (wa.provider === 'school_waba') {
    if (!wa.phone_number_id || !wa.token_encrypted) {
      throw new WhatsAppConfigError('WhatsApp credentials are incomplete for this school.');
    }
    return { phoneNumberId: wa.phone_number_id, token: decryptSecret(wa.token_encrypted) };
  }

  const phoneNumberId = wa.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    throw new WhatsAppConfigError('The platform WhatsApp number is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).');
  }
  return { phoneNumberId, token };
}

type GraphResult =
  | { ok: true; waMessageId: string }
  | { ok: false; code: number; title: string };

async function callGraph(creds: Credentials, body: Record<string, unknown>): Promise<GraphResult> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (json as { error?: { code?: number; message?: string; error_data?: { details?: string } } }).error;
    return {
      ok: false,
      code: err?.code ?? res.status,
      title: err?.error_data?.details || err?.message || `HTTP ${res.status}`
    };
  }

  const waMessageId = (json as { messages?: { id?: string }[] }).messages?.[0]?.id;
  return waMessageId ? { ok: true, waMessageId } : { ok: false, code: 0, title: 'No message id returned' };
}

async function startLogRow(
  school: School,
  candidateId: string | undefined,
  toE164: string,
  templateName: string,
  templateVars: string[]
): Promise<WhatsAppMessageLog> {
  return db.createWhatsAppMessage({
    id: `wam_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    school_id: school.id,
    candidate_id: candidateId,
    to_e164: toE164,
    template_name: templateName,
    template_vars: templateVars,
    status: 'queued',
    attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

async function finishLogRow(row: WhatsAppMessageLog, result: GraphResult) {
  if (result.ok) {
    db.updateWhatsAppMessage(row.id, { status: 'sent', wa_message_id: result.waMessageId, attempts: row.attempts + 1 });
  } else {
    db.updateWhatsAppMessage(row.id, {
      status: 'failed',
      error_code: result.code,
      error_title: result.title,
      attempts: row.attempts + 1
    });
  }
}

export type SendOutcome =
  | { ok: true; waMessageId: string }
  | { ok: false; reason: 'no_consent' | 'rate_limited' | 'graph_error'; detail?: string };

/**
 * Sends a pre-approved template message. Gated on consent and on the
 * school's rolling 24h unique-recipient count against `tierCap` — pass the
 * current messaging tier's limit; callers that don't track it yet can pass a
 * conservative default (250, the tier-0 floor) rather than omitting the check.
 */
export async function sendTemplateMessage(params: {
  school: School;
  candidateId?: string;
  toRaw: string;
  template: TemplateName;
  bodyParams: string[];
  buttonParam?: string;
  languageCode?: string;
  tierCap?: number;
  skipConsentCheck?: boolean;
}): Promise<SendOutcome> {
  const to = toWhatsAppE164(params.toRaw);
  if (!to) {
    return { ok: false, reason: 'graph_error', detail: 'Invalid phone number.' };
  }

  if (!params.skipConsentCheck && params.candidateId) {
    const consent = db.getConsent(params.candidateId, 'whatsapp');
    if (!consent?.granted) {
      await startLogRowAndMarkSkipped(params.school, params.candidateId, to, params.template, params.bodyParams);
      return { ok: false, reason: 'no_consent' };
    }
  }

  // 250 is where every new business starts; set WHATSAPP_TIER_CAP once Meta
  // raises the limit (Messaging limits in WhatsApp Manager shows the current one).
  const cap = params.tierCap ?? (Number(process.env.WHATSAPP_TIER_CAP) || 250);
  if (db.countRecentUniqueRecipients(params.school.id, 24 * 60 * 60_000) >= cap) {
    return { ok: false, reason: 'rate_limited', detail: `24h unique-recipient cap of ${cap} reached for this number.` };
  }

  const spec = TEMPLATE_CATALOG[params.template];
  if (params.bodyParams.length !== spec.bodyParams) {
    return { ok: false, reason: 'graph_error', detail: `${params.template} expects ${spec.bodyParams} body parameters, got ${params.bodyParams.length}.` };
  }

  const row = await startLogRow(params.school, params.candidateId, to, params.template, params.bodyParams);

  let creds: Credentials;
  try {
    creds = resolveCredentials(params.school);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'WhatsApp is not configured.';
    db.updateWhatsAppMessage(row.id, { status: 'failed', error_title: detail, attempts: 1 });
    return { ok: false, reason: 'graph_error', detail };
  }

  const components: Record<string, unknown>[] = [
    { type: 'body', parameters: params.bodyParams.map((text) => ({ type: 'text', text })) }
  ];
  if (spec.hasUrlButton && params.buttonParam) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: params.buttonParam }]
    });
  }

  const result = await callGraph(creds, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: params.template,
      language: { code: params.languageCode || 'en' },
      components
    }
  });

  await finishLogRow(row, result);

  return result.ok
    ? { ok: true, waMessageId: result.waMessageId }
    : { ok: false, reason: 'graph_error', detail: result.title };
}

/** Sends free-form text — only valid while `db.isWindowOpen` is true for this candidate. */
export async function sendFreeformMessage(params: {
  school: School;
  candidateId: string;
  toRaw: string;
  text: string;
}): Promise<SendOutcome> {
  const to = toWhatsAppE164(params.toRaw);
  if (!to) {
    return { ok: false, reason: 'graph_error', detail: 'Invalid phone number.' };
  }
  if (!db.isWindowOpen(params.school.id, params.candidateId)) {
    return { ok: false, reason: 'graph_error', detail: 'No open 24h conversation window — send a template instead.' };
  }

  const row = await startLogRow(params.school, params.candidateId, to, 'freeform', [params.text]);

  let creds: Credentials;
  try {
    creds = resolveCredentials(params.school);
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'WhatsApp is not configured.';
    db.updateWhatsAppMessage(row.id, { status: 'failed', error_title: detail, attempts: 1 });
    return { ok: false, reason: 'graph_error', detail };
  }

  const result = await callGraph(creds, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: params.text }
  });

  await finishLogRow(row, result);

  return result.ok
    ? { ok: true, waMessageId: result.waMessageId }
    : { ok: false, reason: 'graph_error', detail: result.title };
}

async function startLogRowAndMarkSkipped(
  school: School,
  candidateId: string,
  toE164: string,
  templateName: string,
  templateVars: string[]
) {
  const row = await startLogRow(school, candidateId, toE164, templateName, templateVars);
  db.updateWhatsAppMessage(row.id, { status: 'skipped_no_consent' });
}

/**
 * Sends Meta's built-in `hello_world` template, present on every new WhatsApp
 * Business Account before any custom template is approved. Used only by the
 * connect wizard's "send a test message" step (see /api/whatsapp/test-send) —
 * never for a real candidate-facing send, since its copy cannot be changed.
 */
export async function sendHelloWorld(creds: Credentials, toRaw: string): Promise<GraphResult> {
  const to = toWhatsAppE164(toRaw);
  if (!to) return { ok: false, code: 0, title: 'Invalid phone number.' };
  return callGraph(creds, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: 'hello_world', language: { code: 'en_US' } }
  });
}

/** Calls the Graph API's phone-number lookup to verify credentials actually work. */
export async function verifyPhoneNumber(creds: Credentials): Promise<
  | { ok: true; displayName: string; qualityRating: string; verifiedName?: string }
  | { ok: false; detail: string }
> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`,
      { headers: { Authorization: `Bearer ${creds.token}` } }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (json as { error?: { message?: string } }).error;
      return { ok: false, detail: err?.message || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      displayName: (json as { display_phone_number?: string }).display_phone_number || '',
      qualityRating: (json as { quality_rating?: string }).quality_rating || 'UNKNOWN',
      verifiedName: (json as { verified_name?: string }).verified_name
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Network error contacting Meta.' };
  }
}
