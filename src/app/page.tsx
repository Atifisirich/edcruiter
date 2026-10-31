'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, Clock, CheckCircle2, FileText, MessageSquare,
  ShieldCheck, Users, Video, Award, Send, BookOpen, FileSpreadsheet,
  MessageSquareMore, CalendarCheck2, Download, Smartphone, GraduationCap, Quote, ClipboardCheck, ChevronDown, User, BarChart3, XCircle
} from 'lucide-react';
import HeroProductCard from '@/components/home/HeroProductCard';
import HeroWorkspaceCard from '@/components/home/HeroWorkspaceCard';
import { HIRING_FLOW_STEPS } from '@/components/home/hiringFlowSteps';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

const PROBLEMS = [
  { Icon: FileText, title: 'Too many CVs', line: 'Everyone reads every resume. Nobody has the time.' },
  { Icon: MessageSquare, title: 'Endless chasing', line: 'Invites, reminders and links all go out by hand.' },
  { Icon: Clock, title: 'Good teachers go cold', line: 'Slow scheduling, and they join another school.' },
  { Icon: ShieldCheck, title: 'Safety is an afterthought', line: 'Child-safety judgement is rarely tested before the interview.' },
];

const SAMPLE_AREAS = [
  { label: 'Subject knowledge', score: 85 },
  { label: 'Professionalism', score: 82 },
  { label: 'Teaching excellence', score: 80 },
  { label: 'Communication', score: 76 },
  { label: 'Classroom management', score: 74 },
  { label: 'Inclusive & modern teaching', score: 70 },
];

const INTEGRITY = [
  { Icon: Video, title: 'Camera checks', line: 'Flags a second person in the room, tab switching or looking away.' },
  { Icon: BarChart3, title: 'An integrity score', line: 'Every report shows how clean the test was.' },
  { Icon: Users, title: 'A person reviews', line: 'Flags go to your reviewers. You decide what they mean.' },
];

const INDIA = [
  { Icon: Smartphone, title: 'WhatsApp first', line: 'Teachers get a link on WhatsApp from your school’s own number. Nothing to install.' },
  { Icon: BookOpen, title: 'Your board, your subject', line: 'Tests are written for your subject, grade and board: CBSE, ICSE, Cambridge, IB or state.' },
  { Icon: Users, title: 'Your whole team', line: 'HODs, principal and management each get their own login and see the same file.' },
];

const WITHOUT = [
  { Icon: FileText, text: '40 to 80 CVs in email threads' },
  { Icon: CalendarCheck2, text: 'Every shortlisted teacher called to campus' },
  { Icon: MessageSquareMore, text: 'WhatsApp chats and missed links' },
  { Icon: FileSpreadsheet, text: 'Scores in notebooks and Excel' },
];

const WITH = [
  { Icon: CheckCircle2, text: 'One link per teacher, one report each' },
  { Icon: Video, text: 'Teaching on video before anyone travels' },
  { Icon: Send, text: 'Invites sent from your school’s number' },
  { Icon: Award, text: 'A ranked shortlist with reasons' },
];

const FACTS = [
  { big: '5', title: 'AI test stages', line: 'Profile, subject test, teaching video, scenario, policies.' },
  { big: '6', title: 'teaching areas scored', line: 'Each with a reason and a quote.' },
  { big: '1', title: 'file per teacher', line: 'CV, test, video and scenario together.' },
  { big: 'Same', title: 'test for every applicant', line: 'Same questions. Same score scale.' },
];

const SUBJECTS = ['Physics', 'Mathematics', 'Biology', 'Chemistry', 'English', 'Computer Science', 'Social Studies', 'Commerce'];

const BUILT_FOR = ['CBSE schools', 'ICSE schools', 'Cambridge & IB schools', 'State board schools', 'Private schools', 'School groups & trusts', 'Multi-campus schools'];

const CV_GAPS = [
  'Classroom presence', 'Spoken English', 'Lesson planning', 'Child-safety judgement',
  'Classroom management', 'Engaging students', 'Subject depth', 'Professional conduct',
];

const AI_WORKS = [
  { Icon: Video, text: 'Reads what teachers write and watches what they say' },
  { Icon: ClipboardCheck, text: 'Scores it against a rubric for your subject and grade' },
  { Icon: Quote, text: 'Gives a reason and a real quote for every score' },
  { Icon: ShieldCheck, text: 'Says “not enough evidence” instead of guessing' },
  { Icon: Users, text: 'Your school heads make the decision' },
];

const STAGE_DETAIL = [
  {
    n: 1, Icon: FileText, title: 'Profile & CV',
    teacher: ['Fills in their details', 'Uploads their CV as a PDF'],
    ai: ['Reads the CV: degrees, B.Ed, CTET, experience', 'Checks the form against the CV and flags gaps and mismatches'],
    you: ['An eligible or needs-review verdict', 'Questions worth asking at interview'],
  },
  {
    n: 2, Icon: BookOpen, title: 'Subject test & lesson plan',
    teacher: ['Answers questions on their subject and on teaching', 'Writes a lesson plan of 150 words or more'],
    ai: ['The test is marked by the system, with the answer key hidden', 'Reads the lesson plan for outcomes, misconceptions, mixed ability and timing', 'Flags chatbot-style text'],
    you: ['Test marks, for example 21 of 30', 'A lesson score with a reason and a quote'],
  },
  {
    n: 3, Icon: Video, title: 'Teaching demo',
    teacher: ['Records a 5-minute lesson on camera', 'On a topic set for their subject and grade'],
    ai: ['Watches and listens for clarity, pacing and questioning', 'Notes eye contact, energy and voice'],
    you: ['A scored video with reasons', 'The video and transcript to watch yourself'],
  },
  {
    n: 4, Icon: ShieldCheck, title: 'Classroom scenario',
    teacher: ['Records a short answer to a real classroom situation', 'Includes a moment where a child’s safety is at stake'],
    ai: ['Judges calm, respect for the student and how learning restarts', 'Checks they would protect the child and report a concern'],
    you: ['Classroom management and safeguarding scores', 'A real quote behind each'],
  },
  {
    n: 5, Icon: ClipboardCheck, title: 'School policies',
    teacher: ['Reads your working hours, notice period and child-protection policy', 'Accepts them'],
    ai: ['Nothing to guess here', 'Their acceptance is recorded on the file'],
    you: ['Proof they agreed before they join'],
  },
];

const AREAS = [
  { title: 'Professionalism', points: ['Respectful, prepared, accountable', 'Sound judgement', 'Language fit for a school'] },
  { title: 'Communication', points: ['Clear, well-ordered explanations', 'Vocabulary and grammar', 'Stays on the point'] },
  { title: 'Teaching excellence', points: ['Lesson design', 'Delivery', 'Checking understanding', 'Feedback'] },
  { title: 'Classroom management', points: ['Handling behaviour calmly', 'Keeping learning going', 'Respect for the student'] },
  { title: 'Subject knowledge', points: ['Accuracy and depth', 'Your board’s syllabus', 'A marked subject test'] },
  { title: 'Inclusive & modern teaching', points: ['Mixed-ability learners', 'Differentiation', 'Sensible use of technology'] },
];

const PIPELINE = [
  { label: 'Applications & leads', who: 'soon' },
  { label: 'CV check', who: 'edcruiter' },
  { label: 'Edcruiter test', who: 'edcruiter' },
  { label: 'Ranked shortlist', who: 'edcruiter' },
  { label: 'Interview rounds', who: 'you' },
  { label: 'Offer', who: 'you' },
];

const FAQ = [
  { q: 'Can AI really judge teaching?', a: ['It scores what teachers write and say against a clear rubric.', 'It screens. It does not replace your interviews. It shows who deserves one.'] },
  { q: 'What is the five-stage AI test?', a: ['Stage 1: profile and CV', 'Stage 2: subject test and lesson plan', 'Stage 3: a 5-minute teaching video', 'Stage 4: a classroom scenario with a child-safety moment', 'Stage 5: your school policies. Camera checks run throughout'] },
  { q: 'Does it work for our subjects and board?', a: ['Pick the subject, grade and board: CBSE, ICSE, Cambridge, IB or state.', 'The test is written for that combination.'] },
  { q: 'How do you check safeguarding?', a: ['The scenario includes a child-safety moment.', 'The answer is scored with a reason and a quote.', 'Teachers accept your child-protection policy.'] },
  { q: 'Do teachers need to install anything?', a: ['No. They get a WhatsApp link.', 'The test runs in their browser.'] },
  { q: 'Is it fair to every candidate?', a: ['The AI is told to ignore accent, age, gender and religious or cultural dress.', 'Every score shows its reason.', 'Reviewers can override a score, and your school heads decide.'] },
  { q: 'How do you stop cheating?', a: ['Camera checks flag a second person, tab switching or looking away.', 'Flags appear on the report for a person to review.'] },
  { q: 'Who can see our teachers’ data?', a: ['Only the staff you add to your school.', 'Teachers can ask for their data to be deleted.'] },
  { q: 'Can our whole team use it?', a: ['Yes. HR, HODs, principal and management each get a login.', 'Roles decide what each person can see.'] },
  { q: 'How much does it cost?', a: ['It depends on how many teachers you hire.', 'Book a demo and we will give you a clear quote.'] },
];

export default function Home() {
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
                className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-slate-900"
              >
                <span className="block">School hiring.</span>
                <span className="block text-indigo-600">Better.</span>
                <span className="block text-indigo-600">Faster.</span>
                <span className="block text-indigo-600">Cheaper.</span>
              </motion.h1>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  Stop Screening. <span className="text-indigo-600">Start Hiring Smarter.</span>
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-base font-bold text-slate-800">
                  {['No CV overload.', 'No wasted interviews.', 'No hiring guesswork.'].map((text) => (
                    <li key={text} className="flex items-center gap-2.5 bg-white border border-rose-100 rounded-2xl px-4 py-3 shadow-xs">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                      {text}
                    </li>
                  ))}
                  <li className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 shadow-xs text-emerald-900 sm:col-span-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    Only qualified, assessed candidates.
                  </li>
                </ul>
              </motion.div>

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
                  href="/signup"
                  className="px-6 py-4 rounded-full text-base font-bold secondary-nav-btn flex items-center gap-2 shadow-xs cursor-pointer hover:border-indigo-400 bg-white hover:scale-105 transition-transform"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span>Onboard your school</span>
                </Link>
              </motion.div>

              <p className="text-xs text-slate-500 pt-1">
                <Link href="#workflow" className="text-indigo-600 font-semibold hover:underline">See how it works</Link>
                {' · '}
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
              className="lg:col-span-6 flex items-start justify-center lg:justify-end min-h-[540px] sm:min-h-[500px]"
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

          <div className="pt-8 border-t border-indigo-200/80">
            <h2 className="text-center text-sm font-bold uppercase tracking-wider text-indigo-900/70 mb-5">
              Tests written for your board
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-800">
              {['CBSE', 'ICSE', 'Cambridge IGCSE', 'IB', 'State boards'].map((b) => (
                <span key={b} className="px-4 py-2 rounded-xl bg-white border border-indigo-100 shadow-xs whitespace-nowrap">
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PROBLEM */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-rose-100 bg-[#fff1f2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Teacher hiring is slow, manual and risky
            </h2>
            <p className="text-base sm:text-lg text-slate-600">
              Your school heads should meet three strong teachers, not read three hundred CVs.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROBLEMS.map(({ Icon, title, line }) => (
              <motion.div
                key={title}
                whileHover={{ y: -5 }}
                className="bg-white p-7 rounded-3xl border border-rose-200 shadow-sm space-y-4 transition-all hover:border-rose-400 hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-extrabold text-lg text-rose-950">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{line}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* THE FIVE-STAGE AI TEST */}
      {/* ========================================================================= */}
      <section id="five-stage-test" className="w-full py-20 border-b border-indigo-900 bg-gradient-to-br from-indigo-950 via-indigo-900 to-indigo-800 text-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/10 border border-white/20 text-indigo-100">
              <Sparkles className="w-3.5 h-3.5" /> The Edcruiter AI test
            </span>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: '#ffffff' }}>The five-stage AI test</h2>
            <p className="text-lg text-indigo-100">Every teacher. The same five stages. Scored by AI, with a reason for each score.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {AI_WORKS.map(({ Icon, text }) => (
              <div key={text} className="bg-white/10 border border-white/20 rounded-2xl p-4 flex flex-col gap-2.5">
                <Icon className="w-5 h-5 text-indigo-200" />
                <p className="text-sm font-semibold text-white leading-snug">{text}</p>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            {STAGE_DETAIL.map(({ n, Icon, title, teacher, ai, you }) => (
              <motion.div key={n} {...fadeUp} className="bg-white text-slate-900 rounded-3xl shadow-lg overflow-hidden">
                <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <span className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-base flex items-center justify-center shrink-0">{n}</span>
                  <Icon className="w-6 h-6 text-indigo-600 shrink-0" />
                  <h3 className="font-extrabold text-lg sm:text-xl text-slate-900 leading-snug">{title}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                  {[
                    { label: 'The teacher', Icon: User, items: teacher, tone: 'text-slate-600', chip: 'bg-slate-100 text-slate-700', tick: 'text-slate-400' },
                    { label: 'The AI', Icon: Sparkles, items: ai, tone: 'text-slate-800', chip: 'bg-indigo-100 text-indigo-700', tick: 'text-indigo-600' },
                    { label: 'You get', Icon: CheckCircle2, items: you, tone: 'text-slate-800', chip: 'bg-emerald-100 text-emerald-700', tick: 'text-emerald-600' },
                  ].map((col) => (
                    <div key={col.label} className="p-6 space-y-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${col.chip}`}>
                        <col.Icon className="w-3.5 h-3.5" /> {col.label}
                      </span>
                      <ul className={`space-y-2 text-sm ${col.tone}`}>
                        {col.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${col.tick}`} />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-white/10 border border-white/20 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white">Camera checks, throughout</p>
                <p className="text-sm text-indigo-100">Flags a second person, tab switching and looking away, and shows an integrity score on the report.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ClipboardCheck className="w-6 h-6 text-indigo-200 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-white">Then, one report</p>
                <p className="text-sm text-indigo-100">All five stages come together as six scored areas, with a PDF to share.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5">
            <Link href="/contact#book-demo" className="px-8 py-4 rounded-full bg-white text-indigo-800 text-base font-bold shadow-lg hover:scale-105 transition-transform inline-flex items-center gap-2">
              See the test in a demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* WHAT A CV CANNOT TELL YOU */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">What a CV can’t tell you</h2>
            <p className="text-base sm:text-lg text-slate-600">Edcruiter shows you these eight things before the first interview.</p>
          </motion.div>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CV_GAPS.map((g) => (
              <li key={g} className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-slate-800 shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. HIRING FLOW */}
      {/* ========================================================================= */}
      <section id="workflow" className="w-full py-20 border-b border-slate-200 bg-white scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              From vacancy to shortlist in six steps
            </h2>
            <p className="text-base sm:text-lg text-slate-600">No spreadsheets. No phone tag.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            {HIRING_FLOW_STEPS.map((step, i) => {
              const Icon = step.Icon;
              const alt = i % 2 === 0;
              return (
                <motion.div
                  key={step.n}
                  whileHover={{ y: -4 }}
                  className={`p-6 min-h-[220px] rounded-3xl border shadow-sm space-y-4 relative flex flex-col ${
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

      <section className="w-full py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Six areas, scored one by one</h2>
            <p className="text-base sm:text-lg text-slate-600">Every score comes with a reason.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AREAS.map((a) => (
              <motion.div key={a.title} whileHover={{ y: -4 }} className="bg-[#eef2ff] p-7 rounded-3xl border border-indigo-200 shadow-sm space-y-4">
                <h3 className="font-extrabold text-lg text-slate-900">{a.title}</h3>
                <ul className="space-y-2 text-sm font-medium text-slate-700">
                  {a.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center items-center gap-2.5 text-xs font-bold text-slate-700">
            <span className="text-slate-500">Also scored:</span>
            {['Pedagogy', 'Lesson planning', 'Student engagement', 'Safeguarding awareness', 'CV review'].map((c) => (
              <span key={c} className="px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-xs">{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. THE REPORT */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-indigo-100 bg-[#eef2ff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div {...fadeUp} className="space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              One report your school heads can read in two minutes
            </h2>
            <ul className="space-y-4 text-base font-semibold text-slate-800">
              {[
                'Six teaching areas, each scored with a reason',
                'A real quote from the teacher behind each score',
                'Not enough evidence? It says so, instead of guessing',
                'Download it as a PDF to share with your team',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-slate-600 border-l-4 border-indigo-300 pl-4">
              The AI does the first read. <strong className="text-slate-900">Your school heads make the decision.</strong>
            </p>
          </motion.div>

          <motion.div {...fadeUp} className="bg-white rounded-3xl border border-indigo-200 shadow-lg p-6 sm:p-7 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sample report · illustrative scores</p>
                <p className="text-lg font-black text-slate-900 mt-0.5">Biology teacher · Secondary</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-slate-900 font-mono leading-none">79<span className="text-sm text-slate-400 font-medium"> /100</span></p>
                <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">Strong shortlist</span>
              </div>
            </div>

            <ul className="space-y-3">
              {SAMPLE_AREAS.map((a) => (
                <li key={a.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-800">
                    <span>{a.label}</span>
                    <span className="font-mono">{a.score}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${a.score >= 80 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${a.score}%` }} />
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex gap-3">
              <Quote className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="italic">“I would listen without promising secrecy, write down what they said, and report it to the safeguarding officer the same day.”</span>
                <span className="block text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Quote shown with the safeguarding score</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
              <Download className="w-4 h-4" /> Download full PDF report
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* AN HONEST TEST (test integrity, not child safety) */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">An honest test</h2>
            <p className="text-base sm:text-lg text-slate-600">So you know the work is theirs.</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {INTEGRITY.map(({ Icon, title, line }) => (
              <motion.div key={title} whileHover={{ y: -4 }} className="bg-white p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900 leading-snug">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{line}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* WHERE EDCRUITER FITS */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-indigo-100 bg-[#eef2ff]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Where Edcruiter fits in your hiring</h2>
            <p className="text-base sm:text-lg text-slate-600">Your interviews stay. We take the screening work out before them.</p>
            <p className="text-sm font-semibold text-amber-800">We will soon bring in applications and leads for you. For now, you add your applicants.</p>
          </motion.div>
          <ol className="flex flex-col md:flex-row md:flex-wrap md:justify-center items-stretch md:items-center gap-3">
            {PIPELINE.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 md:gap-3">
                <span
                  className={`px-5 py-3 rounded-2xl border text-sm font-bold text-center flex-1 md:flex-none ${
                    s.who === 'edcruiter'
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : s.who === 'soon'
                        ? 'bg-amber-50 border-2 border-dashed border-amber-400 text-amber-900'
                        : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  {s.label}
                  {s.who === 'soon' && (
                    <span className="block mt-1 text-[10px] font-black uppercase tracking-wider text-amber-700">Coming soon</span>
                  )}
                </span>
                {i < PIPELINE.length - 1 && <ArrowRight className="hidden md:block w-4 h-4 text-slate-400 shrink-0" />}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-5 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-600" /> Done by Edcruiter</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-slate-300" /> Done by your team</span>
            <span className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-50 border-2 border-dashed border-amber-400" /> Coming soon</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. INDIA + WHATSAPP */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Built for how Indian schools hire
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {INDIA.map(({ Icon, title, line }) => (
              <motion.div key={title} whileHover={{ y: -4 }} className="bg-[#eef2ff] p-7 rounded-3xl border border-indigo-200 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-lg text-slate-900 leading-snug">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{line}</p>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4 text-center">
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">Built for</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {BUILT_FOR.map((b) => (
                <span key={b} className="px-4 py-2 rounded-full bg-white border border-indigo-200 text-sm font-bold text-slate-800 shadow-xs">{b}</span>
              ))}
            </div>
            <p className="text-sm font-bold uppercase tracking-wider text-slate-500 pt-2">Tests for every subject you hire</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {SUBJECTS.map((s) => (
                <span key={s} className="px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-sm font-bold text-slate-800 shadow-xs">{s}</span>
              ))}
              <span className="px-4 py-2 rounded-full bg-amber-100 border border-amber-200 text-sm font-bold text-amber-900">and more</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. BEFORE AND AFTER */}
      {/* ========================================================================= */}
      <section className="w-full py-20 border-b border-purple-100 bg-[#faf5ff]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              A busy hiring week, before and after
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto items-stretch">
            <div className="bg-white p-8 rounded-3xl border border-purple-200 space-y-5 shadow-xs">
              <h3 className="font-black text-lg text-purple-950 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" /> Without Edcruiter
              </h3>
              <ul className="space-y-3.5 text-base font-medium text-slate-600">
                {WITHOUT.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border-2 border-indigo-300 space-y-5 shadow-md">
              <h3 className="font-black text-lg text-indigo-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> With Edcruiter
              </h3>
              <ul className="space-y-3.5 text-base font-semibold text-slate-800">
                {WITH.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 border-b border-indigo-50 pb-3 last:border-0 last:pb-0">
                    <Icon className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {FACTS.map((o) => (
              <motion.div key={o.title} whileHover={{ y: -4 }} className="bg-white p-7 rounded-3xl border border-purple-200 shadow-xs space-y-1.5">
                <div className="text-4xl font-black text-indigo-600 tracking-tight">{o.big}</div>
                <strong className="text-sm font-bold text-slate-900 block">{o.title}</strong>
                <p className="text-sm text-slate-500 leading-relaxed">{o.line}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FAQ */}
      {/* ========================================================================= */}
      <section className="w-full py-20 bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <motion.div {...fadeUp} className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Questions schools ask</h2>
          </motion.div>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-slate-200 bg-slate-50 open:bg-white open:border-indigo-200 open:shadow-sm">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 text-base font-bold text-slate-900">
                  {f.q}
                  <ChevronDown className="w-5 h-5 text-indigo-600 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="px-5 pb-5 space-y-2 text-sm text-slate-700">
                  {f.a.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full py-20 bg-indigo-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <GraduationCap className="w-10 h-10 mx-auto text-indigo-200" />
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight" style={{ color: '#ffffff' }}>Ready to hire with confidence?</h2>
          <p className="text-lg text-indigo-100">See it on your own vacancy.</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/contact#book-demo" className="px-8 py-4 rounded-full bg-white text-indigo-700 text-base font-bold shadow-lg hover:scale-105 transition-transform inline-flex items-center gap-2">
              Book a School Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/signup" className="px-8 py-4 rounded-full border-2 border-white/70 text-white text-base font-bold hover:bg-white/10 transition-colors">
              Onboard your school
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
