'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Building2, Plus, Sparkles, Search, Filter, Users, Video, 
  BookOpen, CheckCircle2, ArrowRight, Share2, Copy, Check, 
  MessageSquare, ExternalLink, Sliders, ChevronRight, Layers, ArrowLeft,
  Briefcase, Award, Clock, Send
} from 'lucide-react';
import AIJobGeneratorModal from '@/components/admin/AIJobGeneratorModal';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';

interface SchoolJob {
  id: string;
  title: string;
  subject: string;
  segment: string;
  board: string;
  branch: string;
  experience: string;
  salary: string;
  applicants: number;
  video_completed: number;
  shortlisted: number;
  status: 'active' | 'closed';
  created_date: string;
}


export default function SchoolJobsPage() {
  // Starts empty, not the 4 demo listings (with fabricated applicant/
  // shortlist counts) that used to sit there permanently for any school
  // with zero real postings — `if (mapped.length) setJobs(mapped)` below
  // only ever overwrote the demo data when the real list was non-empty, so
  // a genuinely new school with no jobs yet saw someone else's fake
  // pipeline stats presented as its own, forever.
  const [jobs, setJobs] = useState<SchoolJob[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [school, setSchool] = useState<{ name: string; branches?: unknown[] } | null>(null);

  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  useEffect(() => {
    fetch(`/api/schools?school_id=${schoolId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.school) setSchool(d.school); })
      .catch(() => {});
  }, [schoolId]);

  const loadJobs = () => {
    fetch(`/api/jobs?school_id=${schoolId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadError(data.error || `Could not load your job postings (${res.status}).`);
          return;
        }
        setLoadError('');
        const mapped: SchoolJob[] = (data.jobs || []).map((j: any) => ({
          id: j.id,
          title: j.title,
          subject: j.subject,
          segment: j.segment,
          board: j.board,
          branch: j.branch,
          experience: j.experience_required,
          salary: j.salary_range,
          // Not wired up to real candidate counts yet — 0 is an honest
          // "not tracked", not the fabricated 14/6/3-style figures the
          // demo listings carried.
          applicants: 0,
          video_completed: 0,
          shortlisted: 0,
          status: j.status || 'active',
          created_date: j.posted_date || 'Just now'
        }));
        setJobs(mapped);
      })
      .catch(() => setLoadError('Could not reach the server to load your job postings.'))
      .finally(() => setJobsLoaded(true));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleJobCreated = (newJob: any) => {
    const formatted: SchoolJob = {
      id: newJob.id,
      title: newJob.title,
      subject: newJob.subject,
      segment: newJob.segment,
      board: newJob.board,
      branch: newJob.branch,
      experience: newJob.experience_required,
      salary: newJob.salary_range,
      applicants: 0,
      video_completed: 0,
      shortlisted: 0,
      status: 'active',
      created_date: 'Just now'
    };
    setJobs([formatted, ...jobs]);
  };

  const copyInvite = (job: SchoolJob) => {
    // A public link anyone can apply through, not a per-teacher assessment code
    // (the old text invented one that no teacher could use).
    const link = `${window.location.origin}/jobs/${job.id}`;
    const msg = `*Teaching vacancy • ${school?.name || 'Our school'}*\n\nDear Educator,\n\nWe are hiring for *${job.title}*${job.branch ? ` (${job.branch})` : ''}.\n\n👉 Apply here: ${link}\n⏱️ The online assessment takes about 60–75 minutes: a short profile, a written test, and two short videos.`;
    navigator.clipboard.writeText(msg);
    setCopiedJobId(job.id);
    setTimeout(() => setCopiedJobId(null), 2000);
  };

  const filteredJobs = jobs.filter(j => {
    const matchesBranch = selectedBranch === 'ALL' || j.branch.toLowerCase().includes(selectedBranch.toLowerCase());
    const matchesSearch = j.title.toLowerCase().includes(searchQuery.toLowerCase()) || j.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesBranch && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-10">
      <AIJobGeneratorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onJobCreated={handleJobCreated}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="text-xs font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>← Back to Recruiter workspace</span>
          </Link>

          <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
            {school?.name || 'Your school'}{school?.branches?.length ? ` • ${school.branches.length} campus${school.branches.length === 1 ? '' : 'es'}` : ''}
          </span>
        </div>

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Campus Faculty Vacancies
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl font-medium">
              Create board-calibrated job descriptions, automatically build 5-stage assessment rubrics, and generate instant WhatsApp candidate invites for each campus branch.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="brand-primary-btn px-6 py-3.5 rounded-2xl text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate New Vacancy with AI →</span>
          </button>
        </div>

        {/* Overview Stats Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Open Teaching Roles</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600">{jobs.length}</div>
            <span className="text-[11px] text-slate-500 font-medium">Across 3 Campuses</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Applicants Screened</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
              {jobs.reduce((acc, j) => acc + j.applicants, 0)}
            </div>
            <span className="text-[11px] text-emerald-600 font-bold">100% AI Rubric Evaluated</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">5-Min Video Demos Scored</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600">
              {jobs.reduce((acc, j) => acc + j.video_completed, 0)}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Chalkboard Vision Analyzed</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Ready for leadership interview</span>
            <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-700">
              {jobs.reduce((acc, j) => acc + j.shortlisted, 0)}
            </div>
            <span className="text-[11px] text-emerald-600 font-bold">Top 5% Faculty Pool</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold flex-wrap">
            {/* Built from whichever campuses this school's own postings
                actually use — this used to be hardcoded to
                Manneguda/Tukkuguda/Vikarabad, the seeded demo school's
                campuses, which any other school couldn't filter by at all
                since none of their real branches would ever match. */}
            {['ALL', ...Array.from(new Set(jobs.map((j) => j.branch).filter(Boolean)))].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBranch(b)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedBranch === b
                    ? 'brand-primary-btn shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
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
              onChange={e => setSearchQuery(e.target.value)}
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
              ? "No vacancies posted yet — use \"AI Vacancy Generator\" above to create your first one."
              : 'No postings match this filter or search.'}
          </div>
        )}

        {/* Vacancy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 flex flex-col justify-between card-hover-lift"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {job.subject}
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                      {job.title}
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 font-medium">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{job.branch}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{job.board}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono">Exp:</span>
                    <span>{job.experience}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-mono">CTC:</span>
                    <strong className="text-slate-900 font-mono">{job.salary}</strong>
                  </div>
                </div>

                {/* Candidate Pipeline Mini Visual */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Candidate Funnel</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Applied</span>
                      <strong className="text-slate-900 font-mono text-sm">{job.applicants}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Video Demo</span>
                      <strong className="text-indigo-600 font-mono text-sm">{job.video_completed}</strong>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">Shortlisted</span>
                      <strong className="text-emerald-700 font-mono text-sm">{job.shortlisted}</strong>
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
                    href={`/candidate/cand_sloka_001`}
                    target="_blank"
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                  >
                    <span>Test Suite</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  <Link
                    href="/admin"
                    className="brand-primary-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <span>View Candidates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
