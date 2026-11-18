import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { webhookToken } from '@/lib/screeningCall';
import { finishLiveCall } from '@/lib/screeningCallService';

/**
 * Sarvam calls this when a screening call ends (answered or not). Each call's
 * link carries a token signed for that call alone, so nobody else can post a
 * result for it. The transcript is read in the background and Sarvam gets its
 * answer straight away.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const callId = url.searchParams.get('call') || '';
  const token = url.searchParams.get('token') || '';
  const expected = webhookToken(callId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (!callId || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const call = db.getScreeningCall(callId);
  if (!call || call.mode !== 'live') return NextResponse.json({ error: 'Unknown call.' }, { status: 404 });
  // A repeated delivery of the same result changes nothing.
  if (call.status !== 'calling') return NextResponse.json({ ok: true, already: true });

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  if (call.attempt_id && payload.attempt_id && payload.attempt_id !== call.attempt_id) {
    return NextResponse.json({ error: 'That result is for another call.' }, { status: 409 });
  }

  after(() => finishLiveCall(call, payload));
  return NextResponse.json({ ok: true });
}
