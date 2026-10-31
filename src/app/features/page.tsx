'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles, ShieldCheck, Video, ScanSearch, ClipboardCheck, Download,
  ArrowRight, Users, Smartphone, Scale, CalendarCheck2, CheckCircle2
} from 'lucide-react';

const FEATURES = [
  {
    id: 'five-stage-test',
    Icon: ScanSearch,
    tone: 'orange',
    title: 'The five-stage AI test',
    line: 'Every applicant takes the same five stages before anyone books a campus visit.',
    points: ['1. Profile and CV, checked for B.Ed and experience', '2. Subject test and lesson plan', '3. A 5-minute teaching video', '4. Classroom scenario with a child-safety moment', '5. Your school policies'],
  },
  {
    id: 'demo',
    Icon: Video,
    tone: 'amber',
    title: 'See them teach, on video',
    line: 'A recorded teaching demo shows how they explain, question and engage a class.',
    points: ['Clarity, pacing and checking for understanding', 'Watch it back, with the transcript beside it', 'Delivery notes on eye contact, energy and voice'],
  },
  {
    id: 'safeguarding',
    Icon: ShieldCheck,
    tone: 'emerald',
    title: 'Safeguarding, tested',
    line: 'Know how each teacher thinks about keeping children safe before they walk into a classroom.',
    points: ['A child-safety moment in the classroom scenario', 'Child-protection and conduct policies accepted', 'Safeguarding awareness scored with a reason and a quote'],
  },
  {
    id: 'report',
    Icon: ClipboardCheck,
    tone: 'blue',
    title: 'A report your principal can read',
    line: 'Six teaching areas, more factors on top, and a reason behind every score.',
    points: ['Professionalism, communication, teaching, classroom management, subject, inclusive teaching', 'Real quotes from the teacher’s own answers', 'Where there is not enough evidence, it says so'],
  },
  {
    id: 'pdf',
    Icon: Download,
    tone: 'purple',
    title: 'Download it as a PDF',
    line: 'Share one clean report with your HOD, principal or management board.',
    points: ['Cover page, summary, strengths and areas to improve', 'Colour guide and a clear note on how to read it', 'Confidential, for the hiring school only'],
  },
  {
    id: 'proctoring',
    Icon: Sparkles,
    tone: 'slate',
    title: 'Camera on during the test',
    line: 'Teachers keep the camera on so the test stays fair. This is sometimes called proctoring.',
    points: ['Flags a second person, looking away or leaving the tab', 'A test-integrity score on the report', 'Flags are shown to your reviewers for a human call'],
  },
  {
    id: 'whatsapp',
    Icon: Smartphone,
    tone: 'emerald',
    title: 'WhatsApp, not an app',
    line: 'Teachers get a link from your school’s own number and take the test in their browser.',
    points: ['Nothing to install', 'Invite one teacher or a whole list', 'See who has started and who has finished'],
  },
  {
    id: 'rounds',
    Icon: CalendarCheck2,
    tone: 'indigo',
    title: 'Interview rounds, in order',
    line: 'Subject lead, then principal, then management, each scheduled and recorded on the teacher’s file.',
    points: ['Pick the interviewer and the time', 'The next round opens only after the last is accepted', 'Every decision keeps its reason'],
  },
  {
    id: 'team',
    Icon: Users,
    tone: 'blue',
    title: 'Your whole hiring team',
    line: 'HR, HODs, the principal and management each have their own login.',
    points: ['Roles decide what each person can see and do', 'Invite and remove people yourself', 'Change who sees what at any time'],
  },
  {
    id: 'fair',
    Icon: Scale,
    tone: 'orange',
    title: 'Fair, and your decision',
    line: 'The AI helps with the first read. People make the hiring call.',
    points: ['The AI is told never to mark down religious or cultural dress', 'It is told to ignore accent, age and gender', 'Reviewers can override any AI score'],
  },
];

const TONES: Record<string, { box: string; dot: string }> = {
  orange: { box: 'bg-orange-100 text-orange-600 border-orange-200', dot: 'text-orange-500' },
  amber: { box: 'bg-amber-100 text-amber-600 border-amber-200', dot: 'text-amber-500' },
  emerald: { box: 'bg-emerald-100 text-emerald-600 border-emerald-200', dot: 'text-emerald-600' },
  blue: { box: 'bg-blue-100 text-blue-600 border-blue-200', dot: 'text-blue-600' },
  purple: { box: 'bg-purple-100 text-purple-600 border-purple-200', dot: 'text-purple-600' },
  slate: { box: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'text-slate-600' },
  indigo: { box: 'bg-indigo-100 text-indigo-600 border-indigo-200', dot: 'text-indigo-600' },
};

export default function FeaturesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-14">
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold badge-brand shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Safeguarding built in</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight">
          Everything you need to hire teachers with confidence
        </h1>
        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400">
          From the first WhatsApp message to the principal&apos;s decision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {FEATURES.map(({ id, Icon, tone, title, line, points }) => (
          <div
            key={id}
            id={id}
            className="glass-card p-7 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4 hover:border-orange-500/50 hover:shadow-xl transition-all scroll-mt-24"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${TONES[tone].box}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{title}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{line}</p>
            </div>
            <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${TONES[tone].dot}`} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="glass-card p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-zinc-800 text-center space-y-6 shadow-xl">
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white">Ready to modernise your teacher hiring?</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
          See it on your own vacancy. Edcruiter supports your hiring and does not replace police verification or your school&apos;s own checks.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/signup" className="brand-primary-btn px-8 py-3 rounded-xl text-sm font-bold shadow-lg">
            <span>Onboard Your School</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Link>
          <Link href="/contact#book-demo" className="px-8 py-3 rounded-xl text-sm font-bold secondary-nav-btn transition-all">
            Book a demo
          </Link>
        </div>
      </div>
    </div>
  );
}
