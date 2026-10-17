'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Video, Play, Sparkles, CheckCircle2, ShieldCheck, 
  Mic, Eye, Award, ArrowRight, Clock, Users
} from 'lucide-react';

export default function AIVideoInterviewProductPage() {
  return (
    <div className="w-full min-h-screen py-16 sm:py-24 bg-slate-50/50 dark:bg-transparent text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
            <Video className="w-3.5 h-3.5 text-orange-500" />
            <span>Asynchronous AI Video Pedagogy</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white">
            5-Minute Micro-Teaching <br />
            <span className="text-orange-600 dark:text-orange-400">Evaluated on Camera</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Candidates record a 5-minute chalkboard or smartboard teaching demo on a syllabus topic. Edcruiter AI evaluates speech fluency, questioning density, vocabulary scaffolding, and body language against Danielson Domain 3.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/candidate/cand_sloka_001"
              className="brand-primary-btn px-7 py-3.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2"
            >
              <span>Experience Video Demo Assessment →</span>
            </Link>
            <Link
              href="/contact#book-demo"
              className="secondary-nav-btn px-6 py-3.5 rounded-xl text-xs font-bold shadow-xs"
            >
              Book a demo
            </Link>
          </div>
        </div>

        {/* Video Intelligence Showcase Card */}
        <div className="glass-card video-stroked p-6 sm:p-10 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Video Player Mockup */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-800 shadow-xl">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 rounded-full bg-orange-600 text-white flex items-center justify-center mx-auto shadow-lg">
                    <Play className="w-6 h-6 ml-0.5 fill-white" />
                  </div>
                  <h4 className="text-sm font-bold text-white">Secondary Physics: Electromagnetic Induction</h4>
                  <p className="text-xs text-zinc-400 font-mono">Dr. Priya Nair (PGT Candidate)</p>
                </div>

                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>MediaPipe Eye Gaze Guard Active</span>
                </div>
              </div>

              {/* Audio Waveform */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <span>00:00 (Inquiry Hook)</span>
                  <span>02:30 (Lenz Law Proof)</span>
                  <span>05:00 (Diagnostic Question)</span>
                </div>
                <div className="flex items-end gap-1.5 h-10 p-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800">
                  {[25, 45, 65, 85, 95, 70, 50, 80, 90, 60, 40, 75, 85, 95, 65, 55, 80, 90, 75, 60, 85, 95, 70, 50, 65, 85, 75, 50].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-orange-600 to-orange-400 rounded-full"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* AI Rubric Breakdown */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-orange-700 dark:text-orange-400 block">Overall Pedagogy Score</span>
                  <strong className="text-xl font-black font-mono text-zinc-900 dark:text-white">9.6 / 10</strong>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300">
                  Top 5% Faculty
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Voice Projection &amp; Fluency</span>
                    <strong className="text-orange-600 font-mono">9.8 / 10</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">142 words/min pace; zero verbal fillers or monotone delivery.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Questioning Density (Danielson 3b)</span>
                    <strong className="text-orange-600 font-mono">9.4 / 10</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">4.2 Socratic questions/min prompting active student response.</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">Misconception Diagnosis</span>
                    <strong className="text-orange-600 font-mono">9.6 / 10</strong>
                  </div>
                  <p className="text-[11px] text-zinc-500">Isolated 3rd Law equal-opposite cancel misconception with isolated FBDs.</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 4 Pillars of Video AI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <Mic className="w-6 h-6 text-orange-500" />
            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Acoustic &amp; Vocal Scored</h4>
            <p className="text-xs text-zinc-500">Analyzes modulation, pitch variation, and English clarity.</p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <Eye className="w-6 h-6 text-orange-500" />
            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">MediaPipe Vision Guard</h4>
            <p className="text-xs text-zinc-500">Continuous 3D eye gaze mesh prevents reading from secondary screens.</p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <Clock className="w-6 h-6 text-orange-500" />
            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Strict 5-Minute Cap</h4>
            <p className="text-xs text-zinc-500">Enforces lesson pacing and conciseness, exactly like real classroom periods.</p>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
            <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">Zero-Video Guard</h4>
            <p className="text-xs text-zinc-500">Automatically fails blank submissions (0/10) to prevent mock bypasses.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
