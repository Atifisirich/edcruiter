'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';
import DeleteCandidatesDialog from '@/components/admin/DeleteCandidatesDialog';
import ScreeningCallPanel from '@/components/admin/ScreeningCallPanel';
import AiInterviewPanel from '@/components/admin/AiInterviewPanel';
import { useAdmin } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import { isAdmin } from '@/lib/permissions';

export default function CandidateReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params.id as string) || '';
  const { user, candidates } = useAdmin();
  const [confirming, setConfirming] = useState(false);

  const candidate = candidates.find((c) => c.id === id);
  // Only the school admin (or Edcruiter support) removes a candidate.
  const canDelete = isAdmin(user?.role) && !!candidate;

  return (
    <>
      {candidate && (
        <a href="#ai-interview" className="mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-900 hover:bg-indigo-100 transition-colors">
          <span><strong>AI interview</strong>: invite {candidate.name.split(' ')[0]} to a spoken interview, try it yourself, or read the report.</span>
          <span className="font-bold shrink-0">Go to it ↓</span>
        </a>
      )}
      <CandidateProfileModal
        layout="page"
        isOpen
        candidateId={id}
        onClose={() => router.push('/admin/candidates')}
      />

      {candidate && <ScreeningCallPanel candidateId={candidate.id} candidateName={candidate.name} />}

      {candidate && <AiInterviewPanel candidateId={candidate.id} candidateName={candidate.name} />}

      {canDelete && (
        <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/50 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-rose-900">Delete this candidate</h2>
            <p className="text-sm text-rose-800/80">Removes {candidate.name} and everything they submitted, for good.</p>
          </div>
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass('danger', 'sm')}>
            <Trash2 className="w-4 h-4" /> Delete candidate
          </button>
        </section>
      )}

      {confirming && candidate && (
        <DeleteCandidatesDialog
          candidates={[candidate]}
          onClose={() => setConfirming(false)}
          onDeleted={() => router.push('/admin/candidates')}
        />
      )}
    </>
  );
}
