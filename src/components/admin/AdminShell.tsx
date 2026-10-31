'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase, CalendarCheck2, CheckCircle2, ChevronDown, CloudUpload, FileCheck2, LayoutDashboard, LogOut,
  Menu, MessageSquare, Plus, Settings, ShieldCheck, TriangleAlert, UserPlus, Users, UsersRound, X, XCircle, Globe,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import BrandMark from '@/components/shared/BrandMark';
import AIJobGeneratorModal from '@/components/admin/AIJobGeneratorModal';
import ExcelCandidateUploaderModal from '@/components/admin/ExcelCandidateUploaderModal';
import AddCandidateModal from '@/components/admin/AddCandidateModal';
import { AdminContext, type AdminContextValue, type ToastKind } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { workspaceBlockReason } from '@/lib/schoolStatus';
import { countByTab } from '@/lib/candidateProgress';
import type { Candidate, School } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: 'Hiring',
    items: [
      { href: '/admin', label: 'Overview', Icon: LayoutDashboard },
      { href: '/admin/candidates', label: 'Candidates', Icon: Users },
      { href: '/admin/jobs', label: 'Vacancies', Icon: Briefcase },
      { href: '/admin/interviews', label: 'Interviews', Icon: CalendarCheck2 },
    ],
  },
  {
    title: 'Set up',
    items: [
      { href: '/admin/tests', label: 'AI tests', Icon: FileCheck2 },
      { href: '/admin/policies', label: 'Policies', Icon: ShieldCheck },
      { href: '/admin/whatsapp', label: 'WhatsApp', Icon: MessageSquare },
    ],
  },
  {
    title: 'School',
    items: [
      { href: '/admin/team', label: 'Team', Icon: UsersRound },
      { href: '/admin/settings', label: 'Settings', Icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin';

  const [school, setSchool] = useState<School | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [user, setUser] = useState<AdminContextValue['user']>(null);
  const [loading, setLoading] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [vacancyOpen, setVacancyOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // The school this person belongs to is written by SchoolIdGate before this renders.
  const [schoolId] = useState(
    () => (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID
  );

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [schRes, candRes] = await Promise.all([
        fetch(`/api/schools?school_id=${schoolId}`),
        fetch(`/api/candidates?school_id=${schoolId}`),
      ]);
      const sch = await schRes.json();
      const cand = await candRes.json();
      if (sch.school) setSchool(sch.school);
      if (cand.candidates) setCandidates(cand.candidates);
    } catch (err) {
      console.error('Could not load the hiring dashboard:', err);
      toast('Could not reach the server. Check your connection and refresh.', 'error');
    } finally {
      setLoading(false);
    }
  }, [schoolId, toast]);

  useEffect(() => {
    // The data arrives asynchronously; state is set when it does, not during the effect.
    const start = window.setTimeout(() => void refresh(), 0);
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => { if (me) setUser({ name: me.name, email: me.email, role: me.role }); })
      .catch(() => { /* the pages handle being signed out */ });
    return () => window.clearTimeout(start);
  }, [refresh]);

  // Close the phone menu when moving to another page.
  useEffect(() => {
    const t = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [accountOpen]);

  const value = useMemo<AdminContextValue>(
    () => ({
      school,
      schoolId,
      user,
      candidates,
      loading,
      refresh,
      setSchool,
      openAddCandidate: () => setAddOpen(true),
      openNewVacancy: () => setVacancyOpen(true),
      openBulkUpload: () => setBulkOpen(true),
      toast,
    }),
    [school, schoolId, user, candidates, loading, refresh, toast]
  );

  const counts = useMemo(() => countByTab(candidates), [candidates]);
  const blocked = school ? workspaceBlockReason(school) : null;
  const initial = (user?.name || school?.name || 'E').trim().charAt(0).toUpperCase();

  const Sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
        menuOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:max-w-none lg:translate-x-0 lg:z-auto shrink-0`}
      aria-label="Hiring dashboard menu"
    >
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 shrink-0">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">E</span>
          <span className="flex flex-col leading-tight">
            <BrandMark size="sm" />
            <span className="text-[11px] text-slate-500 font-medium mt-0.5">Hiring dashboard</span>
          </span>
        </Link>
        <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
            {group.items.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              const badge = href === '/admin/candidates' && counts.ready > 0 ? counts.ready : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span title={`${badge} ready to review`} className="min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50">
          <span className="w-9 h-9 rounded-full bg-indigo-600 text-white font-semibold flex items-center justify-center shrink-0">
            {(school?.name || 'S').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold text-slate-900 truncate">{school?.name || 'Your school'}</span>
            <span className="block text-xs text-slate-500 truncate">
              {school?.curricula?.length ? school.curricula.join(' · ') : 'School account'}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <AdminContext.Provider value={value}>
      <div className="admin-shell min-h-screen flex bg-slate-50 text-slate-900">
        {menuOpen && <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/50" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
        {Sidebar}

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center gap-3">
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer">
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 hidden sm:block">
              <p className="text-sm font-semibold text-slate-900 truncate">{school?.name || 'Hiring dashboard'}</p>
            </div>
            <div className="flex-1 sm:hidden" />

            <div className="flex items-center gap-2">
              <div className="hidden md:block">
                <button type="button" onClick={() => setBulkOpen(true)} className={buttonClass('secondary', 'sm')}>
                  <CloudUpload className="w-4 h-4" /> Upload CVs
                </button>
              </div>
              <div className="hidden sm:block">
                <button type="button" onClick={() => setVacancyOpen(true)} className={buttonClass('secondary', 'sm')}>
                  <Plus className="w-4 h-4" /> New vacancy
                </button>
              </div>
              <button type="button" onClick={() => setAddOpen(true)} className={buttonClass('primary', 'sm')}>
                <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Add candidate</span><span className="sm:hidden">Add</span>
              </button>

              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  aria-label="Account"
                  aria-expanded={accountOpen}
                  onClick={() => setAccountOpen((o) => !o)}
                  className="flex items-center gap-1 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-full bg-slate-800 text-white text-sm font-semibold flex items-center justify-center">{initial}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 z-50">
                    <div className="px-3 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Signed in'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    <Link href="/" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                      <Globe className="w-4 h-4 text-slate-400" /> Visit the website
                    </Link>
                    <a href="/api/auth/logout" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">
                      <LogOut className="w-4 h-4 text-slate-400" /> Log out
                    </a>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 min-w-0 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
            {blocked && school && (
              <div role="status" className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    {school.status === 'suspended'
                      ? 'This school is suspended'
                      : school.status === 'onboarding'
                        ? 'Your school is waiting for approval'
                        : school.billing?.plan === 'none'
                          ? 'Choose a plan to start hiring'
                          : 'Your plan has ended'}
                  </p>
                  <p>
                    {school.status === 'suspended'
                      ? 'Candidates, vacancies, AI features, messaging and public applications are switched off. Contact Edcruiter support.'
                      : 'You can set up your campuses and HR policies now. Adding candidates, vacancies, AI tests, WhatsApp messages and public applications unlock once Edcruiter activates your plan.'}
                  </p>
                  <p>
                    To activate, write to{' '}
                    <a className="font-semibold underline" href="mailto:edcruiterofficial@gmail.com">edcruiterofficial@gmail.com</a> with your school name.
                  </p>
                </div>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      <AddCandidateModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <AIJobGeneratorModal isOpen={vacancyOpen} onClose={() => setVacancyOpen(false)} onJobCreated={() => void refresh()} />
      <ExcelCandidateUploaderModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={() => void refresh()} />

      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg bg-white ${
              t.kind === 'error' ? 'border-rose-200 text-rose-900' : t.kind === 'success' ? 'border-emerald-200 text-emerald-900' : 'border-slate-200 text-slate-800'
            }`}
          >
            {t.kind === 'error' ? <XCircle className="w-5 h-5 text-rose-500 shrink-0" /> : <CheckCircle2 className={`w-5 h-5 shrink-0 ${t.kind === 'success' ? 'text-emerald-500' : 'text-indigo-500'}`} />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </AdminContext.Provider>
  );
}
