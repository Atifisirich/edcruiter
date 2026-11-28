'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckSquare, CloudUpload, PhoneCall, Search, SearchX, Trash2, UserPlus, UserX, Users, Mic } from 'lucide-react';
import NotRespondingList, { type SetAsideCandidate } from '@/components/admin/NotRespondingList';
import { useAdmin } from '@/components/admin/adminContext';
import { Card, EmptyState, PageHeader, buttonClass, inputClass, selectClass } from '@/components/admin/ui';
import CandidateTable from '@/components/admin/CandidateTable';
import DeleteCandidatesDialog from '@/components/admin/DeleteCandidatesDialog';
import { isHiringTeam } from '@/lib/permissions';
import { candidateState, countByTab, TAB_LABEL, TAB_ORDER, type CandidateTab } from '@/lib/candidateProgress';
import { normalizeBands } from '@/lib/shortlistBands';
import { appliedTo } from '@/lib/vacancyCandidates';
import SubjectCounts from '@/components/admin/SubjectCounts';
import { countBySubject, subjectKey, subjectLabel } from '@/lib/subjectGroups';
import type { PublicVacancy } from '@/lib/types';

type TabKey = 'all' | CandidateTab | 'not_responding';

function CandidatesList() {
  const router = useRouter();
  const params = useSearchParams();
  const { school, schoolId, user, candidates: allCandidates, loading, refresh, openAddCandidate, openBulkUpload, toast } = useAdmin();
  // Only the school admin (or Edcruiter support) removes candidates; admin and HR can call them.
  const canDelete = isHiringTeam(user?.role);
  const canCall = isHiringTeam(user?.role);
  const [calling, setCalling] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const requested = params.get('tab');
  const tab: TabKey = requested === 'not_responding' ? 'not_responding' : (TAB_ORDER as string[]).includes(requested || '') ? (requested as CandidateTab) : 'all';

  // On a narrow screen the open tab may sit off to the side of the tab bar: bring it into view.
  const tabBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabBar.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  // People set aside as "Not responding": kept out of the list above, shown in their own section.
  const [setAside, setSetAside] = useState<SetAsideCandidate[]>([]);
  const [setAsideLoading, setSetAsideLoading] = useState(true);
  const loadSetAside = useCallback(async () => {
    if (!schoolId) return;
    try {
      const r = await fetch(`/api/candidates?school_id=${schoolId}&not_responding=only`);
      const d = r.ok ? await r.json() : { candidates: [] };
      setSetAside(d.candidates ?? []);
    } catch { /* the section shows empty; the main list is unaffected */ } finally {
      setSetAsideLoading(false);
    }
  }, [schoolId]);
  useEffect(() => {
    const start = window.setTimeout(() => void loadSetAside(), 0);
    return () => window.clearTimeout(start);
  }, [loadSetAside]);

  // Opened from a vacancy card (?job=...): only the people who applied for that vacancy.
  const jobId = params.get('job');
  // The vacancy this page was opened for: undefined while it loads, null when it no longer exists.
  const [loaded, setLoaded] = useState<{ jobId: string; vacancy: PublicVacancy | null } | null>(null);
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    fetch(`/api/jobs?school_id=${schoolId}`)
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => { if (!cancelled) setLoaded({ jobId, vacancy: (d.jobs as PublicVacancy[] | undefined)?.find((j) => j.id === jobId) ?? null }); })
      .catch(() => { if (!cancelled) setLoaded({ jobId, vacancy: null }); });
    return () => { cancelled = true; };
  }, [jobId, schoolId]);
  const vacancy: PublicVacancy | null | undefined = !jobId ? null : loaded?.jobId === jobId ? loaded.vacancy : undefined;
  const candidates = useMemo(() => {
    if (!jobId) return allCandidates;
    if (vacancy === undefined) return [];
    return vacancy ? allCandidates.filter((c) => appliedTo(c, vacancy)) : allCandidates;
  }, [allCandidates, jobId, vacancy]);

  const [search, setSearch] = useState('');
  // A subject tile on the Vacancies page opens this list with ?subject=...
  const [subject, setSubject] = useState(params.get('subject') || 'ALL');
  const [grade, setGrade] = useState('ALL');
  const [scoreFilter, setScoreFilter] = useState<'any' | 'yellow' | 'green'>('any');

  const bands = normalizeBands(school?.shortlist_bands);
  const yellowMin = bands.find((b) => b.key === 'yellow')?.min ?? 30;
  const greenMin = bands.find((b) => b.key === 'green')?.min ?? 60;

  const counts = useMemo(() => countByTab(candidates), [candidates]);

  // The same subject typed different ways counts once.
  const subjectCounts = useMemo(() => countBySubject(candidates), [candidates]);
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
        if (subject !== 'ALL' && subjectKey(c.applied_subject) !== subject) return false;
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

  // Ticked candidates still in the school's list, in the order shown.
  const selectedList = useMemo(() => candidates.filter((c) => selected.has(c.id)), [candidates, selected]);

  // An AI screening call to every ticked candidate.
  const callSelected = async () => {
    if (!window.confirm(`Start an AI screening call to ${selectedList.length} ${selectedList.length === 1 ? 'candidate' : 'candidates'}?`)) return;
    setCalling(true);
    try {
      const r = await fetch('/api/screening-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, candidate_ids: selectedList.map((c) => c.id) }),
      });
      const d = await r.json().catch(() => ({}));
      const started = (d.started || []).length;
      const problems: { error: string }[] = d.problems || [];
      if (started) toast(`${started} screening ${started === 1 ? 'call' : 'calls'} started. Results appear on each candidate's page.`, 'success');
      if (problems.length) toast(problems.slice(0, 2).map((p) => p.error).join(' ') + (problems.length > 2 ? ` (+${problems.length - 2} more)` : ''), 'error');
      if (!started && !problems.length) toast(d.error || 'Could not start the calls.', 'error');
      if (started) { setSelected(new Set()); setSelecting(false); }
    } finally {
      setCalling(false);
    }
  };

  const [inviting, setInviting] = useState(false);
  const inviteSelected = async () => {
    const n = selectedList.length;
    if (!window.confirm(`Invite ${n} ${n === 1 ? 'candidate' : 'candidates'} to the spoken AI interview? They are told by email and, where possible, WhatsApp. This works for candidates added before this was available, too.`)) return;
    setInviting(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const c of selectedList) {
        const r = await fetch('/api/voice-interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'invite', candidate_id: c.id }),
        }).catch(() => null);
        if (r?.ok) ok++; else failed++;
      }
      if (ok) toast(`${ok} ${ok === 1 ? 'candidate' : 'candidates'} invited to the AI interview. It shows on their application page.`, 'success');
      if (failed) toast(`${failed} could not be invited. Try those again.`, 'error');
      if (ok) { setSelected(new Set()); setSelecting(false); }
    } finally {
      setInviting(false);
    }
  };


  const [settingAside, setSettingAside] = useState(false);
  const moveCandidates = async (action: 'set_aside' | 'move_back', ids: string[]) => {
    const r = await fetch('/api/candidates/not-responding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, action, candidate_ids: ids }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : { error: 'Could not reach the server. Check your connection.' };
    const moved: number = d.moved ?? 0;
    const skipped: { name: string; reason: string }[] = d.skipped ?? [];
    if (moved) await Promise.all([refresh(), loadSetAside()]);
    if (skipped.length) toast(skipped.slice(0, 2).map((s) => `${s.name}: ${s.reason}`).join(' ') + (skipped.length > 2 ? ` (+${skipped.length - 2} more)` : ''), 'error');
    if (!moved && !skipped.length) toast(d.error || 'That could not be saved. Try again.', 'error');
    return moved;
  };
  const setAsideSelected = async () => {
    setSettingAside(true);
    try {
      const moved = await moveCandidates('set_aside', selectedList.map((c) => c.id));
      if (moved) {
        toast(`${moved} moved to Not responding. Nothing is deleted, and no automatic calls go to them. Move them back any time.`, 'success');
        setSelected(new Set());
        setSelecting(false);
      }
    } finally {
      setSettingAside(false);
    }
  };
  const moveBackOne = async (c: SetAsideCandidate) => {
    const moved = await moveCandidates('move_back', [c.id]);
    if (moved) toast(`${c.name} is back in the main list.`, 'success');
  };

  const filtering = tab !== 'all' || subject !== 'ALL' || grade !== 'ALL' || scoreFilter !== 'any' || search.trim() !== '';

  const goTab = (next: TabKey) => {
    const q = new URLSearchParams();
    if (jobId) q.set('job', jobId);
    if (next !== 'all') q.set('tab', next);
    setSelecting(false);
    setSelected(new Set());
    const qs = q.toString();
    router.replace(qs ? `/admin/candidates?${qs}` : '/admin/candidates', { scroll: false });
  };

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

      {jobId && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-sm">
          <p className="text-indigo-950">
            {vacancy === undefined
              ? 'Loading the vacancy…'
              : vacancy
                ? <>Showing people who applied for <strong>{vacancy.title}</strong>{vacancy.branch ? ` (${vacancy.branch})` : ''}.</>
                : 'That vacancy was not found, so nobody is shown for it.'}
          </p>
          <span className="flex items-center gap-2">
            <Link href="/admin/jobs" className={buttonClass('ghost', 'sm')}><ArrowLeft className="w-4 h-4" /> Back to vacancies</Link>
            <Link href="/admin/candidates" className={buttonClass('secondary', 'sm')}>Show all candidates</Link>
          </span>
        </div>
      )}

      {tab !== 'not_responding' && (
        <SubjectCounts counts={subjectCounts} selected={subject === 'ALL' ? '' : subject} onPick={(key) => setSubject(key || 'ALL')} />
      )}

      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-slate-200 px-2 sm:px-4 overflow-x-auto">
          <div ref={tabBar} role="tablist" className="flex gap-1 min-w-max">
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
            {/* Set apart from the tabs above: these people are not part of the counts. */}
            <span className="my-3 mx-1 w-px bg-slate-200" aria-hidden="true" />
            <button
              role="tab"
              aria-selected={tab === 'not_responding'}
              type="button"
              onClick={() => goTab('not_responding')}
              className={`relative px-3 sm:px-4 py-3.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors inline-flex items-center gap-1.5 ${
                tab === 'not_responding' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserX className="w-4 h-4" /> Not responding
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold ${tab === 'not_responding' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{setAside.length}</span>
              {tab === 'not_responding' && <span className="absolute left-3 right-3 -bottom-px h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          </div>
        </div>

        {tab === 'not_responding' ? (
          <NotRespondingList candidates={setAside} loading={setAsideLoading} canMove={canCall} onMoveBack={moveBackOne} />
        ) : (<>
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
            {subject !== 'ALL' && !subjectCounts.some((s) => s.key === subject) && <option value={subject}>{subjectLabel(subject)} (0)</option>}
            {subjectCounts.map((s) => <option key={s.key} value={s.key}>{s.label} ({s.total})</option>)}
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
          {(canDelete || canCall) && candidates.length > 0 && (
            <button
              type="button"
              onClick={() => { setSelecting((on) => !on); setSelected(new Set()); }}
              className={buttonClass(selecting ? 'primary' : 'secondary', 'sm')}
            >
              <CheckSquare className="w-4 h-4" /> {selecting ? 'Done selecting' : 'Select'}
            </button>
          )}
        </div>

        {selecting && (
          <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b border-slate-100 bg-indigo-50/60 text-sm">
            <span className="font-medium text-slate-800">{selectedList.length} selected</span>
            <button type="button" onClick={() => setSelected(new Set(visible.map((c) => c.id)))} className={buttonClass('ghost', 'sm')}>
              Select all {visible.length} shown
            </button>
            {selectedList.length > 0 && (
              <button type="button" onClick={() => setSelected(new Set())} className={buttonClass('ghost', 'sm')}>Clear</button>
            )}
            <span className="flex-1" />
            {canCall && (
              <button
                type="button"
                disabled={selectedList.length === 0 || inviting}
                onClick={() => void inviteSelected()}
                className={buttonClass('secondary', 'sm')}
              >
                <Mic className="w-4 h-4" /> {inviting ? 'Inviting…' : 'Invite to AI interview'}
              </button>
            )}
            {canCall && (
              <button
                type="button"
                disabled={selectedList.length === 0 || calling}
                onClick={() => void callSelected()}
                className={buttonClass('primary', 'sm')}
              >
                <PhoneCall className="w-4 h-4" /> {calling ? 'Starting calls…' : 'AI call selected'}
              </button>
            )}
            {canCall && (
              <button
                type="button"
                disabled={selectedList.length === 0 || settingAside}
                onClick={() => void setAsideSelected()}
                className={buttonClass('secondary', 'sm')}
                title="Move people who never answer out of the main list. Nothing is deleted."
              >
                <UserX className="w-4 h-4" /> {settingAside ? 'Moving…' : 'Not responding'}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={selectedList.length === 0}
                onClick={() => setConfirmDelete(true)}
                className={buttonClass('danger', 'sm')}
              >
                <Trash2 className="w-4 h-4" /> Delete selected
              </button>
            )}
          </div>
        )}

        <CandidateTable
          candidates={visible}
          bands={bands}
          selection={selecting ? { selected, onChange: setSelected } : undefined}
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
        </>)}
      </Card>

      {confirmDelete && selectedList.length > 0 && (
        <DeleteCandidatesDialog
          candidates={selectedList}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => { setConfirmDelete(false); setSelected(new Set()); setSelecting(false); }}
        />
      )}
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
