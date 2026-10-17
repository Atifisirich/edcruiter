'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase, KeyRound, ArrowRight, GraduationCap, Link2, BookOpen, ShieldCheck
} from 'lucide-react';

import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';

async function resolveInvite(raw: string): Promise<string | null> {
  const t = raw.trim();
  if (!t) return null;
  const urlMatch = t.match(/\/candidate\/([a-zA-Z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];
  if (t.startsWith('cand_')) return t;
  try {
    const res = await fetch(`/api/candidates?school_id=${SLOKA_SCHOOL_ID}&invite_code=${encodeURIComponent(t)}`);
    const data = await res.json();
    if (data.candidate?.id) return data.candidate.id;
  } catch {
    /* fall through */
  }
  if (/^(SAMPLE|EDC|SLOKA)-/i.test(t)) return 'cand_sloka_001';
  return null;
}

export default function TeacherWorkspacePage() {
  const router = useRouter();
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [appliedNote, setAppliedNote] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('applied') === '1') {
      setAppliedNote(true);
    }
  }, []);

  const startTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = await resolveInvite(invite);
    if (!id) {
      setInviteError('Paste the WhatsApp invite link or the test code your school sent.');
      return;
    }
    setInviteError(null);
    router.push(`/candidate/${id}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-bold text-indigo-700">
            <GraduationCap className="w-3.5 h-3.5" />
            Teacher workspace
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Browse open teaching roles, apply when you are ready, and start a school assessment only when you have the WhatsApp invite code or link.
          </p>
        </div>

        {appliedNote && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800">
            Application submitted. When the school processes your CV, they will send the assessment code or link on WhatsApp.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/jobs"
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all space-y-3"
          >
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">Open teaching jobs</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              See vacancies across schools, filter by subject and board, and submit your application. The assessment starts later from the invite your school sends.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600">
              Browse jobs <ArrowRight className="w-4 h-4" />
            </span>
          </Link>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Start an assessment</h2>
              <p className="text-sm text-slate-500 leading-relaxed mt-1">
                Use the code or test link from WhatsApp after the school uploads your CV or lead list.
              </p>
            </div>
            <form onSubmit={startTest} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Assessment code or invite link</label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={invite}
                  onChange={(e) => setInvite(e.target.value)}
                  placeholder="SAMPLE-PHY-2026 or https://edcruiter.ai/candidate/…"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              {inviteError && <p className="text-xs text-rose-600 font-semibold">{inviteError}</p>}
              <button
                type="submit"
                className="w-full brand-primary-btn py-3 rounded-xl text-sm font-bold"
              >
                Open assessment
              </button>
            </form>
          </div>
        </div>

        <div className="bg-indigo-50/80 rounded-3xl border border-indigo-100 p-6 flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-slate-900">Google Sign-In</h3>
            <p className="text-sm text-slate-600">
              Teachers can already tap Continue with Google on the sign-in page. Once your Google Console client ID is added, that button will complete a real Google account login instead of the current demo path.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <BookOpen className="w-3.5 h-3.5" />
          Demo invite code: SAMPLE-PHY-2026
        </div>
      </div>
    </div>
  );
}
