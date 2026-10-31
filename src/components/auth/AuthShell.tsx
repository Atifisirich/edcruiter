import React from 'react';
import Link from 'next/link';
import BrandMark from '@/components/shared/BrandMark';

export function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.6-5.1 3.6-3.1 0-5.6-2.6-5.6-5.7s2.5-5.7 5.6-5.7c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.4 3.6 14.4 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}

/** Same page frame for sign up, log in, forgot password and choose password. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between">
      <header className="p-6 max-w-7xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
            E
          </div>
          <BrandMark size="md" />
        </Link>
        <Link href="/" className="text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
          ← Back to Homepage
        </Link>
      </header>

      <main className="max-w-md mx-auto w-full px-4 py-8 sm:py-12 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <div className="bg-white rounded-3xl p-5 sm:p-9 border border-slate-200 shadow-xl space-y-5">{children}</div>
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

export function GoogleButton({ label, onClick, busy }: { label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full min-h-12 py-3.5 rounded-xl font-bold text-sm sm:text-xs bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
    >
      <GoogleIcon />
      {busy ? 'Opening Google…' : label}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-semibold">
      <span className="h-px flex-1 bg-slate-200" />
      or
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

// 16px on phones: anything smaller makes iPhones zoom the page when a field is tapped.
export const inputClass =
  'w-full min-h-12 px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-base sm:text-sm focus:border-indigo-500 focus:outline-none placeholder-slate-400 transition-colors';

export const primaryButtonClass =
  'w-full min-h-12 brand-primary-btn py-3.5 sm:py-3 rounded-xl font-bold text-sm sm:text-xs shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50';
