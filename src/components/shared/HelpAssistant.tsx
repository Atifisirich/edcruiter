'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CheckCircle2, ExternalLink, HelpCircle, Loader2, Send, X } from 'lucide-react';

type Turn = { role: 'user' | 'assistant'; text: string; link?: string; offerTeam?: boolean };

const STAFF_IDEAS = [
  'How do I add a candidate and send the test link?',
  'How do the AI screening calls work?',
  'A candidate says their link does not open',
];
const CANDIDATE_IDEAS = [
  'How does the application work?',
  'My camera is not working',
  'What happens if I leave a stage half way?',
];

const KEY = 'edcruiter-help-chat';

/** Shows the bot's **bold** as bold; nothing else from the reply is treated as markup. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>
      )}
    </>
  );
}

/**
 * The help bot: a bubble in the corner that answers questions about using
 * Edcruiter and can pass a request to the Edcruiter team. Staff see it
 * everywhere; candidates only between stages (the page does not render it
 * during a stage, and the server refuses it then too).
 */
export default function HelpAssistant({ audience }: { audience: 'staff' | 'candidate' }) {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') as Turn[]; } catch { return []; }
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  // True from sending until the first word arrives: the dots show while the model starts up.
  const [waiting, setWaiting] = useState(false);
  const [summary, setSummary] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(turns.slice(-30))); } catch { /* storage blocked */ }
    end.current?.scrollIntoView({ block: 'end' });
  }, [turns, open, busy, waiting]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: 'user', text: q }];
    setTurns(next);
    setText('');
    setError('');
    setSent(false);
    setBusy(true);
    setWaiting(true);
    let answer = '';
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((t) => ({ role: t.role, text: t.text })), page: pathname }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'The assistant is not available right now.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        let event: { t: string; text?: string; summary?: string; link?: string; offer_team?: boolean };
        try { event = JSON.parse(line); } catch { return; }
        if (event.t === 'delta' && event.text) {
          answer += event.text;
          setWaiting(false);
          setTurns([...next, { role: 'assistant', text: answer }]);
        } else if (event.t === 'done') {
          finished = true;
          setSummary(event.summary || '');
          setTurns([...next, { role: 'assistant', text: answer, link: event.link || undefined, offerTeam: event.offer_team === true }]);
        } else if (event.t === 'error') {
          throw new Error(event.text || 'The assistant is not available right now.');
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(handle);
      }
      handle(buffer);
      if (!finished && !answer) throw new Error('The assistant is not available right now.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant is not available right now.');
    } finally {
      setWaiting(false);
      setBusy(false);
    }
  };

  const sendToTeam = async () => {
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/support-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, messages: turns.map((t) => ({ role: t.role, text: t.text })), page: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send the message.');
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const ideas = audience === 'candidate' ? CANDIDATE_IDEAS : STAFF_IDEAS;
  const last = turns[turns.length - 1];
  const canSend = turns.some((t) => t.role === 'user') && !sent;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open the help assistant"
          className="fixed bottom-4 right-4 z-[55] inline-flex items-center gap-2 pl-3.5 pr-4 py-3 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-xl hover:bg-indigo-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <HelpCircle className="w-5 h-5" /> Help
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Help assistant"
          className="fixed z-[55] bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[24rem] h-[min(34rem,100dvh)] sm:h-[34rem] bg-white border border-slate-200 sm:rounded-2xl shadow-2xl flex flex-col text-slate-900"
        >
          <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-indigo-600 text-white sm:rounded-t-2xl">
            <HelpCircle className="w-5 h-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Edcruiter help</p>
              <p className="text-[11px] text-indigo-100 leading-tight">Ask how to do anything, or what went wrong</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help" className="p-1.5 rounded-lg hover:bg-white/15 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm" aria-live="polite">
            {turns.length === 0 && (
              <div className="space-y-2">
                <p className="text-slate-600">Hello! I can explain how Edcruiter works, help fix a problem, and pass anything I cannot solve to the Edcruiter team. You can write in English, Hindi or Telugu.</p>
                <div className="flex flex-col gap-1.5">
                  {ideas.map((i) => (
                    <button key={i} type="button" onClick={() => void ask(i)} className="text-left text-xs px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer">
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex'}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap break-words ${t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {t.role === 'assistant' ? <RichText text={t.text.trimEnd()} /> : t.text}
                  {t.link && (
                    <Link href={t.link} onClick={() => setOpen(false)} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 underline">
                      <ExternalLink className="w-3.5 h-3.5" /> Take me there
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {waiting && (
              <div className="flex" aria-label="The assistant is typing">
                <div className="rounded-2xl px-4 py-3 bg-slate-100 flex items-center gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-xs text-rose-600">{error}</p>}

            {sent ? (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Sent to the Edcruiter team with this conversation. They will reply by email.
              </p>
            ) : (
              canSend && !busy && (last?.offerTeam ? (
                // The bot could not solve it: offer the team plainly.
                <div className="rounded-xl p-3 text-xs border bg-amber-50 border-amber-200">
                  <p className="text-slate-700">Want the Edcruiter team to look at this?</p>
                  <button
                    type="button"
                    onClick={() => void sendToTeam()}
                    disabled={sending}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send to the Edcruiter team
                  </button>
                </div>
              ) : (
                // Answered: keep the way to a person, but as one quiet line instead of a box under every reply.
                <button
                  type="button"
                  onClick={() => void sendToTeam()}
                  disabled={sending}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                >
                  {sending && <Loader2 className="w-3 h-3 animate-spin" />} Still stuck? Send this chat to the Edcruiter team
                </button>
              ))
            )}
            <div ref={end} />
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void ask(text); }}
            className="flex items-end gap-2 p-3 border-t border-slate-100"
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
              rows={2}
              maxLength={1500}
              placeholder="Type your question…"
              aria-label="Your question"
              className="flex-1 resize-none p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm focus:outline-none focus:border-indigo-500"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
