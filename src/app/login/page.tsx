'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BrandMark from '@/components/shared/BrandMark';
import { AlertCircle, Building2, GraduationCap, KeyRound, Loader2 } from 'lucide-react';
import { GoogleButton, OrDivider, inputClass, primaryButtonClass } from '@/components/auth/AuthShell';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const params = useSearchParams();
  const googleError = params.get('error') === 'google_signin_failed';
  const next = params.get('next');
  const [activeTab, setActiveTab] = useState<'school' | 'candidate'>('school');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = () => {
    setGoogleBusy(true);
    // Google proves who the person is. Someone who already belongs to a school
    // is sent to it; a brand-new Google account is sent to school setup.
    window.location.href = '/api/auth/google?next=/school/setup';
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not log you in. Please try again.');
        return;
      }
      window.location.href = data.redirect || '/admin';
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between">

      <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
            E
          </div>
          <BrandMark size="md" />
        </Link>

        <Link
          href="/"
          className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
        >
          <span>← Back to Homepage</span>
        </Link>
      </header>

      <main className="max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">

        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Log in to <BrandMark size="lg" showDot={false} />
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            School staff log in with their email. Teachers continue an application from the link we sent them.
          </p>
        </div>

        <div className="flex justify-center">
          <div className="bg-slate-200/80 p-1.5 rounded-2xl flex w-full max-w-sm sm:w-auto sm:max-w-none gap-2 text-xs font-bold shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('school')}
              className={`flex-1 sm:flex-none justify-center whitespace-nowrap min-h-11 px-4 sm:px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'school'
                  ? 'bg-white text-indigo-700 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>School staff</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('candidate')}
              className={`flex-1 sm:flex-none justify-center whitespace-nowrap min-h-11 px-4 sm:px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'candidate'
                  ? 'bg-white text-indigo-700 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span><span className="sm:hidden">Teacher</span><span className="hidden sm:inline">Teacher / Candidate</span></span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 sm:p-10 border border-slate-200 shadow-xl max-w-lg mx-auto">

          {activeTab === 'school' ? (
            <div className="space-y-5 text-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900">School staff log in</h2>
                  <span className="text-[11px] text-slate-500">Principals, HR, and reviewers</span>
                </div>
              </div>

              {(error || googleError) && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error || 'Google sign-in did not work. Please try again, or log in with your email and password.'}</span>
                </div>
              )}

              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">
                  Email
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
                <label className="block text-xs font-bold text-slate-700">
                  <span className="flex items-center justify-between">
                    Password
                    <Link href="/forgot-password" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                      Forgot password?
                    </Link>
                  </span>
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} mt-1.5`}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className={primaryButtonClass}
                >
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Logging in…</> : 'Log in'}
                </button>
              </form>

              <OrDivider />

              <GoogleButton label="Continue with Google" busy={googleBusy} onClick={handleGoogle} />
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Google sign-in uses only your name, email, and profile picture. It does not read Gmail.{' '}
                <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy</Link>
                {' · '}
                <Link href="/terms" className="text-indigo-600 font-semibold">Terms</Link>
              </p>

              <p className="text-xs text-slate-600 text-center pt-1">
                New to Edcruiter?{' '}
                <Link href="/signup" className="text-indigo-600 font-bold hover:underline">Create an account</Link>
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900">Teacher log in</h2>
                  <span className="text-[11px] text-slate-500">Continue an application, or browse jobs to apply for the first time</span>
                </div>
              </div>

              <Link
                href="/candidate/login"
                className="w-full min-h-12 brand-primary-btn py-3.5 rounded-xl font-bold text-sm sm:text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <KeyRound className="w-4 h-4" />
                <span>Continue my application</span>
              </Link>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                Applying for the first time?{' '}
                <Link href="/jobs" className="font-bold underline">Browse open teaching roles</Link> — applying starts
                your assessment immediately, no invite code needed yet.
              </div>
            </div>
          )}

        </div>

      </main>

      <footer className="p-6 text-center text-xs text-slate-400 border-t border-slate-200">
        © 2026 Edcruiter.{' '}
        <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy</Link>
        {' · '}
        <Link href="/terms" className="text-indigo-600 font-semibold">Terms</Link>
      </footer>

    </div>
  );
}
