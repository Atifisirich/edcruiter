'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CloudUpload, Search, SearchX, UserPlus, Users } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Card, EmptyState, PageHeader, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import CandidateTable from '@/components/admin/CandidateTable';
import { candidateState, countByTab, TAB_LABEL, TAB_ORDER, type CandidateTab } from '@/lib/candidateProgress';
import { normalizeBands } from '@/lib/shortlistBands';

type TabKey = 'all' | CandidateTab;

function CandidatesList() {
  const router = useRouter();
  const params = useSearchParams();
  const { school, candidates, loading, openAddCandidate, openBulkUpload } = useAdmin();

  const requested = params.get('tab');
  const tab: TabKey = (TAB_ORDER as string[]).includes(requested || '') ? (requested as CandidateTab) : 'all';

  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('ALL');
  const [grade, setGrade] = useState('ALL');
  const [scoreFilter, setScoreFilter] = useState<'any' | 'yellow' | 'green'>('any');

  const bands = normalizeBands(school?.shortlist_bands);
  const yellowMin = bands.find((b) => b.key === 'yellow')?.min ?? 30;
  const greenMin = bands.find((b) => b.key === 'green')?.min ?? 60;

  const counts = useMemo(() => countByTab(candidates), [candidates]);

  const subjects = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.applied_subject).filter(Boolean))).sort(),
    [candidates]
  );
  const grades = useMemo(
    () => Array.from(new Set(candidates.map((c) => c.applied_segment?.split('(')[0].trim()).filter(Boolean))).sort(),
    [candidates]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minScore = scoreFilter === 'green' ? greenMin : scoreFilter === 'yellow' ? yellowMin : 0;
    return candidates
      .filter((c) => {
        if (tab !== 'all' && candidateState(c).tab !== tab) return false;
        if (subject !== 'ALL' && c.applied_subject !== subject) return false;
        if (grade !== 'ALL' && (c.applied_segment?.split('(')[0].trim() ?? '') !== grade) return false;
        if (minScore > 0 && Number(c.total_ai_score || 0) < minScore) return false;
        if (q) {
          const hay = `${c.name} ${c.email} ${c.phone} ${c.applied_subject} ${c.invite_code ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.total_ai_score || 0) - Number(a.total_ai_score || 0) || (b.created_at || '').localeCompare(a.created_at || ''));
  }, [candidates, tab, subject, grade, scoreFilter, search, greenMin, yellowMin]);

  const filtering = tab !== 'all' || subject !== 'ALL' || grade !== 'ALL' || scoreFilter !== 'any' || search.trim() !== '';

  const goTab = (next: TabKey) => router.replace(next === 'all' ? '/admin/candidates' : `/admin/candidates?tab=${next}`, { scroll: false });

  const reset = () => {
    setSearch('');
    setSubject('ALL');
    setGrade('ALL');
    setScoreFilter('any');
    goTab('all');
  };

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: candidates.length },
    ...TAB_ORDER.map((k) => ({ key: k as TabKey, label: TAB_LABEL[k], count: counts[k] })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Everyone you have invited, how far they have got, and how they scored."
        actions={
          <>
            <button type="button" onClick={openBulkUpload} className={buttonClass('secondary')}>
              <CloudUpload className="w-4 h-4" /> Upload CVs
            </button>
            <button type="button" onClick={openAddCandidate} className={buttonClass('primary')}>
              <UserPlus className="w-4 h-4" /> Add candidate
            </button>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-slate-200 px-2 sm:px-4 overflow-x-auto">
          <div role="tablist" className="flex gap-1 min-w-max">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => goTab(t.key)}
                  className={`relative px-3 sm:px-4 py-3.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                    active ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
                  {active && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-indigo-600 rounded-full" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="relative flex-1 min-w-[14rem]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name, email, phone or test code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
              aria-label="Search candidates"
            />
          </div>
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectClass} aria-label="Filter by subject">
            <option value="ALL">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={grade} onChange={(e) => setGrade(e.target.value)} className={selectClass} aria-label="Filter by grade level">
            <option value="ALL">All grade levels</option>
            {grades.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value as 'any' | 'yellow' | 'green')} className={selectClass} aria-label="Filter by score">
            <option value="any">Any score</option>
            <option value="yellow">Score {yellowMin} and above</option>
            <option value="green">Strong only ({greenMin} and above)</option>
          </select>
          {filtering && (
            <button type="button" onClick={reset} className={buttonClass('ghost', 'sm')}>Clear filters</button>
          )}
        </div>

        <CandidateTable
          candidates={visible}
          bands={bands}
          emptyState={
            candidates.length === 0 ? (
              <EmptyState
                Icon={Users}
                title={loading ? 'Loading your candidates…' : 'No candidates yet'}
                description={loading ? undefined : 'Add a teacher, or upload a list of CVs. They get a test code on WhatsApp.'}
                action={
                  loading ? undefined : (
                    <div className="flex flex-wrap justify-center gap-2">
                      <button type="button" onClick={openAddCandidate} className={buttonClass('primary')}>
                        <UserPlus className="w-4 h-4" /> Add a candidate
                      </button>
                      <button type="button" onClick={openBulkUpload} className={buttonClass('secondary')}>
                        <CloudUpload className="w-4 h-4" /> Upload CVs
                      </button>
                    </div>
                  )
                }
              />
            ) : (
              <EmptyState
                Icon={SearchX}
                title="No candidates match"
                description="Try a different search, or clear the filters."
                action={<button type="button" onClick={reset} className={buttonClass('secondary')}>Clear filters</button>}
              />
            )
          }
        />

        {visible.length > 0 && (
          <p className="px-6 py-3 text-sm text-slate-500 border-t border-slate-100">
            Showing {visible.length} of {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
          </p>
        )}
      </Card>
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />}>
      <CandidatesList />
    </Suspense>
  );
}
