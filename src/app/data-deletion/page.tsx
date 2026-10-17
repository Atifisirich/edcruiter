'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function DataDeletionPage() {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-xl mx-auto px-4 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">Edcruiter legal</p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Delete my data</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Google requires a way for users to request deletion of data obtained through Sign in with
          Google. Submit this form with the email on your Edcruiter account. We will delete or
          anonymise account data that we are not legally required to keep (for example, records a
          school must retain for a closed hiring file).
        </p>
        <p className="mt-2 text-sm text-slate-600">
          You can also revoke access at{' '}
          <a
            className="text-indigo-600 font-semibold"
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>

        {submitted ? (
          <div className="mt-8 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            Request received. We will process deletion for <strong>{email}</strong> and email a
            confirmation. Typical turnaround is 7 days.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Account email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Optional note</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                placeholder="e.g. I signed in with Google and want my Edcruiter account removed."
              />
            </div>
            {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
            <button type="submit" disabled={sending} className="brand-primary-btn w-full py-3 rounded-xl text-sm font-bold">
              {sending ? 'Sending…' : 'Request deletion'}
            </button>
          </form>
        )}

        <p className="mt-8 text-xs text-slate-400">
          <Link href="/privacy" className="text-indigo-600 font-semibold">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/" className="text-indigo-600 font-semibold">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
