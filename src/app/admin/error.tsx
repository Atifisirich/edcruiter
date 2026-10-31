'use client';

import { TriangleAlert } from 'lucide-react';
import { buttonClass } from '@/components/admin/ui';

/** Shown instead of a blank screen when something on a dashboard page fails. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-md mx-auto py-20 text-center space-y-4">
      <span className="mx-auto w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
        <TriangleAlert className="w-6 h-6" />
      </span>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">This page did not load</h1>
        <p className="text-sm text-slate-500">
          {error.message?.includes('fetch') ? 'We could not reach the server. Check your connection and try again.' : 'Something went wrong. Your data is safe.'}
        </p>
      </div>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClass('primary')}>Try again</button>
        <a href="/admin" className={buttonClass('secondary')}>Back to overview</a>
      </div>
    </div>
  );
}
