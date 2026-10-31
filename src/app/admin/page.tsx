'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, CheckCircle2, CircleDashed, CloudUpload, Clock, FileSpreadsheet, Hourglass, Plus, Rocket, UserCheck, UserPlus, Users,
} from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, ProgressBar, StatCard, buttonClass, selectClass } from '@/components/admin/ui';
import CandidateTable from '@/components/admin/CandidateTable';
import { buildChecklist, checklistProgress, type ChecklistItem } from '@/lib/onboardingChecklist';
import { countByTab, candidateState } from '@/lib/candidateProgress';
import { normalizeBands } from '@/lib/shortlistBands';

type OutcomeRange = 'today' | 'till_date' | 'last_month' | 'last_year';

function inOutcomeRange(iso: string | undefined, range: OutcomeRange): boolean {
  if (!iso) return false;
  if (range === 'till_date') return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return t >= start.getTime();
  }
  if (range === 'last_month') return t >= now - 30 * 24 * 60 * 60 * 1000;
  return t >= now - 365 * 24 * 60 * 60 * 1000;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface SetupCounts {
  tests: number;
  policies: number;
  vacancies: number;
  teamMembers: number;
  upcomingInterviews: number;
}

async function loadCount(url: string, key: string): Promise<number> {
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data[key]) ? data[key].length : 0;
  } catch {
    return 0;
  }
}

export default function HiringOverview() {
  const { school, schoolId, candidates, loading, user, openAddCandidate, openNewVacancy, openBulkUpload } = useAdmin();
  const [setup, setSetup] = useState<SetupCounts | null>(null);
  const [outcomeRange, setOutcomeRange] = useState<OutcomeRange>('last_month');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tests, policies, vacancies, teamMembers] = await Promise.all([
        loadCount(`/api/assessment-packs?school_id=${schoolId}`, 'packs'),
        loadCount(`/api/hr-policies?school_id=${schoolId}`, 'policies'),
        loadCount(`/api/jobs?school_id=${schoolId}`, 'jobs'),
        loadCount(`/api/team?school_id=${schoolId}`, 'members'),
      ]);
      let upcomingInterviews = 0;
      try {
        const res = await fetch(`/api/interviews?school_id=${schoolId}`);
        if (res.ok) {
          const data = await res.json();
          const now = Date.now();
          upcomingInterviews = (data.interviews || []).filter(
            (i: { status: string; scheduled_at: string }) =>
              i.status === 'scheduled' && new Date(i.scheduled_at).getTime() >= now && new Date(i.scheduled_at).getTime() <= now + WEEK_MS
          ).length;
        }
      } catch { /* the card simply shows none */ }
      if (!cancelled) setSetup({ tests, policies, vacancies, teamMembers, upcomingInterviews });
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  const bands = normalizeBands(school?.shortlist_bands);
  const tabs = useMemo(() => countByTab(candidates), [candidates]);

  const checklist = useMemo(
    () =>
      buildChecklist({
        school,
        counts: {
          tests: setup?.tests ?? 0,
          policies: setup?.policies ?? 0,
          vacancies: setup?.vacancies ?? 0,
          candidates: candidates.length,
          teamMembers: setup?.teamMembers ?? 0,
        },
      }),
    [school, setup, candidates.length]
  );
  const progress = checklistProgress(checklist);
  const showChecklist = setup !== null && progress.done < progress.total;

  const recent = useMemo(
    () => [...candidates].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5),
    [candidates]
  );

  // The time is read once after the page appears, so the counts do not change between renders.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(t);
  }, []);

  const stalled = useMemo(
    () =>
      now === 0
        ? 0
        : candidates.filter((c) => {
            const s = candidateState(c);
            return s.tab === 'in_progress' && c.created_at && now - new Date(c.created_at).getTime() > WEEK_MS;
          }).length,
    [candidates, now]
  );

  const outcomes = useMemo(() => {
    const within = (iso?: string) => inOutcomeRange(iso, outcomeRange);
    return {
      selected: candidates.filter((c) => within(c.selected_at || (c.status === 'hired' ? c.updated_at || c.created_at : undefined))).length,
      offers: candidates.filter((c) => within(c.offer_letter_sent_at || (c.coo_clearance?.offer_letter ? c.coo_clearance?.completed_at : undefined))).length,
      declined: candidates.filter((c) => within(c.rejected_by_candidate_at)).length,
      rejected: candidates.filter((c) =>
        within(c.rejected_by_school_at || (c.status === 'rejected' && !c.rejected_by_candidate_at ? c.updated_at || c.created_at : undefined))
      ).length,
    };
  }, [candidates, outcomeRange]);

  const attention: { key: string; text: string; href: string; tone: 'amber' | 'indigo' | 'slate' }[] = [];
  if (tabs.ready > 0) attention.push({ key: 'ready', text: `${tabs.ready} ${tabs.ready === 1 ? 'candidate is' : 'candidates are'} ready to review`, href: '/admin/candidates?tab=ready', tone: 'amber' });
  if ((setup?.upcomingInterviews ?? 0) > 0) attention.push({ key: 'interviews', text: `${setup!.upcomingInterviews} ${setup!.upcomingInterviews === 1 ? 'interview' : 'interviews'} in the next 7 days`, href: '/admin/interviews', tone: 'indigo' });
  if (stalled > 0) attention.push({ key: 'stalled', text: `${stalled} ${stalled === 1 ? 'candidate has' : 'candidates have'} not finished the test after a week`, href: '/admin/candidates?tab=in_progress', tone: 'slate' });

  const firstName = (user?.name || '').split(' ')[0];

  const runAction = (item: ChecklistItem) => {
    if (item.action === 'add-candidate') openAddCandidate();
    if (item.action === 'new-vacancy') openNewVacancy();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Hiring dashboard'}
        description="Everything about your teacher hiring, in one place."
      />

      {showChecklist && (
        <Card>
          <CardHeader
            title="Get started"
            description="A few steps to get your first teachers tested."
            action={
              <div className="flex items-center gap-3 min-w-[12rem]">
                <div className="flex-1"><ProgressBar percent={progress.percent} /></div>
                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{progress.done} of {progress.total}</span>
              </div>
            }
          />
          <ul className="divide-y divide-slate-100 -mx-2">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-2 py-3">
                {item.done ? (
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" /></span>
                ) : (
                  <CircleDashed className="w-6 h-6 text-slate-300 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${item.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{item.label}</p>
                  <p className="text-sm text-slate-500">{item.hint}</p>
                </div>
                {!item.done &&
                  (item.href ? (
                    <Link href={item.href} className={buttonClass('secondary', 'sm')}>
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => runAction(item)} className={buttonClass('secondary', 'sm')}>
                      {item.action === 'add-candidate' ? 'Add' : 'Create'} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Candidates" value={loading ? '–' : candidates.length} hint="In your workspace" Icon={Users} tone="indigo" href="/admin/candidates" />
        <StatCard label="Taking the test" value={loading ? '–' : tabs.in_progress} hint="Invited or part-way" Icon={Hourglass} tone="slate" href="/admin/candidates?tab=in_progress" />
        <StatCard label="Ready to review" value={loading ? '–' : tabs.ready} hint="Finished all five stages" Icon={UserCheck} tone="amber" href="/admin/candidates?tab=ready" />
        <StatCard label="Selected" value={loading ? '–' : tabs.selected} hint="Hired or offered" Icon={CheckCircle2} tone="emerald" href="/admin/candidates?tab=selected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padded={false} className="lg:col-span-2 overflow-hidden">
          <div className="px-5 sm:px-6 pt-5 sm:pt-6">
            <CardHeader
              title="Recent candidates"
              description="The newest people in your pipeline."
              action={
                candidates.length > 5 ? (
                  <Link href="/admin/candidates" className={buttonClass('ghost', 'sm')}>
                    View all {candidates.length} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : undefined
              }
            />
          </div>
          <CandidateTable
            compact
            candidates={recent}
            bands={bands}
            emptyState={
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
            }
          />
        </Card>

        <Card>
          <CardHeader title="Needs your attention" />
          {attention.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6 gap-2">
              <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></span>
              <p className="text-sm font-semibold text-slate-900">You’re all caught up</p>
              <p className="text-sm text-slate-500">Nothing is waiting on you right now.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
                    <Clock className={`w-4 h-4 shrink-0 ${a.tone === 'amber' ? 'text-amber-500' : a.tone === 'indigo' ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="flex-1 text-sm font-medium text-slate-800">{a.text}</span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick actions</p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={openNewVacancy} className={`${buttonClass('secondary', 'sm')} justify-start`}>
                <Plus className="w-4 h-4" /> Post a vacancy
              </button>
              <button type="button" onClick={openBulkUpload} className={`${buttonClass('secondary', 'sm')} justify-start`}>
                <FileSpreadsheet className="w-4 h-4" /> Upload a list of CVs
              </button>
              <Link href="/admin/tests" className={`${buttonClass('secondary', 'sm')} justify-start`}>
                <Rocket className="w-4 h-4" /> Create an AI test
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Hiring outcomes"
          description="Who was selected, offered a job or turned down."
          action={
            <select
              aria-label="Time period"
              value={outcomeRange}
              onChange={(e) => setOutcomeRange(e.target.value as OutcomeRange)}
              className={selectClass}
            >
              <option value="today">Today</option>
              <option value="last_month">Last 30 days</option>
              <option value="last_year">Last year</option>
              <option value="till_date">All time</option>
            </select>
          }
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Selected by school', value: outcomes.selected, tone: 'emerald' as const },
            { label: 'Offer letters sent', value: outcomes.offers, tone: 'indigo' as const },
            { label: 'Declined by candidate', value: outcomes.declined, tone: 'amber' as const },
            { label: 'Not moving forward', value: outcomes.rejected, tone: 'rose' as const },
          ].map((o) => (
            <div key={o.label} className="rounded-xl border border-slate-200 p-4">
              <Badge tone={o.tone}>{o.label}</Badge>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{o.value}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
