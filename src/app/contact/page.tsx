'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, CalendarDays, ArrowRight, Building2, CheckCircle2 } from 'lucide-react';

const PHONE_DISPLAY = '+91 63095 89438';
const PHONE_TEL = '+916309589438';
const EMAIL = 'info@edcruiter.com';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: '',
    school: '',
    email: '',
    phone: '',
    message: '',
    wantDemo: true,
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      form.wantDemo ? `Demo request — ${form.school || 'School'}` : `Contact — ${form.school || 'School'}`
    );
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `School / Trust: ${form.school}`,
        `Email: ${form.email}`,
        `Phone: ${form.phone}`,
        form.wantDemo ? 'Request: Book a product demo' : 'Request: General enquiry',
        '',
        form.message || '(No extra message)',
      ].join('\n')
    );
    window.location.href = `mailto:${EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-12 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
            Contact <span className="text-[#2563eb]">Edcruiter</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600">
            Talk to us about school hiring, book a live demo, or ask how the recruiter workspace fits your campuses.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={`tel:${PHONE_TEL}`}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-indigo-300 transition-colors space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-900">Phone</h2>
            <p className="text-lg font-mono font-bold text-indigo-700 tracking-wide">{PHONE_DISPLAY}</p>
            <p className="text-xs text-slate-500">India · tap to call</p>
          </a>

          <a
            href={`mailto:${EMAIL}`}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:border-indigo-300 transition-colors space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-900">Email</h2>
            <p className="text-lg font-bold text-emerald-700 break-all">{EMAIL}</p>
            <p className="text-xs text-slate-500">Official school &amp; trust enquiries</p>
          </a>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-slate-900">Book a demo</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Walk through CV screening, WhatsApp invites, teaching demos, and principal clearance on a sample campus.
            </p>
            <a href="#book-demo" className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:underline">
              Use the form below <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div id="book-demo" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 scroll-mt-28">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm mb-6">
            <Building2 className="w-4 h-4" />
            Book a demo or send a message
          </div>

          {sent ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                Opening your email app…
              </div>
              <p className="text-sm text-emerald-900/80">
                If nothing opened, write to{' '}
                <a className="font-bold underline" href={`mailto:${EMAIL}`}>
                  {EMAIL}
                </a>{' '}
                or call {PHONE_DISPLAY}.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs font-semibold text-emerald-800 underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-slate-700">
                  Your name *
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  School / trust *
                  <input
                    required
                    value={form.school}
                    onChange={(e) => setForm({ ...form, school: e.target.value })}
                    className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Work email *
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                    placeholder="+91 …"
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.wantDemo}
                  onChange={(e) => setForm({ ...form, wantDemo: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600"
                />
                <span className="text-sm text-slate-800">
                  <strong className="font-bold">Book a demo</strong>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    We’ll schedule a short walkthrough of the recruiter workspace for your hiring team.
                  </span>
                </span>
              </label>

              <label className="block text-xs font-bold text-slate-700">
                Message
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="mt-1.5 w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-sm"
                  placeholder="Campuses, subjects you hire for, timeline…"
                />
              </label>

              <button
                type="submit"
                className="brand-primary-btn px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2"
              >
                {form.wantDemo ? 'Request demo' : 'Send message'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Prefer reading first?{' '}
          <Link href="/about" className="text-indigo-600 font-semibold hover:underline">
            About Edcruiter
          </Link>
          {' · '}
          <a href="tel:+916309589438" className="text-indigo-600 font-semibold hover:underline">
            Call for a quote
          </a>
        </p>
      </div>
    </div>
  );
}
