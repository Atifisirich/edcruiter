'use client';

import React from 'react';
import Link from 'next/link';
import { 
  BarChart3, CheckCircle2, ShieldCheck, Video, Users, 
  Sparkles, ArrowRight, Award, FileText, IndianRupee, Clock
} from 'lucide-react';

export default function CandidateReportsProductPage() {
  return (
    <div className="w-full min-h-screen py-16 sm:py-24 bg-slate-50/50 dark:bg-transparent text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
            <BarChart3 className="w-3.5 h-3.5 text-orange-500" />
            <span>360° Candidate Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white">
            Objective Candidate Reports <br />
            <span className="text-orange-600 dark:text-orange-400">with Full Verification</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Eliminate subjective hiring debates. Every candidate profile includes synchronized 5-minute video playback, lesson plan artifacts, AI rubric scores, anti-cheating audit trails, and multi-reviewer clearance signoffs.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact#book-demo"
              className="brand-primary-btn px-7 py-3.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <span>Book a demo →</span>
            </Link>
            <Link
              href="/reviewer/rm"
              className="secondary-nav-btn px-6 py-3.5 rounded-xl text-xs font-bold shadow-xs"
            >
              View Reviewer Panel
            </Link>
          </div>
        </div>

        {/* 360° Report Card Visual Matrix */}
        <div className="glass-card p-6 sm:p-10 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl space-y-8">
          
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-xl">
                P
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Dr. Priya Nair</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30">
                    Physics
                  </span>
                </div>
                <p className="text-xs text-zinc-500">Senior PGT Physics • 4.5 Yrs Exp (M.Sc, B.Ed) • Manneguda Campus</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Total AI Score</span>
                <span className="text-xl font-black font-mono text-orange-600 dark:text-orange-400">94 / 100</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Proctoring Trust</span>
                <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">99.4%</span>
              </div>
            </div>
          </div>

          {/* 3 Columns Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Video & Transcripts */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <span className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-orange-500" />
                1. Synchronized Micro-Teaching Video
              </span>
              <div className="aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center text-white text-xs border border-zinc-800">
                04:18 / 05:00 • Topic: Newton&apos;s 3rd Law &amp; FBDs
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                &ldquo;...To remediate, I draw two distinct free-body diagrams proving forces act on separate bodies (m1 vs m2)...&rdquo;
              </div>
            </div>

            {/* Column 2: 5-Part Lesson Plan Rubric */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <span className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-orange-500" />
                2. 5-Part Structured Lesson Plan
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span>Misconception Diagnosis:</span>
                  <strong className="text-orange-600 font-mono">9.6 / 10</strong>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span>35-Min Lesson Pacing:</span>
                  <strong className="text-orange-600 font-mono">9.4 / 10</strong>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span>3-Tier Differentiation:</span>
                  <strong className="text-orange-600 font-mono">9.5 / 10</strong>
                </div>
                <div className="flex justify-between p-2 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700">
                  <span>Diagnostic Exit Ticket:</span>
                  <strong className="text-orange-600 font-mono">9.2 / 10</strong>
                </div>
              </div>
            </div>

            {/* Column 3: 3-Person Clearances */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <span className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-orange-500" />
                3. 3-Person Multi-Reviewer Trail
              </span>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-300 block">Stage 1: RM HOD Review</strong>
                    <span className="text-[10px] text-zinc-500">Dr. K. Swaminathan (★ 5/5)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 font-mono">CLEARED</span>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-300 block">Stage 2: Principal Review</strong>
                    <span className="text-[10px] text-zinc-500">Mrs. R. Sharma (★ 5/5)</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 font-mono">CLEARED</span>
                </div>

                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-500/30 flex justify-between items-center">
                  <div>
                    <strong className="text-orange-800 dark:text-orange-300 block">Stage 3: COO Offer Letter</strong>
                    <span className="text-[10px] text-zinc-500">₹7.8 LPA Package</span>
                  </div>
                  <span className="text-[10px] font-bold text-orange-600 font-mono">READY</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
