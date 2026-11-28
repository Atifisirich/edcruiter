'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import type { Candidate, OfferLetterTemplate, School } from '@/lib/types';
import OfferLetterModal from './OfferLetterModal';
import SalaryInput from '@/components/SalaryInput';
import { salaryOf } from '@/lib/salary';
import { joiningDateProblem, letterDetails, STANDARD_LETTER } from '@/lib/offerTemplates';

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Collects the real salary, campus, joining date and which letter to use
 * before the offer letter can be opened. Nothing opens or is sent while these
 * are being typed: the letter opens only on "Preview offer letter", and is
 * marked sent only from inside it.
 */
export default function OfferDispatch({
  candidate,
  onSent,
  recordSentAt,
}: {
  candidate: Candidate;
  onSent: (next?: Candidate) => void;
  /** Set when the offer already went out and only a copy is being added: the day it was sent. */
  recordSentAt?: string;
}) {
  const [school, setSchool] = useState<School | null>(null);
  const [templates, setTemplates] = useState<OfferLetterTemplate[]>([]);
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  // The approved final offer when there is one, else what the teacher asked for. Rupees a month.
  const approved = candidate.final_offer?.status === 'approved' ? candidate.final_offer : undefined;
  const asked = salaryOf(candidate, 'expected').monthly;
  const [salary, setSalary] = useState(approved ? String(approved.monthly) : asked ? String(asked) : '');
  const [branchId, setBranchId] = useState(candidate.target_branch_id || '');
  const [joining, setJoining] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open || school) return;
    const id = encodeURIComponent(candidate.school_id);
    fetch(`/api/schools?school_id=${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.school) setSchool(d.school); })
      .catch(() => { /* the campus list stays empty */ });
    fetch(`/api/offer-templates?school_id=${id}`)
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => { /* only the standard letter */ });
  }, [open, school, candidate.school_id]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">
        {recordSentAt ? 'Add the letter details to view it' : 'Prepare the offer letter'}
      </button>
    );
  }

  const branchName = school?.branches?.find((b) => b.id === branchId)?.name || '';
  const monthly = Number(salary);
  // A copy of an earlier letter is checked against the day it was sent, not today.
  const today = recordSentAt ? new Date(recordSentAt) : new Date();
  const latest = new Date(today); latest.setFullYear(latest.getFullYear() + 1);
  const problems = [
    !(monthly >= 1000 && monthly <= 1_000_000) && 'Type the offered salary as rupees a month (e.g. 35000).',
    !branchName && 'Choose the campus.',
    joiningDateProblem(joining, today),
  ].filter(Boolean) as string[];
  const template = templates.find((t) => t.id === templateId) ?? null;
  const field = 'mt-1 w-full p-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900';

  return (
    <div className="w-full space-y-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
      <p className="text-sm font-black text-slate-900">Offer details for {candidate.name}</p>
      {recordSentAt && <p className="text-xs text-slate-600">Type exactly what was in the letter you sent. This only saves a copy for viewing; nothing is sent to the teacher.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SalaryInput
          label={<span className="text-xs font-bold text-slate-700">Offered salary</span>}
          value={salary}
          onChange={setSalary}
          hint={approved ? `From the approved offer of ₹${approved.monthly.toLocaleString('en-IN')} a month.` : 'Monthly, in rupees, numbers only (e.g. 35000).'}
        />
        <label className="block text-xs font-bold text-slate-700">
          Campus
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={field}>
            <option value="">Select…</option>
            {(school?.branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Joining date
          {/* Only kept here while typing. Nothing opens until "Preview offer letter" is pressed. */}
          <input type="date" value={joining} min={isoDay(today)} max={isoDay(latest)} onChange={(e) => setJoining(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Letter
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={field}>
            <option value="">{STANDARD_LETTER}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Link href="/admin/offer-letters" className="mt-1 inline-block font-normal text-indigo-700 hover:underline">Add or edit your school’s letters</Link>
        </label>
      </div>
      {tried && problems.length > 0 && (
        <ul role="alert" className="text-xs text-rose-800 list-disc pl-4 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { setTried(true); if (problems.length === 0) setPreviewing(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer"
        >
          <Eye className="w-4 h-4" /> Preview offer letter
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-600 hover:underline cursor-pointer">Close</button>
      </div>
      {previewing && problems.length === 0 && (
        <OfferLetterModal
          candidate={candidate}
          school={school}
          details={letterDetails(candidate, school, { monthly, joining_iso: joining, campus: branchName }, recordSentAt ? isoDay(today) : undefined)}
          monthly={monthly}
          template={template}
          send={{ monthly, joining_iso: joining, campus: branchName, template_id: template?.id }}
          recordOnly={!!recordSentAt}
          onClose={() => setPreviewing(false)}
          onDispatched={(next) => { setPreviewing(false); setOpen(false); onSent(next); }}
        />
      )}
    </div>
  );
}
