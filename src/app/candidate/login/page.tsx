'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight, Loader2, AlertCircle,
  ArrowLeft, GraduationCap
} from 'lucide-react';

export default function CandidateLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A WhatsApp/email invite link logs a candidate in automatically now (see
  // /api/candidates/magic-login) — landing here at all means that link was
  // expired or already used, not a first-time visit, so say that rather
  // than showing no explanation for why they're on a login screen.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('error') === 'link_expired') {
      setError('That link has expired or was already used. Enter your details below to continue.');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !inviteCode.trim()) {
      setError('Enter both your Application ID / phone / email and your invite code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/candidates/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          invite_code: inviteCode.trim()
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
            Enter the same details you applied with, plus the invite code we sent you on WhatsApp or email.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Application ID, mobile number, or email
            </label>
            <input
              type="text"
              placeholder="e.g. 9876543210 or you@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-400 transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Invite code
            </label>
            <input
              type="text"
              placeholder="e.g. EDC-PHYS-A4K2"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 text-slate-900 text-sm font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-400 transition-colors"
            />
            <p className="text-[11px] text-slate-500">Sent to you on WhatsApp or email when you first applied.</p>
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
