'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { INTERVIEW_MODES, MODE_HELP, MODE_LABEL } from '@/lib/interviewMode';
import type { InterviewMode } from '@/lib/types';

/** Three clear choices for how applicants to a vacancy are assessed. */
export default function InterviewModePicker({ value, onChange }: { value: InterviewMode; onChange: (mode: InterviewMode) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-bold text-slate-700 mb-1.5">How should applicants be assessed?</legend>
      <div className="grid grid-cols-1 gap-2">
        {INTERVIEW_MODES.map((m) => {
          const on = value === m;
          return (
            <label key={m} className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-colors ${on ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="interview_mode" value={m} checked={on} onChange={() => onChange(m)} className="sr-only" />
              <span className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>{on && <Check className="w-3 h-3" />}</span>
              <span className="space-y-0.5">
                <span className="block text-sm font-black text-slate-900">{MODE_LABEL[m]}{m === 'five_stage' && <span className="ml-2 text-[10px] font-bold text-slate-500">usual choice</span>}</span>
                <span className="block text-xs text-slate-600 leading-relaxed">{MODE_HELP[m]}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">The link you share is the same either way. Applicants are taken through what you pick here.</p>
    </fieldset>
  );
}
