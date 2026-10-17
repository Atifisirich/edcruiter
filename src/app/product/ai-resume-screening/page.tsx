'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, CheckCircle2, Sparkles, ArrowRight, ShieldCheck, 
  BookOpen, Award, Check, Search, Sliders, ArrowUpRight
} from 'lucide-react';

export default function AIResumeScreeningPage() {
  const [selectedCandidate, setSelectedCandidate] = useState(0);

  const sampleCandidates = [
    {
      name: 'Dr. Priya Nair',
      role: 'Senior PGT Physics Faculty',
      degrees: ['M.Sc Physics (First Class)', 'B.Ed (Physical Sciences)', 'CTET Qualified'],
      exp: '4.5 Years at Delhi Public School',
      curriculum: 'CBSE & Cambridge IGCSE',
      matchScore: 96,
      reason: '100% match on mandatory M.Sc + B.Ed qualifications, 4+ years CBSE Class 11-12 physics experience, and strong lab safety track record.'
    },
    {
      name: 'Sanjay Mukherjee',
      role: 'TGT Mathematics Lead',
      degrees: ['M.Sc Mathematics', 'B.Ed Mathematics'],
      exp: '6 Years at Oakridge International',
      curriculum: 'CBSE Curriculum',
      matchScore: 92,
      reason: 'Excellent pedagogical credentials with 6 years experience in middle-secondary algebra and geometry scaffolding.'
    },
    {
      name: 'Kavita Deshmukh',
      role: 'Secondary Biology Specialist',
      degrees: ['M.Sc Botany', 'B.Sc Life Sciences'],
      exp: '3 Years at Chaitanya Academy',
      curriculum: 'Cambridge & State Board',
      matchScore: 84,
      reason: 'Strong subject foundation in Botany; flagged for B.Ed completion timeline check.'
    }
  ];

  return (
    <div className="w-full min-h-screen py-16 sm:py-24 bg-slate-50/50 dark:bg-transparent text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
            <FileText className="w-3.5 h-3.5 text-orange-500" />
            <span>AI Resume & Credential Screening</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white">
            Screen Teacher Credentials <br />
            <span className="text-orange-600 dark:text-orange-400">Against Board Standards</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            AI automatically extracts degrees (M.Sc/B.Ed), curriculum exposure (CBSE, Cambridge, ICSE), experience bands, and prior school reputation to generate a ranked shortlist for Department Head review.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact#book-demo"
              className="brand-primary-btn px-7 py-3.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <span>Book a demo →</span>
            </Link>
            <Link
              href="/how-it-works"
              className="secondary-nav-btn px-6 py-3.5 rounded-xl text-xs font-bold shadow-xs"
            >
              How It Works
            </Link>
          </div>
        </div>

        {/* Interactive Screening Demo Matrix */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Interactive Live Demo</span>
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                AI Resume Parsing vs Job Criteria
              </h3>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs">
              {sampleCandidates.map((c, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCandidate(idx)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    selectedCandidate === idx
                      ? 'brand-primary-btn text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {c.name.split(' ')[0]} ({c.matchScore}%)
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Candidate Credentials Card */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{sampleCandidates[selectedCandidate].name}</h4>
                  <p className="text-[11px] text-zinc-500">{sampleCandidates[selectedCandidate].role}</p>
                </div>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-base bg-orange-100 dark:bg-orange-500/20 px-3 py-1 rounded-xl border border-orange-200 dark:border-orange-500/30">
                  {sampleCandidates[selectedCandidate].matchScore}% Match
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-zinc-500 font-bold block text-[10px] uppercase">Parsed Degrees & Certifications:</span>
                <div className="flex flex-wrap gap-1.5">
                  {sampleCandidates[selectedCandidate].degrees.map((d, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-semibold text-zinc-800 dark:text-zinc-200 text-[11px]">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Experience</span>
                  <strong className="text-zinc-900 dark:text-white">{sampleCandidates[selectedCandidate].exp}</strong>
                </div>
                <div>
                  <span className="text-zinc-500 font-bold block text-[10px] uppercase">Board Alignment</span>
                  <strong className="text-zinc-900 dark:text-white">{sampleCandidates[selectedCandidate].curriculum}</strong>
                </div>
              </div>
            </div>

            {/* AI Screening Synthesis */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 shadow-sm">
              <span className="text-[10px] uppercase font-bold text-orange-600 dark:text-orange-400 block tracking-wider">
                Edcruiter AI Screening Report
              </span>

              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono bg-slate-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                &ldquo;{sampleCandidates[selectedCandidate].reason}&rdquo;
              </p>

              <div className="space-y-2 text-xs pt-1">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mandatory M.Sc Degree Verified</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Curriculum Alignment Verified (CBSE / Cambridge)</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cleared for 5-Minute Video &amp; Lesson Assessment</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 3 Core Benefits for School Boards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              ⚡
            </div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Zero Manual Resume Sorting</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Screen hundreds of teacher applicants instantly with precise degree, certification, and board syllabus filters.
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              🎯
            </div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Objective Qualification Scoring</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Ensure consistency across all campuses without human bias or credential oversight.
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              📲
            </div>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Auto-Trigger 5-Stage Test</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Shortlisted candidates automatically receive WhatsApp invite links to complete their proctored test and 5-min demo.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
