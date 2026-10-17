import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Meta's callback for delivery receipts and inbound replies. Unauthenticated
 * by cookie/session — it is a public URL Meta posts to — so it authenticates
 * every POST by HMAC signature instead. Do not add session checks here; add
 * signature checks, which is the only thing that actually secures this route.
 */

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (
    params.get('hub.mode') === 'subscribe' &&
    verifyToken &&
    params.get('hub.verify_token') === verifyToken
  ) {
    return new Response(params.get('hub.challenge') || '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

function verifySignature(raw: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(raw).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STOP_WORDS = new Set(['stop', 'unsubscribe', 'opt out', 'optout', 'remove me']);

/** Minimal shape of a WhatsApp Cloud API webhook delivery — only the fields this route reads. */
interface WhatsAppWebhookPayload {
  entry?: {
    id?: string;
    changes?: {
      value?: {
        statuses?: { id?: string; status?: string; errors?: { code?: number; title?: string }[] }[];
        messages?: { from?: string; type?: string; text?: { body?: string } }[];
      };
    }[];
  }[];
}

export async function POST(req: NextRequest) {
  // Read the raw body — the signature is computed over the exact bytes Meta
  // sent, and re-serializing parsed JSON would not reliably reproduce them.
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('Bad signature', { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  // Respond fast; Meta retries on slow or failing responses and can
  // eventually unsubscribe a webhook that keeps timing out.
  queueMicrotask(() => processWebhookPayload(payload).catch((e) => console.error('WhatsApp webhook processing error:', e)));

  return NextResponse.json({ received: true });
}

async function processWebhookPayload(payload: WhatsAppWebhookPayload) {
  for (const entry of payload?.entry ?? []) {
    const wabaId: string | undefined = entry?.id;
    // A dedicated (school_waba) school is unambiguous from the WABA id
    // alone. The platform's shared WABA is not — many schools send from it,
    // so which school an *inbound* reply belongs to can only be resolved
    // per-message, by matching the sender's phone number; see
    // handleInboundMessage. Delivery-status events don't have this problem
    // at all (handleStatus resolves the school from the original outbound
    // message log row, which already recorded the right school_id).
    const dedicatedSchool = wabaId ? db.getSchoolByWabaId(wabaId) : undefined;
    const isSharedWaba = !dedicatedSchool && !!wabaId && db.isPlatformSharedWaba(wabaId);

    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value) continue;

      for (const status of value.statuses ?? []) {
        await handleStatus(status);
      }
      for (const message of value.messages ?? []) {
        await handleInboundMessage(dedicatedSchool, isSharedWaba, message);
      }
    }
  }
}

async function handleStatus(status: { id?: string; status?: string; errors?: { code?: number; title?: string }[] }) {
  if (!status?.id) return;
  const row = db.getWhatsAppMessageByWaId(status.id);
  if (!row) return;

  const mapped = { delivered: 'delivered', read: 'read', sent: 'sent', failed: 'failed' } as const;
  const next = mapped[(status.status as keyof typeof mapped) || 'sent'] ?? 'sent';

  const err = status.errors?.[0];
  db.updateWhatsAppMessage(row.id, {
    status: next,
    ...(err ? { error_code: err.code, error_title: err.title } : {})
  });

  // First real delivered/read receipt is what promotes a school's number
  // from "verified" to "live" — a claim the connect wizard should only make
  // once Meta has actually delivered something, not once a form was saved.
  if (next === 'delivered' || next === 'read') {
    const school = db.getSchoolById(row.school_id);
    if (school?.whatsapp_hiring && school.whatsapp_hiring.status !== 'live') {
      db.updateSchool(school.id, { whatsapp_hiring: { ...school.whatsapp_hiring, status: 'live' } });
    }
  }
}

async function handleInboundMessage(
  dedicatedSchool: ReturnType<typeof db.getSchoolByWabaId>,
  isSharedWaba: boolean,
  message: { from?: string; type?: string; text?: { body?: string } }
) {
  if (!message?.from) return;

  const resolved = dedicatedSchool
    ? (() => {
        const candidate = db.findCandidateByIdentifier(message.from!, dedicatedSchool.id);
        return candidate ? { candidate, school: dedicatedSchool } : undefined;
      })()
    : isSharedWaba
      ? db.findCandidateOnSharedWaba(message.from)
      : undefined;

  if (!resolved) return;
  const { candidate, school } = resolved;

  const windowExpiry = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  db.openMessageWindow(school.id, candidate.id, windowExpiry);

  const text = (message.text?.body || '').trim().toLowerCase();
  if (STOP_WORDS.has(text)) {
    db.revokeConsent(candidate.id, 'whatsapp');
    db.addAuditLog({
      id: `audit_wa_optout_${Date.now()}`,
      school_id: school.id,
      actor_id: candidate.id,
      actor_name: candidate.name,
      actor_role: 'SCHOOL_ADMIN',
      action: 'WHATSAPP_OPT_OUT',
      resource: `Candidate: ${candidate.name}`,
      details: `Replied "${text}" — consent revoked, no further WhatsApp sends.`,
      timestamp: new Date().toISOString()
    });
  }
}
