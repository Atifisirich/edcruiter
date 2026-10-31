'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import AuthShell, { inputClass, primaryButtonClass } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setDevLink(data.devLink || null);
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Check your email">
        <div className="text-center space-y-4 text-sm text-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7" />
          </div>
          <p>
            If <strong className="text-slate-900">{email.trim()}</strong> has an Edcruiter account, we have sent a link to choose a new password. It works for 1 hour.
          </p>
          <p className="text-xs text-slate-500">Nothing there? Look in your spam folder.</p>
          {devLink ? (
            <p className="text-xs break-all bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
              Development only (no email service is set up): <a className="underline font-bold" href={devLink}>open the link</a>
            </p>
          ) : null}
          <Link href="/login" className="block text-xs font-bold text-indigo-600 hover:underline">Back to log in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one.">
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-bold text-slate-700">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} mt-1.5`}
            placeholder="you@yourschool.edu"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className={primaryButtonClass}
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send me a link'}
        </button>
      </form>
      <p className="text-xs text-slate-600 text-center">
        Remembered it? <Link href="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
