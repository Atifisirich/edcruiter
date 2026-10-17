'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, FileText, Video, Award, Layers, Send, CheckCircle2, 
  ArrowRight, ShieldCheck, Check, Clock, TrendingUp, BarChart3, 
  Brain, Mic, Play, Eye, Users, BookOpen, GraduationCap, Zap
} from 'lucide-react';
import Link from 'next/link';

interface ServiceItem {
  id: string;
  badge: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgLight: string;
  borderColor: string;
  stats: { label: string; value: string }[];
  previewComponent: React.ReactNode;
}

export default function DynamicServicesShowcase() {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);

  const services: ServiceItem[] = [
    {
      id: 'ai-screening',
      badge: 'B.Ed & M.Sc Resume Intelligence',
      title: 'Automated Academic Resume Screening',
      tagline: 'Match teacher qualifications against board standards in seconds',
      description: 'Extracts university degrees, B.Ed certifications, CTET scores, and subject teaching experience against CBSE, Cambridge IGCSE, and IB syllabus requirements.',
      icon: FileText,
      color: '#2563eb',
      bgLight: '#eff6ff',
      borderColor: '#bfdbfe',
      stats: [
        { label: 'Time Saved', value: '85%' },
        { label: 'Degree Match', value: '99.4%' },
        { label: 'Board Syllabi', value: 'CBSE / Cambridge' }
      ],
      previewComponent: (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Live Resume Screening</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono font-bold text-xs border border-indigo-200">
              CBSE Class 11-12 Physics
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 relative overflow-hidden">
            {/* Animated Scanning Beam */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-[scan-line_2.5s_ease-in-out_infinite]" />

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-900">Dr. Priya Nair</h4>
                <p className="text-[11px] text-slate-500">M.Sc (Physics) • B.Ed (Gold Medalist)</p>
              </div>
              <span className="px-2 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-mono font-black text-xs">
                94% Match
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>B.Ed NCTE Verified</span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>4.5 Yrs CBSE Senior Exp</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 font-medium">Automatic Routing:</span>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200">
              → Invited to 5-Min Video Demo
            </span>
          </div>
        </div>
      )
    },
    {
      id: 'video-audition',
      badge: '5-Minute Chalkboard Vision',
      title: 'AI Micro-Teaching Video Auditions',
      tagline: 'Asynchronous pedagogy evaluation without scheduling clashes',
      description: 'Educators record a 5-minute chalkboard micro-teaching demo. AI evaluates speech pacing (120-140 WPM), voice clarity, conceptual scaffolding, and Danielson Domain 3 standards.',
      icon: Video,
      color: '#ec4899',
      bgLight: '#fdf2f8',
      borderColor: '#fbcfe8',
      stats: [
        { label: 'Demo Duration', value: '5 Mins' },
        { label: 'Danielson Domain', value: 'Domain 3' },
        { label: 'Coordinator Hours Saved', value: '18+ Hrs' }
      ],
      previewComponent: (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Chalkboard Audition Analysis</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-900 font-mono font-bold text-xs">
              Topic: Electromagnetic Induction
            </span>
          </div>

          <div className="relative rounded-2xl bg-slate-900 p-4 text-white space-y-3 overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span className="font-mono text-[11px] text-slate-300">REC 03:42 / 05:00</span>
              </div>
              <span className="text-[10.5px] bg-white/10 px-2 py-0.5 rounded backdrop-blur-xs font-mono">1080p 60fps</span>
            </div>

            {/* Audio Waveform Animation */}
            <div className="flex items-center justify-center gap-1 h-10 py-1">
              {[40, 65, 85, 95, 75, 45, 90, 100, 80, 60, 45, 70, 90, 85, 50, 65, 95, 70, 40].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-pink-400 rounded-full transition-all duration-300 animate-pulse"
                  style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10.5px] pt-1">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-xs">
                <span className="text-slate-400 block">Speech Pace</span>
                <strong className="text-emerald-400 font-mono">132 WPM (Optimal)</strong>
              </div>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-xs">
                <span className="text-slate-400 block">Concept Clarity</span>
                <strong className="text-indigo-300 font-mono">95% (High)</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Danielson Domain 3:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              ✓ Distinguished (Level 4)
            </span>
          </div>
        </div>
      )
    },
    {
      id: 'lesson-plan',
      badge: 'Free-Form Pedagogy Evaluator',
      title: 'Lesson Plan & Scaffolding Rubric',
      tagline: 'Evaluate Bloom’s taxonomy and student-centric learning design',
      description: 'Evaluates free-form teacher lesson plans for clear learning objectives, prior knowledge hooks, differentiated instruction for struggling learners, and formative exit tickets.',
      icon: BookOpen,
      color: '#7c3aed',
      bgLight: '#faf5ff',
      borderColor: '#e9d5ff',
      stats: [
        { label: 'Rubric Criteria', value: '6 Dimensions' },
        { label: 'Bloom Taxonomy', value: 'Automated' },
        { label: 'Format', value: 'Free-Form' }
      ],
      previewComponent: (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Lesson Plan Rubric</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono font-bold text-xs">
              45-Min Class Architecture
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-slate-800">1. Prior Knowledge Hook (5 mins)</span>
                <span className="text-emerald-700 font-mono">10/10</span>
              </div>
              <p className="text-[11px] text-slate-500">Real-world bicycle dynamo demonstration connects concept.</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-slate-800">2. Formative Exit Ticket (10 mins)</span>
                <span className="text-emerald-700 font-mono">9.5/10</span>
              </div>
              <p className="text-[11px] text-slate-500">Tiered 3-question diagnostic assessing Lenz law polarity.</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-slate-500 font-medium">Pedagogy Grade:</span>
            <span className="font-mono font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              Grade A+ (96.5%)
            </span>
          </div>
        </div>
      )
    },
    {
      id: 'leadership-interview',
      badge: 'School leadership interviews',
      title: '360° candidate report & principal interview',
      tagline: 'Give the principal a scored file before they meet the teacher',
      description: 'Credentials, written scores, demo and scenario sit on one page so subject lead, principal, and management can accept or decline with a written reason.',
      icon: Award,
      color: '#4f46e5',
      bgLight: '#eef2ff',
      borderColor: '#c7d2fe',
      stats: [
        { label: 'Decision Speed', value: '24-48 Hrs' },
        { label: 'Principal sign-off', value: 'On file' },
        { label: 'Multi-Campus', value: 'Standardized' }
      ],
      previewComponent: (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">Leadership interview file</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-mono font-bold text-xs">
              Score: 95% Overall
            </span>
          </div>

          <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-emerald-50/70 rounded-2xl border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  PN
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">Dr. Priya Nair</h4>
                  <p className="text-[10.5px] text-slate-500">Manneguda Campus • Senior Secondary</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-[10px] border border-amber-300">
                ⭐ AI Best Match
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">CV Match</span>
                <strong className="text-slate-900 font-mono">94%</strong>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Video Demo</span>
                <strong className="text-pink-600 font-mono">95%</strong>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Lesson Plan</span>
                <strong className="text-purple-600 font-mono">96%</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500 font-medium">Clearance Status:</span>
            <button
              type="button"
              className="px-4 py-1.5 rounded-xl brand-primary-btn text-xs font-bold text-white shadow-xs cursor-pointer"
            >
              Approve for Offer →
            </button>
          </div>
        </div>
      )
    }
  ];

  // Auto-Cycling Progress Bar Effect (5s per tab)
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 50; // Update every 50ms
    const totalTime = 5000; // 5 seconds per slide
    const increment = (intervalTime / totalTime) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveIndex((current) => (current + 1) % services.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, activeIndex, services.length]);

  const handleSelectService = (index: number) => {
    setActiveIndex(index);
    setProgress(0);
  };

  const activeService = services[activeIndex];

  return (
    <section className="w-full py-20 bg-[#fafbfc] border-b border-slate-200 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Section Header */}
        <motion.div 
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Platform Core Capabilities</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            How <span className="text-[#2563eb]">Edcruiter</span> Automates Teacher Recruitment
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            Explore our integrated suite of teacher credential screening, asynchronous chalkboard video auditions, and HOD clearance tools.
          </p>
        </motion.div>

        {/* Dynamic Card Animation Showcase Matrix */}
        <div 
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          
          {/* Left Column: Interactive Service Selector Cards */}
          <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
            {services.map((srv, idx) => {
              const isActive = activeIndex === idx;
              const IconComp = srv.icon;

              return (
                <div
                  key={srv.id}
                  onClick={() => handleSelectService(idx)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                    isActive
                      ? 'bg-white border-indigo-400 shadow-md scale-[1.01]'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Active Progress Bar Timer */}
                  {isActive && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-600 to-blue-500 transition-all duration-75 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  )}

                  <div className="flex items-start gap-3.5">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform"
                      style={{ 
                        backgroundColor: isActive ? srv.color : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#64748b'
                      }}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-indigo-600">
                          {srv.badge}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            Active
                          </span>
                        )}
                      </div>

                      <h3 className={`font-black text-sm leading-snug transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}>
                        {srv.title}
                      </h3>

                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {srv.tagline}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Dynamic Animated Stage Card */}
          <div className="lg:col-span-7 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeService.id}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white p-7 sm:p-9 rounded-3xl border-2 border-slate-200/90 shadow-xl flex-1 flex flex-col justify-between space-y-6"
                style={{ borderColor: activeService.borderColor }}
              >
                
                {/* Header Information */}
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeService.color }} />
                    <span>{activeService.badge}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {activeService.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {activeService.description}
                  </p>
                </div>

                {/* Simulated Dynamic Live UI Widget */}
                <div className="my-2">
                  {activeService.previewComponent}
                </div>

                {/* Bottom Metric Ribbon & Action */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    {activeService.stats.map((st, i) => (
                      <div key={i} className="text-left">
                        <span className="text-[10.5px] text-slate-400 block font-medium">{st.label}</span>
                        <strong className="text-sm font-black text-slate-900 font-mono">{st.value}</strong>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/contact#book-demo"
                    className="brand-primary-btn px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 hover:scale-105 transition-transform"
                  >
                    <span>Book a demo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>
    </section>
  );
}
