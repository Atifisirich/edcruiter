'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';
import DeleteCandidatesDialog from '@/components/admin/DeleteCandidatesDialog';
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
      <CandidateProfileModal
        layout="page"
        isOpen
        candidateId={id}
        onClose={() => router.push('/admin/candidates')}
      />

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
