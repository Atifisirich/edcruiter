'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Sparkles, Search, BookOpen, ArrowRight, Check,
  MessageSquare, ExternalLink, Pencil, Trash2, Loader2, AlertTriangle
} from 'lucide-react';
import AIJobGeneratorModal from '@/components/admin/AIJobGeneratorModal';
import EditVacancyModal from '@/components/admin/EditVacancyModal';
import { useAdmin } from '@/components/admin/adminContext';
import { PageHeader, buttonClass } from '@/components/admin/ui';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { isHiringTeam } from '@/lib/permissions';
import { appliedTo } from '@/lib/vacancyCandidates';
import { countByTab } from '@/lib/candidateProgress';
import type { PublicVacancy } from '@/lib/types';

export default function SchoolJobsPage() {
  const { school, user, candidates, toast } = useAdmin();
  // Starts empty rather than with demo listings: a school with no postings sees none.
  const [jobs, setJobs] = useState<PublicVacancy[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicVacancy | null>(null);
  const [deleting, setDeleting] = useState<PublicVacancy | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  // The school admin and HR run vacancies; reviewers only read them.
  const canManage = isHiringTeam(user?.role);

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const loadJobs = () => {
    fetch(`/api/jobs?school_id=${schoolId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || `Could not load your job postings (${res.status}).`);
          return;
        }
        setLoadError('');
        setJobs(data.jobs || []);
      })
      .catch(() => setLoadError('Could not reach the server to load your job postings.'))
      .finally(() => setJobsLoaded(true));
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Who applied to each vacancy, counted from the school's real candidates.
  const peopleByJob = useMemo(() => {
    const map = new Map<string, ReturnType<typeof countByTab> & { total: number }>();
    for (const job of jobs) {
      const people = candidates.filter((c) => appliedTo(c, job));
      map.set(job.id, { ...countByTab(people), total: people.length });
    }
    return map;
  }, [jobs, candidates]);

  const copyInvite = (job: PublicVacancy) => {
    // A public link anyone can apply through, not a per-teacher assessment code.
    const link = `${window.location.origin}/jobs/${job.id}`;
    const msg = `*Teaching vacancy • ${school?.name || 'Our school'}*\n\nDear Educator,\n\nWe are hiring for *${job.title}*${job.branch ? ` (${job.branch})` : ''}.\n\n👉 Apply here: ${link}\n⏱️ The online assessment takes about 60–75 minutes: a short profile, a written test, and two short videos.`;
    navigator.clipboard.writeText(msg);
    setCopiedJobId(job.id);
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/jobs/${deleting.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(data.error || 'Could not delete the vacancy. Try again.');
        return;
      }
      setJobs((prev) => prev.filter((j) => j.id !== deleting.id));
      toast(`Deleted "${deleting.title}".`, 'success');
      setDeleting(null);
    } catch {
      setDeleteError('Could not reach the server. Check your connection and try again.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesBranch = selectedBranch === 'ALL' || (j.branch || '').toLowerCase().includes(selectedBranch.toLowerCase());
    const q = searchQuery.toLowerCase();
    const matchesSearch = j.title.toLowerCase().includes(q) || j.subject.toLowerCase().includes(q);
    return matchesBranch && matchesSearch;
  });

  const openJobs = jobs.filter((j) => j.status !== 'closed');
  const totals = jobs.reduce(
    (acc, j) => {
      const p = peopleByJob.get(j.id);
      acc.applicants += p?.total ?? 0;
      acc.ready += p?.ready ?? 0;
      acc.shortlisted += (p?.shortlisted ?? 0) + (p?.selected ?? 0);
      return acc;
    },
    { applicants: 0, ready: 0, shortlisted: 0 }
  );
  const campusCount = new Set(openJobs.map((j) => j.branch).filter(Boolean)).size;

  return (
    <div>
      <AIJobGeneratorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onJobCreated={() => loadJobs()}
      />

      {editing && (
        <EditVacancyModal
          job={editing}
          branches={school?.branches ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setJobs((prev) => prev.map((j) => (j.id === saved.id ? saved : j)));
            setEditing(null);
            toast('Vacancy updated.', 'success');
          }}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-label="Delete vacancy">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 shrink-0 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center"><AlertTriangle className="w-5 h-5" /></span>
              <div className="space-y-1">
                <h2 className="text-base font-black text-slate-900">Delete this vacancy?</h2>
                <p className="text-sm text-slate-600">
                  <strong className="text-slate-900">{deleting.title}</strong> comes off the job board and its link stops working. This cannot be undone.
                </p>
                {(peopleByJob.get(deleting.id)?.total ?? 0) > 0 && (
                  <p className="text-sm text-slate-600">
                    The {peopleByJob.get(deleting.id)?.total} {peopleByJob.get(deleting.id)?.total === 1 ? 'person' : 'people'} who applied stay in your candidates list.
                  </p>
                )}
                <p className="text-xs text-slate-500">Only want to stop new applications? Close it in Edit instead.</p>
              </div>
            </div>
            {deleteError && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleting(null); setDeleteError(''); }} disabled={deleteBusy} className={buttonClass('secondary')}>Keep it</button>
              <button type="button" onClick={confirmDelete} disabled={deleteBusy} className={buttonClass('danger')}>
                {deleteBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : <><Trash2 className="w-4 h-4" /> Delete vacancy</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <PageHeader
          title="Vacancies"
          description="Post a teaching vacancy. We write the job description and build the test for you."
          actions={
            canManage ? (
              <button type="button" onClick={() => setModalOpen(true)} className={buttonClass('primary')}>
                <Sparkles className="w-4 h-4" /> New vacancy
              </button>
            ) : undefined
          }
        />

        {/* Overview Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Open vacancies</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600">{openJobs.length}</div>
            <span className="text-[11px] text-slate-500 font-medium">
              {campusCount} campus{campusCount === 1 ? '' : 'es'}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Applicants</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">{totals.applicants}</div>
            <span className="text-[11px] text-slate-500 font-medium">Across all vacancies</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Ready to review</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600">{totals.ready}</div>
            <span className="text-[11px] text-slate-500 font-medium">Finished all five stages</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Ready for interview</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-700">{totals.shortlisted}</div>
            <span className="text-[11px] text-slate-500 font-medium">Shortlisted</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold flex-wrap">
            {/* Built from the campuses this school's own postings use. */}
            {['ALL', ...Array.from(new Set(jobs.map((j) => j.branch).filter(Boolean)))].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedBranch === b ? 'brand-primary-btn shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {b === 'ALL' ? 'All Campuses' : b}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search vacancies by title or subject (e.g. Physics, Math)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {loadError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button type="button" onClick={loadJobs} className="font-bold underline shrink-0">Retry</button>
          </div>
        )}

        {jobsLoaded && !loadError && filteredJobs.length === 0 && (
          <div className="p-8 rounded-3xl border-2 border-dashed border-slate-300 text-center text-sm text-slate-500">
            {jobs.length === 0
              ? 'No vacancies yet. Choose New vacancy to post your first one.'
              : 'No postings match this filter or search.'}
          </div>
        )}

        {/* Vacancy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJobs.map((job) => {
            const people = peopleByJob.get(job.id);
            const closed = job.status === 'closed';
            return (
              <div
                key={job.id}
                className={`bg-white p-6 rounded-3xl border shadow-sm space-y-5 flex flex-col justify-between card-hover-lift ${closed ? 'border-slate-200 opacity-90' : 'border-slate-200'}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {job.subject}
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug">{job.title}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${closed ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {closed ? 'Closed' : 'Active'}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(job)}
                            aria-label={`Edit ${job.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeleteError(''); setDeleting(job); }}
                            aria-label={`Delete ${job.title}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-[11px] font-bold cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{job.branch || 'No campus set'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{job.board}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">Exp:</span>
                      <span>{job.experience_required}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">CTC:</span>
                      <strong className="text-slate-900 font-mono">{job.salary_range}</strong>
                    </div>
                  </div>

                  {/* Candidate funnel for this vacancy */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Candidate Funnel</span>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Applied</span>
                        <strong className="text-slate-900 font-mono text-sm">{people?.total ?? 0}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Ready to review</span>
                        <strong className="text-indigo-600 font-mono text-sm">{people?.ready ?? 0}</strong>
                      </div>
                      <div className="p-2 rounded-xl bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Shortlisted</span>
                        <strong className="text-emerald-700 font-mono text-sm">{(people?.shortlisted ?? 0) + (people?.selected ?? 0)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Suite */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => copyInvite(job)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedJobId === job.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                    <span>{copiedJobId === job.id ? 'WhatsApp Invite Copied!' : 'Copy WhatsApp Invite'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <Link
                      href="/candidate/cand_sloka_001"
                      target="_blank"
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <span>Test Suite</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    {/* Opens the candidates who applied for this vacancy, not the school overview. */}
                    <Link
                      href={`/admin/candidates?job=${encodeURIComponent(job.id)}`}
                      className="brand-primary-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <span>View Candidates{people?.total ? ` (${people.total})` : ''}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
