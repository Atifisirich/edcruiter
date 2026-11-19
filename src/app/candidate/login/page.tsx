'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Loader2, AlertCircle,
  ArrowLeft, CheckCircle2, GraduationCap, Link2
} from 'lucide-react';
import { cleanIdentifier, entryKind, extractInviteCode, signInPathFromPastedText } from '@/lib/candidateLink';

/** A one-line check under a box: green when it is the right thing, amber with what to do when not. */
function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className={`text-[11px] font-semibold flex items-center gap-1 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

export default function CandidateLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [pastedLink, setPastedLink] = useState('');
  const [moved, setMoved] = useState(false);
  const idKind = entryKind(identifier);
  const codeKind = entryKind(inviteCode);
  const linkKind = entryKind(pastedLink);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A WhatsApp/email invite link logs a candidate in automatically (see
  // /api/candidates/magic-login) — landing here at all means that link was
  // expired or already used, not a first-time visit, so say that rather
  // than showing no explanation for why they're on a login screen.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'link_expired') {
      setError('That link has expired or was already used. Paste a newer link, or sign in with your mobile number or email and your application ID.');
    }
  }, []);

  // A candidate who pastes the whole link they were sent, into either box,
  // goes straight in. No second field to fill.
  const openIfLink = (text: string): boolean => {
    const path = signInPathFromPastedText(text);
    if (!path) return false;
    window.location.href = path;
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openIfLink(pastedLink) || openIfLink(identifier) || openIfLink(inviteCode)) return;
    if (!identifier.trim() || !inviteCode.trim()) {
      setError('Fill in both boxes: your mobile number or email, and your application ID.');
      return;
    }
    if (idKind !== 'phone' && idKind !== 'email') {
      setError('The first box needs the mobile number or email you applied with.');
      return;
    }
    if (codeKind !== 'application_id') {
      setError('Your application ID starts with EDC-, for example EDC-PHYS-A4K2.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/candidates/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier(identifier),
          invite_code: extractInviteCode(inviteCode)
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Those details did not match an application.');
        return;
      }

      const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : data.redirectUrl);
    } catch {
      setError('Unable to log in at this moment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6">

        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div className="space-y-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Continue your application</h2>
          <p className="text-xs text-slate-500">
            Use the link we sent you, or sign in with your mobile number or email and your application ID.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <section className="space-y-1.5 p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50">
            <label htmlFor="link" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" /> Have the link we sent you?
            </label>
            <p className="text-[11px] text-slate-500">The easiest way: tap it in WhatsApp or email. Or paste it here and you go straight in.</p>
            <input
              id="link"
              type="text"
              inputMode="url"
              placeholder="Paste your link (it has magic-login in it)"
              value={pastedLink}
              onChange={(e) => { setPastedLink(e.target.value); openIfLink(e.target.value); }}
              className="w-full px-4 py-3 rounded-2xl bg-white border border-slate-300 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-400"
            />
            {linkKind !== 'empty' && linkKind !== 'link' && (
              <Hint ok={false}>That is not a link. {linkKind === 'application_id' ? 'It is your application ID: put it in the second box below.' : 'Use the boxes below instead.'}</Hint>
            )}
            {linkKind === 'link' && !signInPathFromPastedText(pastedLink) && (
              <Hint ok={false}>This is not your sign-in link. Your link has “magic-login” in it.</Hint>
            )}
          </section>

          <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 uppercase">
            <span className="h-px flex-1 bg-slate-200" /> or sign in with two details <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="identifier" className="block text-xs font-bold text-slate-700">
              1. Mobile number or email
            </label>
            <p className="text-[11px] text-slate-500">The one you gave when you applied. For example 9876543210 or name@gmail.com.</p>
            <input
              id="identifier"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="9876543210 or name@gmail.com"
              value={identifier}
              onChange={(e) => {
                const v = e.target.value;
                if (openIfLink(v)) return;
                // An application ID typed here belongs in the second box.
                if (entryKind(v) === 'application_id' && !inviteCode.trim()) {
                  setInviteCode(extractInviteCode(v));
                  setIdentifier('');
                  setMoved(true);
                  return;
                }
                setMoved(false);
                setIdentifier(v);
              }}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-400 transition-colors"
              autoFocus
            />
            {moved && <Hint ok={false}>That was your application ID, so we moved it to box 2. Here, type your mobile number or email.</Hint>}
            {idKind === 'phone' && <Hint ok>Mobile number</Hint>}
            {idKind === 'email' && <Hint ok>Email address</Hint>}
            {idKind === 'application_id' && <Hint ok={false}>That is your application ID. It goes in box 2. Here, type your mobile number or email.</Hint>}
            {idKind === 'unknown' && identifier.trim().length > 3 && <Hint ok={false}>This does not look like a 10-digit mobile number or an email address.</Hint>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="appid" className="block text-xs font-bold text-slate-700">
              2. Application ID
            </label>
            <p className="text-[11px] text-slate-500">Starts with EDC-. It is in the WhatsApp message or email we sent you (“Your application ID is…”). You can paste the whole message: we pick the ID out.</p>
            <input
              id="appid"
              type="text"
              autoCapitalize="characters"
              placeholder="EDC-PHYS-A4K2"
              value={inviteCode}
              onChange={(e) => { setInviteCode(e.target.value); openIfLink(e.target.value); }}
              onBlur={(e) => setInviteCode(extractInviteCode(e.target.value))}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-mono uppercase focus:border-indigo-500 focus:outline-none placeholder-slate-400 placeholder:normal-case transition-colors"
            />
            {codeKind === 'application_id' && <Hint ok>Application ID {extractInviteCode(inviteCode)}</Hint>}
            {(codeKind === 'phone' || codeKind === 'email') && <Hint ok={false}>That is your {codeKind === 'phone' ? 'mobile number' : 'email'}. It goes in box 1. Here, type the ID that starts with EDC-.</Hint>}
            {codeKind === 'unknown' && inviteCode.trim().length > 3 && <Hint ok={false}>An application ID looks like EDC-PHYS-A4K2.</Hint>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full brand-primary-btn py-3 rounded-2xl font-bold text-xs shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying…</span>
              </>
            ) : (
              <>
                <span>Continue to my application</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-500">
            Applying for the first time?{' '}
            <Link
              href="/jobs"
              className="text-indigo-600 font-bold hover:underline"
            >
              Browse teaching jobs
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
