import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, getStaffContext } from '@/lib/auth';
import { getCandidateSession } from '@/lib/session';
import { checkRateLimit } from '@/lib/rateLimit';
import { cleanChat, streamAssistant } from '@/lib/assistant';

/**
 * The help bot. Open to signed-in staff, and to candidates between stages: a
 * candidate with a stage open is refused, so the bot cannot be used to help
 * with a test. It is sent only what the person types, the page they are on and
 * their role: no candidate, school or test data.
 *
 *   POST { messages: [{role, text}], page }
 *   -> a stream of lines, one JSON object each:
 *        {"t":"delta","text":"…"}                         words as they are written
 *        {"t":"done","offer_team":…,"summary":…,"link":…} the end
 */
export async function POST(req: NextRequest) {
  try {
    const staff = await getStaffContext();
    const candidate = staff ? null : await getCandidateSession();
    if (!staff && !candidate) return NextResponse.json({ error: 'Sign in to use the help assistant.' }, { status: 401 });

    if (candidate) {
      const open = db.getStageAttempts(candidate.school_id, candidate.cid).some((a) => a.status === 'open' && Date.now() - Date.parse(a.last_seen_at) <= 3 * 60_000);
      if (open) {
        return NextResponse.json({ error: 'The help assistant is switched off while a stage is open. Finish or leave the stage first.' }, { status: 403 });
      }
    }

    const rl = checkRateLimit(req, 'help-assistant', { max: 60, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many questions this hour. Please try again later.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const chat = cleanChat(body.messages);
    if (chat.length === 0 || chat[chat.length - 1].role !== 'user') return NextResponse.json({ error: 'Type a question first.' }, { status: 400 });
    const page = typeof body.page === 'string' ? body.page.slice(0, 120) : '';

    const events = streamAssistant(chat, { kind: staff ? 'staff' : 'candidate', role: staff?.role, page });
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of events) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          controller.enqueue(encoder.encode(`${JSON.stringify({ t: 'error', text: 'The help assistant is not available right now.' })}\n`));
        } finally {
          controller.close();
        }
      },
      // The person closed the chat or left: stop asking the model.
      cancel() { void events.return?.(undefined); },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        // Tells proxies not to hold the words back until the end.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'The help assistant is not available right now.' }, { status: 500 });
  }
}
