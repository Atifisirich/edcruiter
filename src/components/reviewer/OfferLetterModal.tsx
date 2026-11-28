'use client';

import React, { useState } from 'react';
import { Printer, Send, X, Award } from 'lucide-react';
import type { Candidate, OfferLetterDetails, OfferLetterTemplate, School } from '@/lib/types';
import { fillTemplate } from '@/lib/offerTemplates';

interface OfferLetterModalProps {
  candidate: Candidate;
  school: Pick<School, 'name' | 'primary_contact'> | null;
  /** What the letter says: teacher, school, campus, salary, joining date. */
  details: OfferLetterDetails;
  /** Rupees a month, for the salary table of the standard letter. */
  monthly: number;
  /** The school's own letter, or null for the standard one. */
  template?: Pick<OfferLetterTemplate, 'name' | 'body'> | null;
  /** The filled-in text of a letter that was already sent. */
  sentText?: string;
  /** Set when the letter can be marked sent from here; left out to only view and print a sent letter. */
  send?: { monthly: number; joining_iso: string; campus: string; template_id?: string };
  /** The offer already went out: save a copy instead of marking it sent. */
  recordOnly?: boolean;
  onClose: () => void;
  onDispatched?: (candidate?: Candidate) => void;
}

export default function OfferLetterModal({
  candidate,
  school,
  details,
  monthly,
  template,
  sentText,
  send,
  recordOnly = false,
  onClose,
  onDispatched
}: OfferLetterModalProps) {
  const [dispatched, setDispatched] = useState(false);
  const [error, setError] = useState('');

  // This document is what actually goes to a hired candidate: it never prints
  // a name or a salary nobody entered. A missing figure shows as missing.
  const schoolName = details.school_name || school?.name || null;
  const signatoryName = details.reporting_authority || school?.primary_contact?.name || null;
  const targetBranchName = details.branch_name;
  const joiningDate = details.joining_date;

  const refNumber = `EDCRUITER/OFFER/${new Date().getFullYear()}/${candidate.id.replace('cand_', '').toUpperCase()}`;
  const currentDate = details.issue_date;

  const salaryValid = monthly >= 1000;
  const monthlyGross = Math.round(monthly);
  const annualNum = monthlyGross * 12;
  const basicSalary = Math.round(monthlyGross * 0.5);
  const hra = Math.round(monthlyGross * 0.25);
  const specialAllowance = monthlyGross - basicSalary - hra;

  const filled = sentText !== undefined ? { text: sentText, missing: [] as string[] } : template ? fillTemplate(template.body, details) : null;
  const canIssue = !!send && !!schoolName && salaryValid && !!targetBranchName && !!joiningDate && !(filled && filled.missing.length);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleDispatch = async () => {
    if (!canIssue || !send) return; // the button is also disabled, but never trust the click alone for something this consequential
    setDispatched(true);
    setError('');
    try {
      // Recorded as a decision, so it is checked (HR or admin, after the final
      // yes) and appears in the team's activity. The server builds and keeps the letter.
      const res = await fetch(`/api/candidates/${candidate.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: recordOnly ? 'offer_record' : 'offer_sent', letter: send }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDispatched(false);
        setError(data.error || (recordOnly ? 'Could not save the copy.' : 'Could not mark the offer as sent.'));
        return;
      }
      onDispatched?.(data.candidate);
    } catch {
      setDispatched(false);
      setError('Could not reach the server. Check your connection and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-6">
      <div className="bg-white text-zinc-900 max-w-3xl w-full rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Action Header Bar */}
        <div className="bg-slate-50 p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-600" />
            <span className="font-bold text-zinc-900 text-sm">Offer letter{template ? ` · ${template.name}` : ''}</span>
          </div>

          <div className="flex items-center gap-2">
            {send && (
              <button
                onClick={handleDispatch}
                disabled={dispatched || !canIssue}
                title={!canIssue ? 'Fix the issue below before this offer can be marked sent.' : undefined}
                className="brand-primary-btn px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5 mr-1" />
                <span>{dispatched ? 'Saving…' : recordOnly ? 'Save this copy' : 'Mark offer as sent'}</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-zinc-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-slate-200 text-zinc-400 hover:text-zinc-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {send && !canIssue && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold print:hidden space-y-1">
            <p>This offer cannot be marked sent until every field is real, not a placeholder:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {!schoolName && <li>School details haven&apos;t loaded. Close this and open it again.</li>}
              {!salaryValid && <li>Type the offered salary as rupees a month.</li>}
              {!targetBranchName && <li>Choose the campus.</li>}
              {!joiningDate && <li>Choose the joining date.</li>}
              {filled && filled.missing.length > 0 && <li>This letter uses something that is not set yet: {filled.missing.join(', ').replace(/_/g, ' ')}.</li>}
            </ul>
          </div>
        )}
        {error && <p role="alert" className="mx-4 sm:mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold print:hidden">{error}</p>}
        {send && <p className="mx-4 sm:mx-6 mt-3 text-[11px] text-slate-500 print:hidden">{recordOnly ? 'Check this matches the letter you sent, then save the copy.' : 'Print or save it as a PDF to give to the teacher, then mark it as sent. The letter is kept on their record.'}</p>}

        {/* Printable Offer Document Body */}
        <div id="printable-offer" className="p-8 sm:p-12 space-y-8 bg-white text-zinc-800 text-xs leading-relaxed print:p-0">

          {/* Letterhead Header */}
          <div className="flex items-start justify-between border-b-2 border-orange-600 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-orange-500 text-white font-black flex items-center justify-center text-lg shadow-sm">
                  S
                </div>
                <h2 className="text-xl font-black text-zinc-900 tracking-tight">{schoolName || '— school name unavailable —'}</h2>
              </div>
              {targetBranchName && <p className="text-[11px] text-zinc-500">{targetBranchName}</p>}
            </div>
            <div className="text-right text-[11px] text-zinc-500 space-y-0.5">
              <div><strong>Ref No:</strong> {refNumber}</div>
              <div><strong>Date:</strong> {currentDate}</div>
            </div>
          </div>

          {filled ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{filled.text}</div>
          ) : (<>
          {/* Recipient Box */}
          <div className="space-y-1 text-xs">
            <div className="font-bold text-zinc-900">To,</div>
            <div className="text-sm font-black text-zinc-900">{candidate.name}</div>
            <div className="text-zinc-600">Email: {candidate.email} | Phone: {candidate.phone}</div>
            <div className="text-zinc-600">Designation: Teacher – {candidate.applied_subject} ({candidate.applied_segment})</div>
            <div className="text-zinc-600">Campus Assignment: {targetBranchName || '— campus not set —'}</div>
          </div>

          {/* Subject & Offer Opening */}
          <div className="space-y-3">
            <div className="font-bold text-zinc-900 text-xs border-l-4 border-orange-600 pl-3 py-0.5 bg-orange-50/50">
              Subject: Letter of Appointment for the Position of Teacher ({candidate.applied_subject})
            </div>
            <p>
              Dear <strong>{candidate.name}</strong>,
            </p>
            <p>
              On behalf of the Board of Directors and the Academic Selection Committee of <strong>{schoolName || '— school name unavailable —'}</strong>, 
              we are pleased to offer you the position of <strong>Teacher of {candidate.applied_subject}</strong> ({candidate.applied_segment}). 
              This offer is made pursuant to your pedagogical evaluation, 5-minute micro-teaching demonstration, and comprehensive multi-tier interviews.
            </p>
          </div>

          {/* Core Terms & Compensation Grid */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-900 uppercase text-[11px] tracking-wider">
              1. Compensation Package & Benefits
            </h4>
            <div className="rounded-2xl border border-zinc-200 overflow-hidden bg-slate-50 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-zinc-700 font-bold border-b border-zinc-200 text-[11px]">
                  <tr>
                    <th className="p-3">Salary Component</th>
                    <th className="p-3">Monthly (INR)</th>
                    <th className="p-3">Annual CTC (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-zinc-800">
                  <tr>
                    <td className="p-3">Basic Salary (50%)</td>
                    <td className="p-3 font-mono">₹{basicSalary.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-mono">₹{(basicSalary * 12).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="p-3">House Rent Allowance (HRA - 25%)</td>
                    <td className="p-3 font-mono">₹{hra.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-mono">₹{(hra * 12).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr>
                    <td className="p-3">Special Academic Allowance & Scaffolding</td>
                    <td className="p-3 font-mono">₹{specialAllowance.toLocaleString('en-IN')}</td>
                    <td className="p-3 font-mono">₹{(specialAllowance * 12).toLocaleString('en-IN')}</td>
                  </tr>
                  <tr className="bg-orange-50 font-bold text-orange-950">
                    <td className="p-3">Total Guaranteed CTC</td>
                    <td className="p-3 font-mono">₹{monthlyGross.toLocaleString('en-IN')} / mo</td>
                    <td className="p-3 font-mono text-orange-700">{salaryValid ? `₹${annualNum.toLocaleString('en-IN')} a year` : 'Salary not set'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Key Appointment Terms */}
          <div className="space-y-3">
            <h4 className="font-bold text-zinc-900 uppercase text-[11px] tracking-wider">
              2. Terms of Employment & Reporting
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-700">
              <li><strong>Effective Joining Date:</strong> {joiningDate || '— not set —'}.</li>
              {details.terms?.map((t) => <li key={t}>{t}.</li>)}
              <li><strong>Probation, working hours and notice period:</strong> as set out in {schoolName || 'the school'}&apos;s HR policies, which you accepted during your assessment.</li>
              <li><strong>Child Safeguarding & POCSO:</strong> Strict compliance with the school&apos;s zero-tolerance safeguarding code.</li>
            </ul>
          </div>

          {/* Signature Sign-Off Block */}
          <div className="pt-8 grid grid-cols-2 gap-8 border-t border-zinc-200">
            <div className="space-y-4">
              <div className="font-serif italic text-base text-zinc-800">{signatoryName || '________________'}</div>
              <div className="text-[11px] text-zinc-600">
                <strong>{signatoryName || '— authorized signatory not set —'}</strong><br />
                {schoolName || '— school name unavailable —'}
              </div>
            </div>

            <div className="space-y-4 text-right">
              <div className="font-serif italic text-base text-zinc-400">Accepted & Confirmed</div>
              <div className="text-[11px] text-zinc-600">
                <strong>{candidate.name}</strong><br />
                Candidate Acceptance Signature<br />
                Date: ________________________
              </div>
            </div>
          </div>

          </>)}
        </div>

      </div>
    </div>
  );
}
