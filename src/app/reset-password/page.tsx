'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthShell, { inputClass, primaryButtonClass } from '@/components/auth/AuthShell';

type Mode = 'signup' | 'reset' | 'invite';

const COPY: Record<Mode, { title: string; subtitle: string; button: string }> = {
  signup: { title: 'Choose your password', subtitle: 'Your email is confirmed. Choose a password to finish creating your account.', button: 'Create my account' },
  invite: { title: 'Join your school\'s team', subtitle: 'Choose a password to get into your school\'s Edcruiter workspace.', button: 'Set password and continue' },
  reset: { title: 'Choose a new password', subtitle: 'Pick a password you have not used before.', button: 'Save new password' },
};

export default function ChoosePasswordPage() {
  return (
    <Suspense fallback={null}>
      <ChoosePasswordForm />
    </Suspense>
  );
}

function ChoosePasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const modeParam = params.get('mode');
  const mode: Mode = modeParam === 'signup' || modeParam === 'invite' ? modeParam : 'reset';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) setExpired(true);
        setError(data.error || 'Could not save your password. Please try again.');
        return;
      }
      window.location.href = data.redirect || '/admin';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!token || expired) {
    return (
      <AuthShell title="This link no longer works">
        <div className="text-center space-y-4 text-sm text-slate-700">
          <p>It may have expired, or it was already used. Links can only be used once.</p>
          <Link href="/forgot-password" className="inline-block brand-primary-btn px-5 py-3 rounded-xl font-bold text-xs">
            Get a new link
          </Link>
          <p className="text-xs text-slate-500">
            Already set your password? <Link href="/login" className="text-indigo-600 font-bold hover:underline">Log in</Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  const copy = COPY[mode];
  return (
    <AuthShell title={copy.title} subtitle={copy.subtitle}>
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-bold text-slate-700">
          Password
          <div className="relative mt-1.5">
            <input
              required
              autoFocus
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {tooShort ? <span className="block mt-1 text-[11px] font-normal text-amber-700">Use at least 8 characters.</span> : null}
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Type it again
          <input
            required
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`${inputClass} mt-1.5`}
          />
          {mismatch ? <span className="block mt-1 text-[11px] font-normal text-amber-700">The two passwords do not match yet.</span> : null}
        </label>
        <button
          type="submit"
          disabled={busy || tooShort || mismatch}
          className={primaryButtonClass}
        >
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : copy.button}
        </button>
      </form>
    </AuthShell>
  );
}
