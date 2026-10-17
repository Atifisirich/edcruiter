'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Video, ShieldCheck, BookOpen, Users, Award, Zap, 
  Sparkles, CheckCircle2, ArrowRight, Play, Eye, Sliders, 
  IndianRupee, Lock, Check, ShieldAlert, Cpu, BarChart3, Clock,
  Mic, Volume2, CheckCircle, CloudUpload
} from 'lucide-react';

export default function BentoGridFeatures() {
  // Cell 5: Live CTC Calculation Slider State
  const [sliderLPA, setSliderLPA] = useState<number>(7.8);

  const annualNum = Math.round(sliderLPA * 100000);
  const monthlyGross = Math.round(annualNum / 12);
  const basicSalary = Math.round(monthlyGross * 0.5);
  const hra = Math.round(monthlyGross * 0.25);
  const specialAllowance = Math.round(monthlyGross * 0.15);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>Core Capabilities</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
          Engineered for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Pedagogical Rigor</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          Modular technology stack powering automated teacher evaluations, anti-cheating vision, and executive hiring.
        </p>
      </div>

      {/* 6-Cell Bento Grid Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* ========================================================================= */}
        {/* BENTO CELL 1: (8 Cols) 5-Minute Micro-Teaching Evaluation */}
        {/* ========================================================================= */}
        <div className="md:col-span-8 bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400 border border-pink-200 dark:border-pink-800 uppercase">
                Video AI
              </span>
              <span className="text-xs font-mono text-slate-500 font-bold">Edcruiter AI multimodal analysis</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              5-Minute Chalkboard &amp; Smartboard Micro-Teaching Evaluation
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
              Candidates teach a core syllabus concept on camera. The AI evaluates speech fluency, questioning density, vocabulary scaffolding, and body language against Danielson Domain 3.
            </p>
          </div>

          {/* Video Evaluation Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-4 shadow-xs">
            
            {/* Top Candidate & Score Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                  <Play className="w-4 h-4 ml-0.5 fill-white" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white">Secondary Physics: Electromagnetic Induction</div>
                  <div className="text-[11px] text-slate-500 font-medium">Dr. Priya Nair (PGT Candidate)</div>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                Score: 9.6 / 10
              </span>
            </div>

            {/* Audio Waveform & Speech Density */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 font-semibold">
                <span>00:00 (Faraday Demo)</span>
                <span>02:30 (Lenz Law Proof)</span>
                <span>05:00 (Exit Question)</span>
              </div>

              {/* Waveform Container */}
              <div className="flex items-end gap-1.5 h-12 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                {[30, 55, 35, 75, 90, 60, 45, 80, 95, 50, 40, 70, 85, 60, 75, 90, 55, 35, 65, 80, 95, 60, 45, 75, 85, 50, 35, 65, 80, 85, 45, 30].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-indigo-600 to-blue-500 rounded-full transition-all"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>

            {/* 3 Clear Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono pt-1">
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <span className="text-slate-600 dark:text-slate-400">Vocal Clarity:</span>
                <strong className="text-slate-900 dark:text-white">98%</strong>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <span className="text-slate-600 dark:text-slate-400">Questions:</span>
                <strong className="text-slate-900 dark:text-white">5 Prompted</strong>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-xs">
                <span className="text-slate-600 dark:text-slate-400">Misconceptions:</span>
                <strong className="text-emerald-700 dark:text-emerald-400">✓ Addressed</strong>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 font-semibold">Zero-video guard enforces 0/10 if unrecorded</span>
            <Link href="/product/ai-video-interview" className="text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 hover:underline">
              Explore Video Engine →
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BENTO CELL 2: (4 Cols) Anti-Cheating Shield */}
        {/* ========================================================================= */}
        <div className="md:col-span-4 bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase">
              Integrity Shield
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              MediaPipe Vision &amp; Gaze Tracking
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Client-side neural mesh analyzes gaze saccades, secondary devices, and full-screen compliance in real time.
            </p>
          </div>

          {/* Telemetry Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Gaze Stability:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">99.4% Verified</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Secondary Phone:</span>
              <span className="text-slate-900 dark:text-white font-bold">0 Detected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Fullscreen Mode:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">Enforced</span>
            </div>
          </div>

          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-400 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
            <span>Audio synthesis warns on gaze loss</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BENTO CELL 3: (4 Cols) 5-Part Lesson Plan Builder */}
        {/* ========================================================================= */}
        <div className="md:col-span-4 bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase">
              Lesson Architecture
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              5-Part Structured Lesson Plan Engine
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enforces deep inquiry scaffolding rather than generic essay answers.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-800 dark:text-slate-300 font-semibold">1. Misconception Proof</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">✓ SMART</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-800 dark:text-slate-300 font-semibold">2. 35-Min Pacing</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">✓ Chrono</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-800 dark:text-slate-300 font-semibold">3. 3-Tier Differentiation</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">✓ 3 Tiers</span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-slate-800 dark:text-slate-300 font-semibold">4. Diagnostic Exit Ticket</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">✓ 2 Qs</span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Zero mock fallbacks submitted when fields are blank.
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BENTO CELL 4: (4 Cols) 3-Stage Reviewer Clearance */}
        {/* ========================================================================= */}
        <div className="md:col-span-4 bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase">
              Clearance Pipeline
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              3-Stage Multi-Reviewer Pipeline
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Conflict-free clearance routing across Reporting Managers, Institute Heads, and Final Decision Makers.
            </p>
          </div>

          {/* Stepper Visual */}
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">1</span>
                <span className="font-bold text-slate-900 dark:text-white">RM HOD Review</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 font-bold">Cleared</span>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                <span className="font-bold text-slate-900 dark:text-white">Institute Head</span>
              </div>
              <span className="text-[10px] font-mono text-indigo-700 dark:text-indigo-400 font-bold">Cleared</span>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                <span className="font-bold text-slate-900 dark:text-white">Final Offer Clearance</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">Ready</span>
            </div>
          </div>

          <Link href="/reviewer/rm" className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
            Access Reviewer Panel →
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* BENTO CELL 5: (4 Cols) 1-Click Automated Offer Letter with Live CTC Slider */}
        {/* ========================================================================= */}
        <div className="md:col-span-4 bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
          <div className="space-y-2">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 uppercase">
              Offer Composer
            </span>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              Interactive Offer Letter Generator
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Drag salary below to simulate real-time compensation breakdown and instant dispatch.
            </p>
          </div>

          {/* Live Interactive CTC Slider */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-bold">Annual CTC:</span>
              <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{sliderLPA.toFixed(1)} LPA</span>
            </div>

            <input
              type="range"
              min="4.5"
              max="16.0"
              step="0.5"
              value={sliderLPA}
              onChange={e => setSliderLPA(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />

            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono pt-1">
              <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-500 block font-semibold">Monthly Gross</span>
                <strong className="text-slate-900 dark:text-white">₹{monthlyGross.toLocaleString('en-IN')}</strong>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-xs">
                <span className="text-slate-500 block font-semibold">Basic (50%)</span>
                <strong className="text-slate-900 dark:text-white">₹{basicSalary.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10.5px] text-emerald-700 dark:text-emerald-400 font-bold text-center">
            Instant PDF &amp; WhatsApp dispatch enabled
          </div>
        </div>

      </div>

    </div>
  );
}
