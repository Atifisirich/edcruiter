'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Sparkles, ArrowRight, Clock, CheckCircle2, 
  FileText, Users, CalendarCheck2, BarChart3,
  MessageSquare, MessageSquareMore, FileSpreadsheet, Building2,
  Video, Award, Layers, Search, Send
} from 'lucide-react';
import DynamicServicesShowcase from '@/components/home/DynamicServicesShowcase';
import HeroProductCard from '@/components/home/HeroProductCard';
import HeroWorkspaceCard from '@/components/home/HeroWorkspaceCard';
import { HIRING_FLOW_STEPS } from '@/components/home/hiringFlowSteps';

export default function Home() {
  // Subject catalog finder
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('ALL');

  useEffect(() => {
    const scrollIfHash = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace('#', '');
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const t = window.setTimeout(scrollIfHash, 80);
    window.addEventListener('hashchange', scrollIfHash);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', scrollIfHash);
    };
  }, []);

  const subjectTests = [
    { id: 'physics', name: 'Physics', category: 'Science', stages: '5 stages', icon: '⚡', focus: ['Mechanics', 'Electricity', 'Optics'] },
    { id: 'math', name: 'Mathematics', category: 'Math', stages: '5 stages', icon: '📐', focus: ['Algebra', 'Geometry', 'Trigonometry'] },
    { id: 'bio', name: 'Biology', category: 'Science', stages: '5 stages', icon: '🧬', focus: ['Cell biology', 'Genetics', 'Ecology'] },
    { id: 'chem', name: 'Chemistry', category: 'Science', stages: '5 stages', icon: '🧪', focus: ['Stoichiometry', 'Organic', 'Lab safety'] },
    { id: 'eng', name: 'English', category: 'Languages', stages: '5 stages', icon: '📚', focus: ['Literature', 'Grammar', 'Comprehension'] },
    { id: 'cs', name: 'Computer Science', category: 'Tech', stages: '5 stages', icon: '💻', focus: ['Programming', 'Logic', 'Computational thinking'] },
    { id: 'hist', name: 'History / Social Studies', category: 'Languages', stages: '5 stages', icon: '📜', focus: ['Civics', 'World history', 'Source analysis'] },
    { id: 'econ', name: 'Economics / Commerce', category: 'Math', stages: '5 stages', icon: '📊', focus: ['Micro', 'Accounts basics', 'Application'] },
  ];

  const filteredTests = subjectTests.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(testSearchQuery.toLowerCase()) ||
      t.focus.some(tag => tag.toLowerCase().includes(testSearchQuery.toLowerCase()));
    const matchesCat = selectedSubjectFilter === 'ALL' || t.category === selectedSubjectFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="w-full overflow-hidden text-slate-900">
      {/* ========================================================================= */}
      {/* 1. HERO: KITA-STYLE PRODUCT THEATER */}
      {/* ========================================================================= */}
      <section className="relative w-full py-16 sm:py-20 border-b border-indigo-100 bg-[#f6f7fb] overflow-hidden">
        <div className="pointer-events-none absolute -left-24 top-24 w-72 h-40 rounded-full bg-indigo-200/50 blur-3xl rotate-[-24deg]" />
        <div className="pointer-events-none absolute -right-16 bottom-32 w-80 h-44 rounded-full bg-pink-200/40 blur-3xl rotate-[18deg]" />
        <div className="hero-concentric pointer-events-none absolute inset-0 opacity-70" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 space-y-6"
            >
              <motion.h1
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-5xl sm:text-6xl lg:text-[4.15rem] font-black tracking-tight leading-[1.08] text-slate-900"
              >
                AI that helps schools hire teachers
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="text-lg sm:text-xl text-slate-600 leading-relaxed font-medium max-w-xl"
              >
                Post a vacancy, send teachers a WhatsApp test code, see their CV, written answers and teaching video in one report — then the Principal decides.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-wrap items-center gap-3 pt-1"
              >
                <Link
                  href="/contact#book-demo"
                  className="brand-primary-btn px-8 py-4 rounded-full text-base font-bold shadow-lg shadow-indigo-600/25 cursor-pointer hover:scale-105 transition-transform"
                >
                  <span>Book a School Demo</span>
                </Link>

                <Link
                  href="#workflow"
                  className="px-6 py-4 rounded-full text-base font-bold secondary-nav-btn flex items-center gap-2 shadow-xs cursor-pointer hover:border-indigo-400 bg-white hover:scale-105 transition-transform"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>How it works</span>
                </Link>
              </motion.div>
              <p className="text-xs text-slate-500 pt-1">
                Edcruiter is school teacher recruitment software.{' '}
                <Link href="/privacy" className="text-indigo-600 font-semibold hover:underline">
                  Privacy Policy
                </Link>
                {' · '}
                <Link href="/terms" className="text-indigo-600 font-semibold hover:underline">
                  Terms of Service
                </Link>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex justify-center lg:justify-end"
            >
              <HeroProductCard />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroWorkspaceCard />
          </motion.div>

          {/* School Trust Marquee Strip with Continuous Smooth Animation */}
          <div className="pt-8 border-t border-indigo-200/80 overflow-hidden">
            <h2 className="text-center text-sm font-bold uppercase tracking-wider text-indigo-900/70 mb-5">
              Trusted by Academic Leadership in Leading Schools &amp; Educational Trusts
            </h2>
            <div className="relative w-full overflow-hidden mask-fade-edges">
              <div className="animate-marquee flex items-center gap-6 text-xs font-mono font-bold text-slate-800">
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🏫 Sample School
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🌐 Cambridge IGCSE / A-Level Alliances
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🎓 CBSE Senior Secondary Trusts
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  📜 IB World School Networks
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🏛️ Delhi Public School Alliances
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🏫 Sample School
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🌐 Cambridge IGCSE / A-Level Alliances
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🎓 CBSE Senior Secondary Trusts
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  📜 IB World School Networks
                </span>
                <span className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  🏛️ Delhi Public School Alliances
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PROBLEM SECTION: BRIGHT ROSE BACKGROUND (#FFF1F2) */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-rose-100 bg-[#fff1f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-3xl mx-auto space-y-3"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              School hiring is slow when every CV is checked by hand
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Principals and HODs spend hours opening resumes and sitting through demo lessons that were never screened first.
            </p>
          </motion.div>

          {/* 4 Problem Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Too Many CVs */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-7 rounded-3xl border border-rose-200 shadow-sm space-y-4 transition-all flex flex-col justify-between hover:border-rose-400 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-base text-rose-950">Too Many CVs to Review</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  School recruiters still open every B.Ed and subject resume manually across branch emails.
                </p>
              </div>
            </motion.div>

            {/* Card 2: Manual Follow-Up */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-7 rounded-3xl border border-rose-200 shadow-sm space-y-4 transition-all flex flex-col justify-between hover:border-rose-400 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-base text-rose-950">Too Much Manual Follow-Up</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Assessment invites, WhatsApp reminders, and lesson guidelines depend entirely on manual coordinator action.
                </p>
              </div>
            </motion.div>

            {/* Card 3: Candidates Go Cold */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-7 rounded-3xl border border-rose-200 shadow-sm space-y-4 transition-all flex flex-col justify-between hover:border-rose-400 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-base text-rose-950">Teacher Candidates Go Cold</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Slow demo scheduling means qualified physics and math teachers accept offers at other schools first.
                </p>
              </div>
            </motion.div>

            {/* Card 4: Reports Take Too Long */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-7 rounded-3xl border border-rose-200 shadow-sm space-y-4 transition-all flex flex-col justify-between hover:border-rose-400 hover:shadow-md"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-2xs">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-extrabold text-base text-rose-950">Reports Take Too Long</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Classroom demo rubrics and lesson plan scores still need to be compiled manually on paper.
                </p>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2.5 DYNAMIC SERVICES SHOWCASE (Interactive Card Animation Effect) */}
      {/* ========================================================================= */}
      <DynamicServicesShowcase />

      {/* ========================================================================= */}
      {/* 3. FIVE-STEP HIRING FLOW */}
      {/* ========================================================================= */}
      <section id="workflow" className="w-full py-20 border-b border-slate-200 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-3xl mx-auto space-y-3"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              How hiring works, step by step
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Post the vacancy, add leads, send a WhatsApp code, run the five-stage camera test, shortlist, then the principal meets them.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            {HIRING_FLOW_STEPS.map((step, i) => {
              const Icon = step.Icon;
              const alt = i % 2 === 0;
              return (
                <motion.div
                  key={step.n}
                  whileHover={{ y: -4 }}
                  className={`p-6 min-h-[260px] rounded-3xl border shadow-sm space-y-4 relative flex flex-col ${
                    alt ? 'bg-[#eef2ff] border-indigo-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center">{step.n}</div>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-600 ${alt ? 'bg-white border border-indigo-100' : 'bg-indigo-50 border border-indigo-100'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{step.body}</p>
                </motion.div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* BEFORE AND AFTER */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-purple-100 bg-[#faf5ff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-3xl mx-auto space-y-3"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              What changes on a busy hiring week
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Concrete differences for HR, HODs, and principals — not buzzwords.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
            
            <div className="bg-white p-8 rounded-3xl border border-purple-200 space-y-6 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="font-black text-lg text-purple-950">Without Edcruiter</h3>
              </div>

              <ul className="space-y-4 text-base font-medium text-slate-600">
                <li className="flex items-start gap-3 border-b border-slate-100 pb-3">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>HR forwards 40–80 CVs in email threads; HODs skim for B.Ed and years of experience only.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-slate-100 pb-3">
                  <CalendarCheck2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Every shortlisted teacher is called to campus for a first demo — rooms, substitutes, and travel for weak fits.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-slate-100 pb-3">
                  <MessageSquareMore className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>WhatsApp chats mix personal numbers, missed links, and no single place to see who finished what.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-slate-100 pb-3">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Scores live in notebooks or Excel; principal interviews restart from zero context.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Layers className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>Branch campuses use different questions and pass bars — hard to compare Physics hires across sites.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border-2 border-indigo-300 space-y-6 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-black text-lg text-indigo-950">With Edcruiter</h3>
              </div>

              <ul className="space-y-4 text-base font-semibold text-slate-800">
                <li className="flex items-start gap-3 border-b border-indigo-50 pb-3">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Each lead gets one test code; CV, subject MCQs, teaching video, and scenario land on one report.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-indigo-50 pb-3">
                  <Video className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>First teaching evidence is asynchronous — campus time is saved for teachers who already cleared the bar.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-indigo-50 pb-3">
                  <Send className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Invites go from the school hiring WhatsApp line; status (started / completed) stays in Recruiter.</span>
                </li>
                <li className="flex items-start gap-3 border-b border-indigo-50 pb-3">
                  <Award className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>AI-powered shortlist ranks written + demo + scenario so HR knows who to send to the HOD first.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Building2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Same subject pack and score bands across branches; principal and management clear on the same file.</span>
                </li>
              </ul>
            </div>

          </div>

          <div className="pt-8 space-y-6">
            <h3 className="text-center font-black text-xl text-slate-900">
              Outcomes schools care about
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              
              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-7 rounded-3xl border border-purple-200 shadow-xs space-y-3 flex flex-col card-hover-lift"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-4xl font-black text-indigo-600 font-mono">75%</div>
                  <strong className="text-sm font-bold text-slate-900 block mt-1">Less HOD time on first screening</strong>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Instead of reading every CV and sitting every demo, the HOD reviews scored reports and only meets teachers who already finished the test.
                  </p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-7 rounded-3xl border border-purple-200 shadow-xs space-y-3 flex flex-col card-hover-lift"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-4xl font-black text-indigo-600 font-mono">6×</div>
                  <strong className="text-sm font-bold text-slate-900 block mt-1">More teachers reviewed per week</strong>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Candidates take the assessment on their own schedule. Your team reviews completed files in batches instead of locking rooms for back-to-back demos.
                  </p>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -4 }}
                className="bg-white p-7 rounded-3xl border border-purple-200 shadow-xs space-y-3 flex flex-col card-hover-lift"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shadow-2xs">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-4xl font-black text-indigo-700 tracking-tight">Zero</div>
                  <strong className="text-sm font-bold text-slate-900 block mt-1">Mandatory first-round campus demos</strong>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Teaching evidence arrives as a scored video before anyone books a substitute or travel. Campus interviews stay for the shortlisted few.
                  </p>
                </div>
              </motion.div>

            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* CURATED SUBJECT TESTS — catalog only, no live launch */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-amber-100 bg-[#fefce8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 tracking-tight">
                Curated subject tests
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                Sample subject packs schools can assign. Question banks stay inside the recruiter workspace after sign-in — this page only lists what is available.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-amber-200 shadow-xs text-xs font-bold">
              {['ALL', 'Science', 'Math', 'Languages', 'Tech'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedSubjectFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    selectedSubjectFilter === cat
                      ? 'brand-primary-btn text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'ALL' ? 'All Subjects' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search subjects (e.g. Physics, English)..."
              value={testSearchQuery}
              onChange={(e) => setTestSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-amber-200 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none shadow-xs transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTests.map((t) => (
              <motion.div
                key={t.id}
                whileHover={{ y: -4 }}
                className="bg-white p-6 rounded-2xl border border-amber-200 shadow-xs space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-xl flex items-center justify-center shadow-2xs">
                      {t.icon}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {t.stages}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{t.name}</h3>
                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Sample pack · sign in to assign</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {t.focus.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10.5px] font-medium text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 text-[11px] font-semibold text-slate-500">
                  Full MCQs &amp; demos available after school sign-in
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/contact#book-demo"
              className="inline-flex items-center gap-2 brand-primary-btn px-6 py-3 rounded-xl text-sm font-bold"
            >
              Book a demo to see a live pack
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

        </div>
      </section>

    </div>
  );
}
