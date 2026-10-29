'use client';

import React, { useState } from 'react';
import { 
  Building2, Printer, CheckCircle2, Download, Copy, Share2, 
  X, ShieldCheck, Calendar, IndianRupee, MapPin, Award, Send, Mail
} from 'lucide-react';
import { Candidate, School } from '@/lib/types';

interface OfferLetterModalProps {
  candidate: Candidate;
  school: School | null;
  offeredSalary: string;
  joiningDate: string;
  targetBranchName: string;
  onClose: () => void;
  onDispatched?: () => void;
}

export default function OfferLetterModal({
  candidate,
  school,
  offeredSalary,
  joiningDate,
  targetBranchName,
  onClose,
  onDispatched
}: OfferLetterModalProps) {
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);

  // This document is what actually goes to a hired candidate — it must
  // never silently print a name or a salary nobody entered. Previously,
  // school === null fell back to the literal string 'Sample School' as the
  // employer on a real offer letter, and an unparseable salary silently
  // became ₹7,50,000 with a full basic/HRA/allowance breakdown computed
  // from that invented figure, with no indication anything was wrong.
  const schoolName = school?.name || null;
  const signatoryName = school?.primary_contact?.name || null;

  const refNumber = `EDCRUITER/OFFER/${new Date().getFullYear()}/${candidate.id.replace('cand_', '').toUpperCase()}`;
  const currentDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Calculate salary breakdown from offered LPA string — null, not a fake
  // number, when the input doesn't parse to something real.
  let annualNum: number | null = null;
  if (offeredSalary.includes('LPA')) {
    const parsed = parseFloat(offeredSalary);
    if (!isNaN(parsed) && parsed > 0) annualNum = Math.round(parsed * 100000);
  } else {
    const parsed = parseFloat(offeredSalary.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      annualNum = parsed < 100 ? Math.round(parsed * 100000) : Math.round(parsed);
    }
  }
  const salaryValid = annualNum !== null;
  const branchValid = !!targetBranchName && targetBranchName.trim().length > 0;
  const joiningDateValid = !!joiningDate && joiningDate.trim().length > 0;
  const canIssue = !!schoolName && salaryValid && branchValid && joiningDateValid;

  const monthlyGross = Math.round((annualNum ?? 0) / 12);
  const basicSalary = Math.round(monthlyGross * 0.5);
  const hra = Math.round(monthlyGross * 0.25);
  const specialAllowance = Math.round(monthlyGross * 0.15);

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleDispatch = async () => {
    if (!canIssue) return; // button is also disabled, but never trust the click alone for something this consequential
    setDispatched(true);
    try {
      await fetch(`/api/candidates/${candidate.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: school?.id,
          updates: {
            status: 'hired',
            coo_clearance: {
              status: 'cleared',
              decision: 'offer_issued',
              notes: `Formal offer letter (${offeredSalary}) approved and dispatched.`,
              completed_at: new Date().toISOString()
            }
          }
        })
      });
      onDispatched?.();
    } catch (err) {
      console.error('Dispatch error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm overflow-y-auto flex justify-center p-4 sm:p-6">
      <div className="bg-white text-zinc-900 max-w-3xl w-full rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col my-auto">
        
        {/* Action Header Bar */}
        <div className="bg-slate-50 p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-600" />
            <span className="font-bold text-zinc-900 text-sm">Official Faculty Appointment Offer Letter</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              BOARD APPROVED
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDispatch}
              disabled={dispatched || !canIssue}
              title={!canIssue ? 'Fix the issue below before this offer can be dispatched.' : undefined}
              className="brand-primary-btn px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              <span>{dispatched ? '✓ Offer Dispatched!' : '1-Click Dispatch Offer'}</span>
            </button>
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

        {!canIssue && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-semibold print:hidden space-y-1">
            <p>This offer cannot be dispatched until every field below is real, not a placeholder:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {!schoolName && <li>School details haven&apos;t loaded — reopen this from the candidate profile.</li>}
              {!salaryValid && <li>{`"${offeredSalary}" isn't a recognisable salary figure — enter something like "7.5 LPA".`}</li>}
              {!branchValid && <li>No campus/branch is set for this candidate — set it on their profile before offering.</li>}
              {!joiningDateValid && <li>Enter a real joining date before dispatching.</li>}
            </ul>
          </div>
        )}

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
                    <td className="p-3 font-mono text-orange-700">{salaryValid ? `₹${annualNum!.toLocaleString('en-IN')} (${offeredSalary})` : `Not a valid figure: ${offeredSalary}`}</td>
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

        </div>

      </div>
    </div>
  );
}
