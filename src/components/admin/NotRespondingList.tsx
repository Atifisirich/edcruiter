'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2, RotateCcw, UserX } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { reachText, type Reach } from '@/lib/notResponding';
import { Badge, EmptyState, buttonClass } from './ui';

export type SetAsideCandidate = Candidate & { reach?: Reach; stages_completed?: number };

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/**
 * The people set aside as "Not responding": when and by whom, whether they can
 * still be reached, and one click to move each back to the main list.
 */
export default function NotRespondingList({
  candidates,
  loading,
  canMove,
  onMoveBack,
}: {
  candidates: SetAsideCandidate[];
  loading: boolean;
  canMove: boolean;
  onMoveBack: (c: SetAsideCandidate) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <EmptyState
        Icon={UserX}
        title={loading ? 'Loading…' : 'Nobody here'}
        description={loading ? undefined : 'Candidates who never answer can be moved here from the main list (Select, then Not responding). Nothing is deleted, and they can be moved back any time.'}
      />
    );
  }

  return (
    <>
      <p className="px-4 sm:px-6 py-3 text-sm text-slate-600 bg-slate-50/60 border-b border-slate-100">
        Set aside because they did not answer. They are not in your counts or the dashboard, and no automatic calls or messages go to them. Nothing is deleted.
      </p>
      <ul className="divide-y divide-slate-100">
        {candidates.map((c) => {
          const nr = c.not_responding;
          const started = (c.stages_completed ?? 0) > 0;
          const reach = c.reach ? reachText(c.reach) : null;
          return (
            <li key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-4">
              <Link href={`/admin/candidates/${c.id}`} className="min-w-0 flex-1 group">
                <span className="block font-semibold text-slate-900 group-hover:text-indigo-700 truncate">{c.name}</span>
                <span className="block text-xs text-slate-500 truncate">
                  {[c.applied_subject, c.applied_segment?.split('(')[0].trim(), c.phone || c.email].filter(Boolean).join(' · ')}
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:w-[22rem]">
                {nr && <span>Moved {when(nr.at)} by <strong className="text-slate-800">{nr.by_name}</strong></span>}
                {reach && <Badge tone={c.reach && (c.reach.phone || c.reach.email) ? 'slate' : 'rose'}>Can reach: {reach}</Badge>}
                {started && <Badge tone="amber">{c.stages_completed} test {c.stages_completed === 1 ? 'stage' : 'stages'} done</Badge>}
              </div>
              {canMove && (
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={async () => { setBusy(c.id); try { await onMoveBack(c); } finally { setBusy(null); } }}
                  className={buttonClass('secondary', 'sm')}
                >
                  {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Move back
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
