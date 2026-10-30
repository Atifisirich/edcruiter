'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import BrandMark from '@/components/shared/BrandMark';
import { DEFAULT_SHORTLIST_BANDS } from '@/lib/shortlistBands';

// A live site starts with no demo school, so "open the demo" would lead to an
// empty workspace. It is only offered during local development.
const SHOW_DEMO = process.env.NODE_ENV !== 'production';

type BranchRow = { name: string; location: string };

export default function SchoolSetupWizard() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchCount, setBranchCount] = useState(1);
  const [branches, setBranches] = useState<BranchRow[]>([{ name: 'Main campus', location: '' }]);
  const [form, setForm] = useState({
    schoolName: '',
    trustName: '',
    board: 'CBSE',
    city: '',
    country: '',
    website: '',
    studentStrength: '',
    gradesOffered: 'K–12',
    subjectsHiring: 'English, Math, Science, Physics, Chemistry, Biology',
    contactName: '',
    contactRole: 'HR / Principal',
    contactEmail: '',
    contactPhone: '',
    whatsappNumber: '',
    whatsappDisplayName: '',
  });

  const syncBranchCount = (n: number) => {
    const count = Math.max(1, Math.min(20, n || 1));
    setBranchCount(count);
    setBranches((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push({ name: `Campus ${next.length + 1}`, location: form.city });
      }
      return next.slice(0, count);
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (branches.some((b) => !b.name.trim() || !b.location.trim())) {
        throw new Error('Every branch needs a name and location / city.');
      }

      const code = form.schoolName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .substring(0, 6) || 'SCH';

      const subjectList = form.subjectsHiring
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.schoolName.trim(),
          code,
          primary_contact: {
            name: form.contactName.trim() || 'School admin',
            email: form.contactEmail.trim(),
            phone: form.contactPhone.trim(),
          },
          branches: branches.map((b, i) => ({
            id: `branch_${code.toLowerCase()}_${i + 1}`,
            name: b.name.trim(),
            code: `${code}-${String(i + 1).padStart(2, '0')}`,
            location: b.location.trim(),
          })),
          subjects: subjectList.length ? subjectList : ['English', 'Math', 'Science'],
          segments: ['Primary (Grades 1-5)', 'Middle School (Grades 6-8)', 'Secondary (Grades 9-10)', 'Senior Secondary (Grades 11-12)'],
          curricula: [form.board],
          whatsapp_number: form.whatsappNumber.trim() || form.contactPhone.trim(),
          whatsapp_display_name: form.whatsappDisplayName.trim() || form.schoolName.trim(),
          shortlist_bands: DEFAULT_SHORTLIST_BANDS,
          setup_meta: {
            trust_name: form.trustName,
            country: form.country,
            website: form.website,
            student_strength: form.studentStrength,
            grades_offered: form.gradesOffered,
            contact_role: form.contactRole,
            hq_city: form.city,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.school) {
        throw new Error(data.error || 'Could not save school');
      }
      localStorage.setItem('edcruiter_school_setup_done', '1');
      localStorage.setItem('edcruiter_school_id', data.school.id);
      router.push('/admin');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save school');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <BrandMark size="lg" />
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Set up your school</h1>
          <p className="text-sm text-slate-600">
            Fill the form to walk through a real school onboarding — or skip into the demo workspace below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SHOW_DEMO && (
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('edcruiter_school_setup_done', '1');
                router.push('/admin');
              }}
              className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50 text-left hover:border-indigo-400 transition-colors"
            >
              <p className="text-sm font-black text-indigo-900">Open demo school</p>
              <p className="text-xs text-indigo-700/80 mt-1">Skip setup — show the recruiter workspace with Sample School data.</p>
            </button>
          )}
          <div className="p-4 rounded-2xl border border-slate-200 bg-white text-left">
            <p className="text-sm font-black text-slate-900">Complete school setup</p>
            <p className="text-xs text-slate-500 mt-1">Use the form below to demonstrate how a school configures campuses and contact.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
            <Building2 className="w-4 h-4" />
            School / trust
          </div>

          <label className="block text-xs font-bold text-slate-700">
            School name *
            <input
              required
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              placeholder="e.g. Riverside International School"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            Trust / group name (if any)
            <input
              value={form.trustName}
              onChange={(e) => setForm({ ...form, trustName: e.target.value })}
              className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-700">
              Primary board / curriculum *
              <select
                value={form.board}
                onChange={(e) => setForm({ ...form, board: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              >
                <option>CBSE</option>
                <option>ICSE</option>
                <option>Cambridge / IGCSE</option>
                <option>IB</option>
                <option>State board</option>
                <option>National curriculum</option>
                <option>Multiple curricula</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Grades offered
              <input
                value={form.gradesOffered}
                onChange={(e) => setForm({ ...form, gradesOffered: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-700">
              HQ / main city *
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Country / region
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-slate-700">
              Approx. student strength
              <input
                value={form.studentStrength}
                onChange={(e) => setForm({ ...form, studentStrength: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                placeholder="e.g. 1200"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Website
              <input
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                placeholder="https://"
              />
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-700">
            Subjects you hire for (comma-separated)
            <input
              value={form.subjectsHiring}
              onChange={(e) => setForm({ ...form, subjectsHiring: e.target.value })}
              className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
            />
          </label>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-900">Campuses / branches *</p>
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                How many branches?
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={branchCount}
                  onChange={(e) => syncBranchCount(Number(e.target.value))}
                  className="w-16 p-2 rounded-lg bg-slate-50 border border-slate-300 text-sm"
                />
              </label>
            </div>
            <p className="text-[11px] text-slate-500">Name each campus and where it is (city / area).</p>
            {branches.map((b, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  required
                  value={b.name}
                  onChange={(e) => {
                    const next = [...branches];
                    next[i] = { ...next[i], name: e.target.value };
                    setBranches(next);
                  }}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  placeholder={`Branch ${i + 1} name`}
                />
                <input
                  required
                  value={b.location}
                  onChange={(e) => {
                    const next = [...branches];
                    next[i] = { ...next[i], location: e.target.value };
                    setBranches(next);
                  }}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  placeholder="City / location"
                />
                <button
                  type="button"
                  disabled={branches.length <= 1}
                  onClick={() => {
                    const next = branches.filter((_, j) => j !== i);
                    setBranches(next);
                    setBranchCount(next.length);
                  }}
                  className="p-3 rounded-xl border border-slate-200 text-slate-500 disabled:opacity-40"
                  aria-label="Remove branch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => syncBranchCount(branchCount + 1)}
              className="text-xs font-bold text-indigo-600 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add another branch
            </button>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-900">Hiring contact *</p>
            <label className="block text-xs font-bold text-slate-700">
              Full name
              <input
                required
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Role
              <input
                value={form.contactRole}
                onChange={(e) => setForm({ ...form, contactRole: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-slate-700">
                Work email
                <input
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                Phone
                <input
                  required
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <p className="text-xs font-bold text-slate-900">Hiring WhatsApp (invites)</p>
            <label className="block text-xs font-bold text-slate-700">
              WhatsApp number for invites
              <input
                required
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                placeholder="+91 …"
              />
            </label>
            <label className="block text-xs font-bold text-slate-700">
              Name shown on WhatsApp
              <input
                value={form.whatsappDisplayName}
                onChange={(e) => setForm({ ...form, whatsappDisplayName: e.target.value })}
                className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
              />
            </label>
          </div>

          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

          <button type="submit" disabled={saving} className="brand-primary-btn w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
            {saving ? 'Saving…' : 'Save and open workspace'}
            <ArrowRight className="w-4 h-4" />
          </button>

          {SHOW_DEMO && (
            <button
              type="button"
              className="w-full text-xs font-semibold text-slate-500 hover:text-indigo-600"
              onClick={() => {
                localStorage.setItem('edcruiter_school_setup_done', '1');
                router.push('/admin');
              }}
            >
              Skip for now (demo school)
            </button>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          After setup: fill HR policy fields and shortlist colour bands in Recruiter.
        </p>
        <p className="text-center text-xs">
          <Link href="/login" className="text-indigo-600 font-semibold">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
