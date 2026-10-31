'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Copy } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { credentialsFromCandidate } from '@/lib/credentials';
import { bandForScore, type ShortlistBand } from '@/lib/shortlistBands';
import { candidateState, TEST_STAGE_COUNT } from '@/lib/candidateProgress';
import { Badge, StepDots, buttonClass, type Tone } from './ui';
import { useAdmin } from './adminContext';

const BAND_TONE: Record<ShortlistBand['tone'], Tone> = { danger: 'rose', warning: 'amber', success: 'emerald' };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function CandidateTable({
  candidates,
  bands,
  emptyState,
  compact = false,
}: {
  candidates: Candidate[];
  bands: ShortlistBand[];
  emptyState: React.ReactNode;
  /** A narrower table for a side-by-side card: fewer columns, no horizontal scroll. */
  compact?: boolean;
}) {
  const { toast } = useAdmin();

  if (candidates.length === 0) return <>{emptyState}</>;

  const copyInvite = async (c: Candidate) => {
    const url = `${window.location.origin}/candidate/${c.id}`;
    try {
      await navigator.clipboard.writeText(`Code: ${c.invite_code || c.id}\nLink: ${url}`);
      toast(`Test code and link for ${c.name} copied.`, 'success');
    } catch {
      toast('Could not copy. Open the candidate and copy it from there.', 'error');
    }
  };

  const rows = candidates.map((c) => {
    const state = candidateState(c);
    const score = Number(c.total_ai_score || 0);
    const band = score > 0 ? bandForScore(score, bands) : null;
    return { c, state, score, band, creds: credentialsFromCandidate(c) };
  });

  return (
    <>
      {/* Phone: one card per candidate */}
      <ul className="md:hidden divide-y divide-slate-100">
        {rows.map(({ c, state, score, band }) => (
          <li key={c.id}>
            <Link href={`/admin/candidates/${c.id}`} className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50">
              <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span>
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                  {band ? <Badge tone={BAND_TONE[band.tone]}>{score}</Badge> : <span className="text-xs text-slate-400">Not scored</span>}
                </span>
                <span className="block text-sm text-slate-500 truncate">{[c.applied_subject, c.applied_segment?.split('(')[0].trim()].filter(Boolean).join(' · ') || 'Role not set'}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={state.tone}>{state.label}</Badge>
                  <StepDots done={state.stagesDone} total={TEST_STAGE_COUNT} />
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 mt-3 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and desktop: a table */}
      <div className={`hidden md:block ${compact ? '' : 'overflow-x-auto'}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="py-3 pl-6 pr-3 font-semibold">Candidate</th>
              <th className="py-3 px-3 font-semibold">Role</th>
              {!compact && <th className="py-3 px-3 font-semibold hidden xl:table-cell">Qualification</th>}
              {!compact && <th className="py-3 px-3 font-semibold">Test progress</th>}
              <th className="py-3 px-3 font-semibold">AI score</th>
              <th className="py-3 px-3 font-semibold">Status</th>
              <th className="py-3 pl-3 pr-6 font-semibold text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ c, state, score, band, creds }) => (
              <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 pl-6 pr-3">
                  <Link href={`/admin/candidates/${c.id}`} className="flex items-center gap-3 group">
                    <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 group-hover:text-indigo-700 truncate max-w-[14rem]">{c.name}</span>
                      <span className="block text-xs text-slate-500 truncate max-w-[14rem]">{c.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="py-3.5 px-3">
                  <span className="block font-medium text-slate-800">{c.applied_subject || 'Not set'}</span>
                  <span className="block text-xs text-slate-500">{c.applied_segment?.split('(')[0].trim() || '—'}</span>
                </td>
                {!compact && (
                  <td className="py-3.5 px-3 hidden xl:table-cell">
                    <span className="block text-slate-800">{creds.highestDegree}</span>
                    <Badge tone={creds.hasBEd ? 'emerald' : 'rose'} className="mt-1">{creds.bedLabel}</Badge>
                  </td>
                )}
                {!compact && (
                  <td className="py-3.5 px-3">
                    <StepDots done={state.stagesDone} total={TEST_STAGE_COUNT} />
                    <span className="block text-xs text-slate-500 mt-1.5">{state.stagesDone} of {TEST_STAGE_COUNT} stages</span>
                  </td>
                )}
                <td className="py-3.5 px-3">
                  {band ? (
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-lg font-bold text-slate-900 leading-none">{score}<span className="text-xs font-medium text-slate-400"> /100</span></span>
                      <Badge tone={BAND_TONE[band.tone]}>{band.label}</Badge>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Not scored yet</span>
                  )}
                </td>
                <td className="py-3.5 px-3">
                  <Badge tone={state.tone}>{state.label}</Badge>
                  {compact && <StepDots done={state.stagesDone} total={TEST_STAGE_COUNT} />}
                </td>
                <td className="py-3.5 pl-3 pr-6">
                  <div className="flex items-center justify-end gap-2">
                    {!compact && (
                      <button
                        type="button"
                        onClick={() => void copyInvite(c)}
                        className={buttonClass('ghost', 'sm')}
                        title="Copy the test code and link"
                        aria-label={`Copy test code and link for ${c.name}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <Link href={`/admin/candidates/${c.id}`} className={buttonClass('secondary', 'sm')} aria-label={`View report for ${c.name}`}>
                      {compact ? <ChevronRight className="w-4 h-4" /> : 'View report'}
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
