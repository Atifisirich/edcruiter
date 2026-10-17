'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles, Target, Clock, ShieldCheck, Users, ArrowRight
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Our mission for K-12 hiring</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            Built for <span className="text-[#2563eb]">school hiring teams</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
            Edcruiter helps schools hire teachers with clearer evidence: check CVs, send a structured test, watch a short teaching video, then leadership decides — with every score and note on one file.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Target className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">See them teach, not just the CV</h3>
            <p className="text-base text-slate-600 leading-relaxed">
              A resume cannot show if someone can explain a lesson. Teachers record a short class video. You hear how they speak and how they explain the topic.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">Less time on first-round demos</h3>
            <p className="text-base text-slate-600 leading-relaxed">
              HODs and academic coordinators spend hours coordinating on-campus demo rounds. Edcruiter pre-screens so leadership meets teachers who already cleared the written and video stages.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-slate-900">Board-aware rubrics</h3>
            <p className="text-base text-slate-600 leading-relaxed">
              Every subject and board is different. Schools configure evaluation benchmarks for the curricula they teach — then keep the same standard across campuses.
            </p>
          </div>
        </div>

        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Leadership</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Founders</h2>
            <p className="text-base sm:text-lg text-slate-500">
              Edcruiter is built by people focused on making school faculty hiring faster and fairer — without replacing the principal’s judgment.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center">
                AK
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Atif Khan</h3>
                <p className="text-sm font-bold text-indigo-600">Founder</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Leads product and school partnerships — focused on turning messy teacher pipelines into one clear recruiter workspace.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-100 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center">
                FS
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Fathima Shabnam</h3>
                <p className="text-sm font-bold text-emerald-700">Co-founder</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Shapes academic and hiring experience design so assessments stay practical for schools and fair for teachers.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">How schools use Edcruiter</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">From vacancy to clearance</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl font-mono font-black text-indigo-600">01</span>
              <h4 className="font-bold text-slate-900">Job criteria</h4>
              <p className="text-slate-500 leading-relaxed">Board-aware JDs and assessment packs for each vacancy.</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl font-mono font-black text-indigo-600">02</span>
              <h4 className="font-bold text-slate-900">Credential match</h4>
              <p className="text-slate-500 leading-relaxed">CV checks for degrees, teacher training, and subject fit.</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl font-mono font-black text-indigo-600">03</span>
              <h4 className="font-bold text-slate-900">Video auditions</h4>
              <p className="text-slate-500 leading-relaxed">Short teaching demos scored before campus interviews.</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl font-mono font-black text-indigo-600">04</span>
              <h4 className="font-bold text-slate-900">Multi-tier clearance</h4>
              <p className="text-slate-500 leading-relaxed">HOD, principal, and management sign-off on one record.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Users className="w-4 h-4 text-indigo-600" />
              Used by school groups and campus hiring teams.
            </div>
            <Link
              href="/contact#book-demo"
              className="brand-primary-btn px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-xs"
            >
              <span>Book a demo</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
