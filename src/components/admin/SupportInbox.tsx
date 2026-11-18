'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, LifeBuoy, Undo2 } from 'lucide-react';
import type { SupportMessage } from '@/lib/types';

/** Help requests sent from the help bot, for the platform owner. */
export default function SupportInbox() {
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch('/api/support-messages');
    const d = await r.json().catch(() => ({}));
    if (r.ok) setMessages(d.messages || []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const update = async (id: string, body: { status?: 'new' | 'resolved'; note?: string }) => {
    await fetch('/api/support-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    await load();
  };

  const list = (messages ?? []).filter((m) => showResolved || m.status === 'new');
  const waiting = (messages ?? []).filter((m) => m.status === 'new').length;

  return (
    <div className="glass-card rounded-3xl p-4 sm:p-8 border border-slate-200/80 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-indigo-600" /> Support messages ({waiting} waiting)
        </h2>
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="accent-indigo-600" /> Show resolved
        </label>
      </div>
      <p className="text-xs text-slate-500">Sent by users from the help bot when it could not solve their problem. Each one has the whole chat and the page they were on.</p>

      {messages === null ? (
        <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
      ) : list.length === 0 ? (
        <p className="text-xs text-slate-400 italic">{showResolved ? 'No messages yet.' : 'Nothing waiting.'}</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((m) => (
            <li key={m.id} className={`p-3.5 rounded-2xl border space-y-2 ${m.status === 'new' ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <strong className="text-slate-900 text-sm">{m.from.name}</strong>
                <span className="text-slate-500">{m.from.kind === 'candidate' ? 'Candidate' : m.from.role}{m.school_name ? ` · ${m.school_name}` : ''}</span>
                {m.from.email && <a href={`mailto:${m.from.email}?subject=${encodeURIComponent('Your Edcruiter help request')}`} className="text-indigo-600 font-semibold hover:underline">{m.from.email}</a>}
                <span className="text-slate-400 ml-auto">{new Date(m.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
              <p className="text-sm text-slate-800">{m.summary}</p>
              <p className="text-[11px] text-slate-500 font-mono">Page: {m.page || 'unknown'}</p>

              <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1 cursor-pointer">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open === m.id ? 'rotate-180' : ''}`} /> {open === m.id ? 'Hide' : 'Show'} the chat
              </button>
              {open === m.id && (
                <ol className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {m.transcript.map((t, i) => (
                    <li key={i} className={`text-xs p-2.5 rounded-xl max-w-[90%] whitespace-pre-wrap ${t.role === 'assistant' ? 'bg-indigo-50 text-indigo-950' : 'bg-white border border-slate-200 ml-auto'}`}>
                      <span className="block text-[10px] font-bold uppercase tracking-wide opacity-60">{t.role === 'assistant' ? 'Bot' : 'User'}</span>
                      {t.text}
                    </li>
                  ))}
                </ol>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={notes[m.id] ?? m.note ?? ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [m.id]: e.target.value }))}
                  onBlur={() => { if (notes[m.id] !== undefined && notes[m.id] !== (m.note ?? '')) void update(m.id, { note: notes[m.id] }); }}
                  placeholder="Your note (how it was solved)"
                  aria-label="Note"
                  className="flex-1 min-w-[12rem] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                />
                {m.status === 'new' ? (
                  <button type="button" onClick={() => void update(m.id, { status: 'resolved' })} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 cursor-pointer">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark resolved
                  </button>
                ) : (
                  <button type="button" onClick={() => void update(m.id, { status: 'new' })} className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5 cursor-pointer">
                    <Undo2 className="w-3.5 h-3.5" /> Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
