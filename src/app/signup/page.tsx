'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import AuthShell, { GoogleButton, OrDivider, inputClass, primaryButtonClass } from '@/components/auth/AuthShell';

export default function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not create your account. Please try again.');
        return;
      }
      setSentTo(email.trim());
      setDevLink(data.devLink || null);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <div className="text-center space-y-4 text-sm text-slate-700">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <MailCheck className="w-7 h-7" />
          </div>
          <p>
            We sent a link to <strong className="text-slate-900">{sentTo}</strong>. Open it to confirm your email and choose a password. The link works for 24 hours.
          </p>
          <p className="text-xs text-slate-500">Nothing there? Look in your spam folder.</p>
          {devLink ? (
            <p className="text-xs break-all bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
              Development only (no email service is set up): <a className="underline font-bold" href={devLink}>open the link</a>
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-600 font-semibold">{error}</p> : null}
          <button
            type="button"
            disabled={busy || resent}
            onClick={async () => { await submit(); setResent(true); }}
            className="text-xs font-bold text-indigo-600 hover:underline disabled:opacity-50 cursor-pointer"
          >
            {resent ? 'Sent again' : busy ? 'Sending…' : 'Send the email again'}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="For schools hiring teachers. It takes about a minute.">
      <GoogleButton
        label="Sign up with Google"
        busy={googleBusy}
        onClick={() => { setGoogleBusy(true); window.location.href = '/api/auth/google?next=/school/setup'; }}
      />
      <OrDivider />

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {error}{' '}
            {error.includes('already have an account') ? <Link href="/login" className="font-bold underline">Log in</Link> : null}
          </span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-bold text-slate-700">
          Your full name
          <input
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} mt-1.5`}
            placeholder="e.g. Radhika Rao"
          />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Work email
          <input
            required
            type="email"
            autoComplete="email"
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
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Create account'}
        </button>
        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          We email you a link to confirm your address and choose a password. By continuing you agree to the{' '}
          <Link href="/terms" className="text-indigo-600 font-semibold">Terms</Link> and{' '}
          <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy Policy</Link>.
        </p>
      </form>

      <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 leading-relaxed flex gap-2">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-indigo-500" />
        <span>
          Joining a school that already uses Edcruiter? Do not create a new account for it. Ask your school admin to add your email on their Team page, then log in.
        </span>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Already have an account?{' '}
        <Link href="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
