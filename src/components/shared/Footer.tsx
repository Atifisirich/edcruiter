'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandMark from '@/components/shared/BrandMark';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();
  if (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/candidate/') ||
    pathname.startsWith('/school/setup') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/reviewer') ||
    pathname.startsWith('/superadmin')
  ) return null;

  return (
    <footer className="bg-white border-t border-slate-200 py-16 text-slate-600 mt-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
                E
              </div>
              <BrandMark size="sm" />
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              Software that helps schools hire teachers: check CVs, send a test, watch a short teaching video, then decide.
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-200 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Edcruiter AI Evaluator</span>
            </div>
          </div>

          {/* Col 2: Products & Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">AI Products</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/product/ai-job-generator" className="hover:text-indigo-600 transition-colors">AI Job &amp; Vacancy Studio</Link></li>
              <li><Link href="/product/ai-resume-screening" className="hover:text-indigo-600 transition-colors">AI Resume &amp; Credential Match</Link></li>
              <li><Link href="/product/ai-video-interview" className="hover:text-indigo-600 transition-colors">5-Min Video Pedagogy Interview</Link></li>
              <li><Link href="/product/candidate-reports" className="hover:text-indigo-600 transition-colors">360° Candidate Report Cards</Link></li>
              <li><Link href="/features" className="hover:text-indigo-600 transition-colors">Assessment Test Library</Link></li>
            </ul>
          </div>

          {/* Col 3: Company */}
          <div className="space-y-3">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-indigo-600 transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-indigo-600 transition-colors">Contact us</Link></li>
              <li><Link href="/contact#book-demo" className="hover:text-indigo-600 transition-colors">Book a demo</Link></li>
              <li><Link href="/contact#book-demo" className="hover:text-indigo-600 transition-colors">Get a quote</Link></li>
              <li><Link href="/how-it-works" className="hover:text-indigo-600 transition-colors">How it works</Link></li>
            </ul>
          </div>

          {/* Col 4: Trust & Compliance */}
          <div className="space-y-3">
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-900">Security &amp; Accuracy</h4>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm space-y-2">
              <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                <span>Zero-Tolerance Integrity Shield</span>
              </div>
              <p className="text-sm text-slate-500 leading-snug">
                Client-side MediaPipe vision with gaze saccade analysis and strict full-screen lockdown.
              </p>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1">
              <div>
                <a href="tel:+916309589438" className="hover:text-indigo-600">+91 63095 89438</a>
              </div>
              <div>
                <a href="mailto:info@edcruiter.com" className="hover:text-indigo-600">info@edcruiter.com</a>
              </div>
            </div>
          </div>

        </div>

        <div className="pt-8 mt-12 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2026 Edcruiter AI Inc. All rights reserved. Built for K-12 Schools &amp; Educational Trusts.</div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/security" className="hover:text-slate-900">Security</Link>
            <Link href="/data-deletion" className="hover:text-slate-900">Delete my data</Link>
            <Link href="/safeguarding" className="hover:text-slate-900">Child Safeguarding</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
