'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, ShieldCheck, Video, ScanSearch, ClipboardCheck, 
  ChartColumn, ArrowRight, CheckCircle2, Lock, Users, BookOpen, Layers, Eye
} from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          <span>Complete Platform Capabilities</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
          AI Teacher Assessment & Screening Engine
        </h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          Built specifically to evaluate subject depth, teaching pedagogy, classroom management, and communication fluency.
        </p>
      </div>

      {/* Feature Deep Dives */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Feature 1 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold border border-orange-200 dark:border-orange-500/30">
            <ScanSearch className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">AI Candidate Screening</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Automatically parses applicant resumes, qualifications (M.Sc., B.Ed.), and teaching experience to rank role readiness before manual review starts.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Subject & grade segment matching</li>
            <li>Prior institution reputation scoring</li>
            <li>Shortlist readiness signals</li>
          </ul>
        </div>

        {/* Feature 2 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold border border-amber-200 dark:border-amber-500/30">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Pedagogy Video Analysis</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Candidates record a 5-minute teaching demonstration on camera. Edcruiter evaluates subject clarity, vocabulary, sentence structure, and eye contact.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Audio speech-to-text transcription</li>
            <li>Fluency & grammar confidence scoring</li>
            <li>Video playback player for hiring panels</li>
          </ul>
        </div>

        {/* Feature 3 */}
        <div id="proctoring" className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold border border-emerald-200 dark:border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Camera on during the test</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Teachers keep the camera on so the test stays fair. We flag if someone else is in the room, if they look away a lot, or if they leave the test tab. This is sometimes called “proctoring”.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Live face detection & boundary check</li>
            <li>Proctoring integrity audit log</li>
            <li>Flagged anomaly alerts on candidate report card</li>
          </ul>
        </div>

        {/* Feature 4 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold border border-blue-200 dark:border-blue-500/30">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Structured Scorecard Rubrics</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Replaces informal gut-feel hiring with shared multi-stage rubrics for Reporting Managers, Subject Experts, and Principal interview rounds.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Subject knowledge & conceptual clarity</li>
            <li>Classroom management ability</li>
            <li>Standardized 1-10 scoring sliders</li>
          </ul>
        </div>

        {/* Feature 5 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold border border-purple-200 dark:border-purple-500/30">
            <ChartColumn className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Pipeline Analytics & Insights</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            School administrators see stage conversion rates, drop-off points, subject score distributions, and time-to-hire metrics in real time.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Stage-by-stage funnel visualization</li>
            <li>Branch-wise recruitment tracking</li>
            <li>Exportable CSV hiring summaries</li>
          </ul>
        </div>

        {/* Feature 6 */}
        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center font-bold border border-slate-300 dark:border-zinc-700">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Role-Based Multi-Reviewer Flow</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Separate dashboards for School Admins, Reporting Managers (HODs), Institute Heads, and Final Decision Makers with permission controls.
          </p>
          <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <li>Individual reviewer notes & scorecards</li>
            <li>Conflict-free multi-stage clearance</li>
            <li>Role-specific access enforcement</li>
          </ul>
        </div>

      </div>

      {/* Bottom CTA */}
      <div className="glass-card p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-6 shadow-xl">
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">
          Ready to Modernize Your School&apos;s Teacher Hiring?
        </h2>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          Start assessing candidates with AI proctoring and video pedagogy evaluations today.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/school/setup"
            className="brand-primary-btn px-8 py-3 rounded-xl text-xs font-bold shadow-lg"
          >
            <span>Onboard Your School</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
          <Link
            href="/contact#book-demo"
            className="px-8 py-3 rounded-xl text-xs font-bold secondary-nav-btn transition-all"
          >
            Call for a quote
          </Link>
        </div>
      </div>

    </div>
  );
}
