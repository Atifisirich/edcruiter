import React from 'react';
import Link from 'next/link';

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">Edcruiter legal</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {updated}</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:text-slate-900 [&_h2]:pt-4 [&_h3]:font-bold [&_h3]:text-slate-900 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_a]:text-indigo-600 [&_a]:font-semibold">
          {children}
        </div>
        <p className="mt-12 text-xs text-slate-400">
          Questions:{' '}
          <a href="mailto:privacy@edcruiter.com" className="text-indigo-600 font-semibold">
            privacy@edcruiter.com
          </a>
          {' · '}
          <Link href="/" className="text-indigo-600 font-semibold">
            Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
