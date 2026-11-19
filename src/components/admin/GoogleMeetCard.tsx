'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Video } from 'lucide-react';
import { Card, CardHeader, buttonClass } from './ui';
import { useAdmin } from './adminContext';

type Status = { available: boolean; connected: boolean; email?: string; connected_at?: string; connected_by_name?: string };

const RESULT: Record<string, { text: string; tone: 'success' | 'error' }> = {
  connected: { text: 'Google is connected. New interviews get a Google Meet link.', tone: 'success' },
  cancelled: { text: 'Google was not connected: the permission was not given.', tone: 'error' },
  no_scope: { text: 'Tick “See, edit, share and delete calendar events” on Google’s screen, then try again.', tone: 'error' },
  no_refresh: { text: 'Google did not give a lasting permission. Remove Edcruiter from your Google account’s third-party access, then connect again.', tone: 'error' },
  failed: { text: 'Google could not be connected. Try again, signed in as the school admin.', tone: 'error' },
};

/** Connects the school's Google account so each interview gets a real Google Meet link and a calendar invite. */
export default function GoogleMeetCard() {
  const { schoolId, toast } = useAdmin();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/integrations/google-calendar?school_id=${encodeURIComponent(schoolId)}`)
      .then((r) => r.json())
      .then((d: Status) => setStatus(d))
      .catch(() => {});

  useEffect(() => {
    load();
    // Coming back from Google: say how it went once, then tidy the address bar.
    const url = new URL(window.location.href);
    const result = url.searchParams.get('google');
    if (result && RESULT[result]) {
      toast(RESULT[result].text, RESULT[result].tone);
      url.searchParams.delete('google');
      window.history.replaceState(null, '', url.toString());
    }
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/integrations/google-calendar?school_id=${encodeURIComponent(schoolId)}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error || 'Could not start.');
      window.location.href = d.url;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start.', 'error');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Google? Interviews already booked keep their Meet links. New ones get a free Jitsi room instead.')) return;
    setBusy(true);
    await fetch(`/api/integrations/google-calendar?school_id=${encodeURIComponent(schoolId)}`, { method: 'DELETE' }).catch(() => {});
    await load();
    setBusy(false);
    toast('Google disconnected.', 'success');
  };

  return (
    <Card>
      <div id="interviews" />
      <CardHeader
        title="Google Meet for interviews"
        description="Connect your school’s Google account once. Every interview you book then gets its own Google Meet link, and Google sends the candidate and the interviewer a calendar invite. Without it, a free Jitsi room is used."
      />
      {!status ? (
        <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
      ) : status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
          <p className="text-sm text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Connected to <strong>{status.email}</strong>
              {status.connected_by_name ? ` by ${status.connected_by_name}` : ''}
              {status.connected_at ? ` on ${new Date(status.connected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.
              <span className="block text-emerald-800/80">Interviews appear in this account’s Google Calendar.</span>
            </span>
          </p>
          <button type="button" onClick={disconnect} disabled={busy} className={buttonClass('secondary', 'sm')}>Disconnect</button>
        </div>
      ) : status.available ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">Use an account that will own the interview events, such as your HR or school Google Workspace account.</p>
          <button type="button" onClick={connect} disabled={busy} className={buttonClass('primary')}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />} Connect Google
          </button>
        </div>
      ) : (
        <p className="text-sm text-amber-700">Google is not set up on this server yet. Ask Edcruiter to switch it on.</p>
      )}
    </Card>
  );
}
