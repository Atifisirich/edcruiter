'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { AppNotification } from '@/lib/types';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * The bell: notices that live inside the app (an interview was booked for you,
 * or cancelled). They are never sent on WhatsApp. Checks again every minute.
 */
export default function NotificationBell({ schoolId }: { schoolId: string }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?school_id=${encodeURIComponent(schoolId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnread(data.unread || 0);
    } catch { /* the bell stays as it was */ }
  }, [schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads once on arrival; state is set after the fetch resolves
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const markRead = async (ids: string[] | 'all') => {
    setItems((prev) => prev.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
    setUnread((u) => (ids === 'all' ? 0 : Math.max(0, u - ids.length)));
    await fetch(`/api/notifications?school_id=${encodeURIComponent(schoolId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={unread ? `Notices, ${unread} unread` : 'Notices'}
        aria-expanded={open}
        onClick={() => { setOpen((o) => !o); if (!open) void load(); }}
        className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900">Notices</p>
            {unread > 0 && (
              <button type="button" onClick={() => void markRead('all')} className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer">Mark all read</button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">Nothing yet. When an interview is booked for you, it shows here.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.map((n) => {
                const body = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-600 shrink-0" aria-hidden="true" />}
                      <div className="min-w-0">
                        <p className={`text-sm ${n.read_at ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 break-words">{n.body}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{ago(n.created_at)}</p>
                      </div>
                    </div>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => { setOpen(false); if (!n.read_at) void markRead([n.id]); }} className="block px-4 py-3 hover:bg-slate-50">{body}</Link>
                    ) : (
                      <button type="button" onClick={() => { if (!n.read_at) void markRead([n.id]); }} className="block w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer">{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
