'use client';

import React from 'react';
import Link from 'next/link';
import { 
  FileText, Video, Link2, ChartColumn, CheckCircle2, ArrowRight, 
  Sparkles, ShieldCheck, Clock, Users, Play, Award, Check
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>Complete Workflow Guide</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
          How Edcruiter Works for Schools & Candidates
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          From posting a vacancy to a fair test (camera on so the test is honest), a report, and an offer — five plain steps for schools.
        </p>
      </div>

      {/* 5-Step Detailed Breakdown */}
      <div className="space-y-6">
        
        {/* Step 1 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="lg:col-span-2 text-center lg:text-left">
            <span className="text-5xl font-mono font-black text-orange-600 dark:text-orange-400">01</span>
          </div>
          <div className="lg:col-span-6 space-y-2">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
              <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" /> 
              <span>Create Job Posting & Requirements</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              School leaders specify the subject (e.g. Physics), grade levels (Grades 9-10), minimum qualifications (M.Sc., B.Ed.), and target campus branch. Setup takes less than 2 minutes.
            </p>
          </div>
          <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="text-orange-600 dark:text-orange-400 font-bold">Input Signals:</div>
            <div className="text-zinc-700 dark:text-zinc-300">● CBSE & Cambridge Curriculum</div>
            <div className="text-zinc-700 dark:text-zinc-300">● 2-5 Years Teaching Experience</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Smart Job Post Link Active</div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="lg:col-span-2 text-center lg:text-left">
            <span className="text-5xl font-mono font-black text-amber-600 dark:text-amber-400">02</span>
          </div>
          <div className="lg:col-span-6 space-y-2">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
              <Video className="w-6 h-6 text-amber-600 dark:text-amber-400" /> 
              <span>Configure AI Assessment & Demo Prompts</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Select or customize AI-scored subject MCQs, pedagogy questions, and a 5-minute video teaching demo prompt where candidates present a key lesson on camera.
            </p>
          </div>
          <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="text-amber-600 dark:text-amber-400 font-bold">Evaluation Rubrics:</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Subject MCQ Depth (40%)</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Video Teaching Demo (40%)</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Lesson Plan & Scaffolding (20%)</div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="lg:col-span-2 text-center lg:text-left">
            <span className="text-5xl font-mono font-black text-blue-600 dark:text-blue-400">03</span>
          </div>
          <div className="lg:col-span-6 space-y-2">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
              <Link2 className="w-6 h-6 text-blue-600 dark:text-blue-400" /> 
              <span>Share Single Assessment URL</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Publish the generated assessment link across job boards, school websites, and WhatsApp outreach. Candidates take the 25-minute proctored test on any smartphone or PC.
            </p>
          </div>
          <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="text-blue-600 dark:text-blue-400 font-bold">Distribution Reach:</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Mobile-Optimized Self-Serve Test</div>
            <div className="text-zinc-700 dark:text-zinc-300">● MediaPipe AI Gaze Proctoring</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Instant Verification & Upload</div>
          </div>
        </div>

        {/* Step 4 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="lg:col-span-2 text-center lg:text-left">
            <span className="text-5xl font-mono font-black text-emerald-600 dark:text-emerald-400">04</span>
          </div>
          <div className="lg:col-span-6 space-y-2">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
              <ChartColumn className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> 
              <span>Automated AI Shortlisting & Score Totals</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Edcruiter AI analyzes the candidate&apos;s lesson plan, video body language, and answers against your school rubric. The school admin dashboard aggregates total scores (out of 100) and enables 1-click shortlisting.
            </p>
          </div>
          <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="text-emerald-600 dark:text-emerald-400 font-bold">Generated Artifacts:</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Total AI Score (0-100)</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Video Transcript & Tags</div>
            <div className="text-zinc-700 dark:text-zinc-300">● Integrity Trust Index (0-100)</div>
          </div>
        </div>

        {/* Step 5 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm hover:shadow-md transition-shadow">
          <div className="lg:col-span-2 text-center lg:text-left">
            <span className="text-5xl font-mono font-black text-purple-600 dark:text-purple-400">05</span>
          </div>
          <div className="lg:col-span-6 space-y-2">
            <h3 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
              <Users className="w-6 h-6 text-purple-600 dark:text-purple-400" /> 
              <span>3-Tier Reviewer Clearance & Offer Release</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Shortlisted candidates are reviewed through live Google Meet rounds by the Reporting Manager, Institute Head, and Final Decision Maker, concluding with 1-click automated offer letter generation.
            </p>
          </div>
          <div className="lg:col-span-4 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="text-purple-600 dark:text-purple-400 font-bold">Clearance Flow:</div>
            <div className="text-zinc-700 dark:text-zinc-300">● 1. RM HOD Review & Clearance</div>
            <div className="text-zinc-700 dark:text-zinc-300">● 2. Institute Head Approval</div>
            <div className="text-zinc-700 dark:text-zinc-300">● 3. 1-Click Offer Letter Dispatch</div>
          </div>
        </div>

      </div>

      {/* Bottom CTA */}
      <div className="glass-card p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-6 shadow-xl">
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">
          Try the Complete 5-Stage Assessment Today
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Start hiring the top 1% of school faculty with structured AI assessments.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/school/setup"
            className="brand-primary-btn px-8 py-3 rounded-xl text-xs font-bold shadow-lg"
          >
            <span>Onboard Your School</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
        </div>
      </div>

    </div>
  );
}
