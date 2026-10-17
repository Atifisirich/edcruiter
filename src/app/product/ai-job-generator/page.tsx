'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Sparkles, ArrowRight, CheckCircle2, ShieldCheck, FileText, 
  BookOpen, Video, Users, Check, MessageSquare, Copy, Sliders
} from 'lucide-react';
import AIJobGeneratorModal from '@/components/admin/AIJobGeneratorModal';

export default function AIJobGeneratorProductPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="w-full min-h-screen py-16 sm:py-24 bg-slate-50/50 dark:bg-transparent text-zinc-900 dark:text-zinc-100">
      <AIJobGeneratorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>AI School Vacancy & Question Studio</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white">
            Generate School JDs &amp; Tests <br />
            <span className="text-orange-600 dark:text-orange-400">in 30 Seconds with AI</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Stop spending hours drafting job posts. Define your subject and board criteria once, and let AI generate the job description, qualification thresholds (M.Sc, B.Ed, CTET), diagnostic MCQs, and 5-minute micro-teaching video prompts.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="brand-primary-btn px-7 py-3.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch AI Job Generator Demo →</span>
            </button>

            <Link
              href="/contact#book-demo"
              className="secondary-nav-btn px-6 py-3.5 rounded-xl text-xs font-bold shadow-xs"
            >
              Book a demo
            </Link>
          </div>
        </div>

        {/* 3 Step Interactive Workflow Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
              01
            </div>
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">Define Role & Board Criteria</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Select academic subject, school segment (Primary to Senior Secondary), board framework (CBSE, Cambridge IGCSE, ICSE, IB), and target campus.
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
              02
            </div>
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">Instant JD & Rubric Creation</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              AI crafts comprehensive job descriptions with mandatory degree criteria, classroom responsibilities, Bloom&apos;s Taxonomy rubrics, and salary benchmarks.
            </p>
          </div>

          <div className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
              03
            </div>
            <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">Auto-Generate 5-Stage Test</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Instantly provisions the candidate assessment link with role-tailored diagnostic MCQs and a 5-minute chalkboard micro-teaching video prompt.
            </p>
          </div>
        </div>

        {/* Live CTA Section */}
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900 text-white border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-left">
            <h3 className="text-2xl sm:text-3xl font-black text-white">Ready to automate your school hiring pipeline?</h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
              Eliminate manual job post writing and create tailored teacher assessments with calibrated AI rubrics.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="brand-primary-btn px-8 py-4 rounded-2xl font-bold text-xs shadow-lg cursor-pointer whitespace-nowrap"
          >
            Try AI Generator Now →
          </button>
        </div>

      </div>
    </div>
  );
}
