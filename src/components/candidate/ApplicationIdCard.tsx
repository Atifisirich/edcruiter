'use client';

import React, { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';

/**
 * The one place a candidate is told what their application ID is. It is the
 * code that looks like EDC-PHYS-A4K2: personal to this application, sent in the
 * WhatsApp message and email, and what they type (with their phone or email) if
 * the link we sent them has expired.
 */
export default function ApplicationIdCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Copying can be blocked; the ID is on screen to write down.
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-2.5 max-w-md mx-auto">
      <div className="flex items-center gap-2 text-amber-900 text-[11px] font-extrabold uppercase tracking-wider">
        <KeyRound className="w-3.5 h-3.5" />
        Your application ID
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="allow-select font-mono text-lg font-black text-slate-900 tracking-wide break-all">{code}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <ul className="text-[11px] text-amber-950 space-y-1 list-disc list-inside leading-relaxed">
        <li>It is your personal ID for this application. It is also in the WhatsApp message and email we sent.</li>
        <li>You do not need it while you are on this page. Your progress is saved after every stage.</li>
        <li>To come back later, tap the link we sent. If it has expired, sign in with your phone or email and this ID.</li>
        <li>Keep it private. Anyone with your phone or email and this ID can open your application.</li>
      </ul>
    </div>
  );
}
