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
const BAND_DOT: Record<ShortlistBand['tone'], string> = { danger: 'bg-rose-500', warning: 'bg-amber-500', success: 'bg-emerald-500' };

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
}

export default function CandidateTable({
  candidates,
  bands,
  emptyState,
  compact = false,
  selection,
}: {
  candidates: Candidate[];
  bands: ShortlistBand[];
  emptyState: React.ReactNode;
  /** A narrower table for a side-by-side card: fewer columns, no horizontal scroll. */
  compact?: boolean;
  /** Tick boxes for acting on several candidates at once (the school admin's delete). */
  selection?: { selected: Set<string>; onChange: (next: Set<string>) => void };
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

  const toggle = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    selection.onChange(next);
  };
  const allTicked = !!selection && candidates.length > 0 && candidates.every((c) => selection.selected.has(c.id));
  const toggleAll = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const c of candidates) { if (allTicked) next.delete(c.id); else next.add(c.id); }
    selection.onChange(next);
  };
  const tick = (c: Candidate) => selection && (
    <input
      type="checkbox"
      checked={selection.selected.has(c.id)}
      onChange={() => toggle(c.id)}
      aria-label={`Select ${c.name}`}
      className="w-4 h-4 accent-indigo-600 cursor-pointer"
    />
  );

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
          <li key={c.id} className="flex items-start">
            {selection && <span className="pl-4 pt-7">{tick(c)}</span>}
            <Link href={`/admin/candidates/${c.id}`} className="flex flex-1 min-w-0 items-start gap-3 px-4 py-4 hover:bg-slate-50">
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

      {/* Tablet and desktop: a table that always fits its card, so nothing hides off to the side.
          Fixed layout: the small columns get set widths and Candidate takes what is left.
          Status and test progress share one column, so each column is wide enough that
          text never breaks mid-word; a long degree is cut to two lines (hover shows it all). */}
      <div className="hidden md:block">
        <table className={`w-full text-left text-sm ${compact ? '' : 'table-fixed'}`}>
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {selection && (
                <th className="py-3 pl-6 pr-0 w-12">
                  <input type="checkbox" checked={allTicked} onChange={toggleAll} aria-label="Select every candidate shown" className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                </th>
              )}
              <th className={`py-3 ${selection ? 'pl-3' : 'pl-6'} pr-3 font-semibold`}>Candidate</th>
              <th className={`py-3 px-3 font-semibold ${compact ? '' : 'w-[13%]'}`}>Role</th>
              {!compact && <th className="py-3 px-3 font-semibold hidden xl:table-cell w-[16%]">Qualification</th>}
              <th className={`py-3 px-3 font-semibold ${compact ? '' : 'w-[18%]'}`}>Status</th>
              <th className={`py-3 px-3 font-semibold ${compact ? '' : 'w-[14%]'}`}>AI score</th>
              <th className={`py-3 pl-2 pr-5 font-semibold text-right ${compact ? '' : 'w-[8.5rem] 2xl:w-48'}`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ c, state, score, band, creds }) => (
              <tr key={c.id} className={`transition-colors ${selection?.selected.has(c.id) ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'}`}>
                {selection && <td className="py-3.5 pl-6 pr-0">{tick(c)}</td>}
                <td className={`py-3.5 ${selection ? 'pl-3' : 'pl-6'} pr-3`}>
                  <Link href={`/admin/candidates/${c.id}`} className="flex items-center gap-3 group min-w-0">
                    <span className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-semibold text-slate-900 group-hover:text-indigo-700 truncate ${compact ? 'max-w-[14rem]' : ''}`} title={c.name}>{c.name}</span>
                      <span className={`block text-xs text-slate-500 truncate ${compact ? 'max-w-[14rem]' : ''}`} title={c.email || undefined}>{c.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="py-3.5 px-3">
                  <span className="block font-medium text-slate-800 truncate capitalize">{c.applied_subject || 'Not set'}</span>
                  <span className="block text-xs text-slate-500 truncate">{c.applied_segment?.split('(')[0].trim() || '—'}</span>
                </td>
                {!compact && (
                  <td className="py-3.5 px-3 hidden xl:table-cell">
                    <span className="text-slate-800 line-clamp-2 leading-snug" title={creds.highestDegree}>{creds.highestDegree}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      B.Ed <Badge tone={creds.hasBEd ? 'emerald' : 'rose'}>{creds.bedLabel}</Badge>
                    </span>
                  </td>
                )}
                <td className="py-3.5 px-3">
                  <Badge tone={state.tone}>{state.label}</Badge>
                  <span className="mt-2 flex items-center gap-2" title={`${state.stagesDone} of ${TEST_STAGE_COUNT} test stages done`}>
                    <StepDots done={state.stagesDone} total={TEST_STAGE_COUNT} small />
                    <span className="text-xs text-slate-500 whitespace-nowrap">{state.stagesDone}/{TEST_STAGE_COUNT}</span>
                  </span>
                </td>
                <td className="py-3.5 px-3">
                  {band ? (
                    <span className="flex flex-col items-start gap-1.5">
                      <span className="text-lg font-bold text-slate-900 leading-none">{score}<span className="text-xs font-medium text-slate-400"> /100</span></span>
                      <span className="flex items-start gap-1.5 text-xs font-medium text-slate-600 leading-snug">
                        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${BAND_DOT[band.tone]}`} />
                        {band.label}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 whitespace-nowrap">Not scored</span>
                  )}
                </td>
                <td className={`py-3.5 ${compact ? 'pl-3 pr-6' : 'pl-2 pr-5'}`}>
                  <div className="flex items-center justify-end gap-1.5">
                    {!compact && (
                      <button
                        type="button"
                        onClick={() => void copyInvite(c)}
                        className={`${buttonClass('ghost', 'sm')} px-2!`}
                        title="Copy the test code and link"
                        aria-label={`Copy test code and link for ${c.name}`}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    <Link href={`/admin/candidates/${c.id}`} className={buttonClass('secondary', 'sm')} aria-label={`View report for ${c.name}`}>
                      {compact ? <ChevronRight className="w-4 h-4" /> : (
                        <>
                          <span className="2xl:hidden">Report</span>
                          <span className="hidden 2xl:inline">View report</span>
                        </>
                      )}
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
