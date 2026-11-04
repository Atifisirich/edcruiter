'use client';

import React, { useEffect, useState } from 'react';
import type { Candidate, School } from '@/lib/types';
import OfferLetterModal from './OfferLetterModal';

/**
 * Collects the real salary, campus and joining date before the offer letter
 * can be opened, rather than letting the letter fall back to invented ones.
 */
export default function OfferDispatch({ candidate, onSent }: { candidate: Candidate; onSent: (next?: Candidate) => void }) {
  const [school, setSchool] = useState<School | null>(null);
  const [open, setOpen] = useState(false);
  const [salary, setSalary] = useState(candidate.expected_salary || '');
  const [branchId, setBranchId] = useState(candidate.target_branch_id || '');
  const [joining, setJoining] = useState('');

  useEffect(() => {
    if (!open || school) return;
    fetch(`/api/schools?school_id=${encodeURIComponent(candidate.school_id)}`)
      .then((r) => r.json())
      .then((d) => { if (d.school) setSchool(d.school); })
      .catch(() => { /* the campus list stays empty */ });
  }, [open, school, candidate.school_id]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">
        Prepare the offer letter
      </button>
    );
  }

  const branchName = school?.branches?.find((b) => b.id === branchId)?.name || '';
  const field = 'mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900';

  return (
    <div className="w-full space-y-3 p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40">
      <p className="text-sm font-black text-slate-900">Offer details for {candidate.name}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-xs font-bold text-slate-700">
          Offered salary
          <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 7.5 LPA" className={field} />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Campus / branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={field}>
            <option value="">Select…</option>
            {(school?.branches || []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          Joining date
          <input type="date" value={joining} onChange={(e) => setJoining(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-xs text-slate-500">Fill in all three to preview and send the offer letter.</p>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-600 hover:underline cursor-pointer">Close</button>
      {salary.trim() && branchId && joining && (
        <OfferLetterModal
          school={school}
          candidate={candidate}
          offeredSalary={salary.trim()}
          joiningDate={new Date(joining).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          targetBranchName={branchName}
          onClose={() => setJoining('')}
          onDispatched={(next) => { setOpen(false); onSent(next); }}
        />
      )}
    </div>
  );
}
