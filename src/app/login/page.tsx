'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BrandMark from '@/components/shared/BrandMark';
import {
  Building2, GraduationCap, KeyRound
} from 'lucide-react';

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.6-5.6-5.7s2.5-5.7 5.6-5.7c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.4 3.6 14.4 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<'school' | 'candidate'>('school');
  const [googleError, setGoogleError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    setGoogleError(new URLSearchParams(window.location.search).get('error') === 'google_signin_failed');
  }, []);

  const handleGoogleSchoolSignIn = () => {
    setSigningIn(true);
    // A brand-new Google account with no linked school lands on the setup
    // wizard, which creates the school and provisions this account as its
    // admin in one step. A returning admin's session already resolves to
    // their existing school on every request after this.
    window.location.href = '/api/auth/google?next=/school/setup';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between">
      
      {/* Top Header Bar */}
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

      {/* Main Dual Login Container */}
      <main className="max-w-4xl mx-auto w-full px-4 py-8 sm:py-12 space-y-8">
        
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Sign in to <BrandMark size="lg" showDot={false} />
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Sign in as a school (HR / Principal) or as a teacher.
          </p>
          {googleError ? (
            <p className="text-xs text-red-600 font-semibold">
              Google sign-in failed. Use the Google account that is a test user, and try again.
            </p>
          ) : null}
        </div>

        {/* Portal Switcher Tabs */}
        <div className="flex justify-center">
          <div className="bg-slate-200/80 p-1.5 rounded-2xl inline-flex gap-2 text-xs font-bold shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('school')}
              className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'school'
                  ? 'bg-white text-indigo-700 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>School / Recruiter Portal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('candidate')}
              className={`px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'candidate'
                  ? 'bg-white text-indigo-700 shadow-md font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Teacher / Candidate Portal</span>
            </button>
          </div>
        </div>

        {/* Portal Login Cards */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl max-w-lg mx-auto">
          
          {activeTab === 'school' ? (
            /* School / Recruiter sign-in — Google is the only account system
               this app has; there is no password login on the backend. */
            <div className="space-y-5 text-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900">School Administrator &amp; HOD Login</h2>
                  <span className="text-[11px] text-slate-500">Access campus vacancies &amp; candidate reports</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSchoolSignIn}
                disabled={signingIn}
                className="w-full py-3.5 rounded-xl font-bold text-xs bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <GoogleIcon />
                {signingIn ? 'Opening Google sign-in…' : 'Continue with Google'}
              </button>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Continue with Google uses only your name, email, and profile to sign you in. It does not read Gmail.{' '}
                <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy</Link>
                {' · '}
                <Link href="/terms" className="text-indigo-600 font-semibold">Terms</Link>
              </p>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 leading-relaxed">
                First time here? Signing in creates your school and makes this account its admin. Already set up?
                Sign in with the same Google account you used before.
              </div>
            </div>
          ) : (
            /* Teacher / Candidate — the real flow needs an invite code from an
               application already on file, so this points to that page rather
               than faking a session inline. */
            <div className="space-y-5 text-xs">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-sm text-slate-900">Teacher sign in</h2>
                  <span className="text-[11px] text-slate-500">Continue an application, or browse jobs to apply for the first time</span>
                </div>
              </div>

              <Link
                href="/candidate/login"
                className="w-full brand-primary-btn py-3.5 rounded-xl font-bold text-xs shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
              >
                <KeyRound className="w-4 h-4" />
                <span>Continue with my invite code</span>
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

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-400 border-t border-slate-200">
        © 2026 Edcruiter.{' '}
        <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy</Link>
        {' · '}
        <Link href="/terms" className="text-indigo-600 font-semibold">Terms</Link>
      </footer>

    </div>
  );
}
