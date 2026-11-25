'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RotateCcw, Trash2, UserX } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import CandidateProfileModal from '@/components/reviewer/CandidateProfileModal';
import DeleteCandidatesDialog from '@/components/admin/DeleteCandidatesDialog';
import ScreeningCallPanel from '@/components/admin/ScreeningCallPanel';
import AiInterviewPanel from '@/components/admin/AiInterviewPanel';
import { useAdmin } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import { isHiringTeam } from '@/lib/permissions';

export default function CandidateReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params.id as string) || '';
  const { user, candidates, schoolId, refresh, toast } = useAdmin();
  const [confirming, setConfirming] = useState(false);

  // Someone set aside as "Not responding" is not in the main list, so they are looked up there.
  const [setAside, setSetAside] = useState<Candidate | null>(null);
  const inMain = candidates.find((c) => c.id === id);
  const loadSetAside = useCallback(async () => {
    if (!schoolId || !id) return;
    const r = await fetch(`/api/candidates?school_id=${schoolId}&not_responding=only`).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => ({})) : {};
    setSetAside(((d.candidates ?? []) as Candidate[]).find((c) => c.id === id) ?? null);
  }, [schoolId, id]);
  useEffect(() => {
    if (inMain) return;
    const start = window.setTimeout(() => void loadSetAside(), 0);
    return () => window.clearTimeout(start);
  }, [inMain, loadSetAside]);
  const candidate = inMain ?? setAside ?? undefined;
  const nr = !inMain ? setAside?.not_responding : null;
  const [movingBack, setMovingBack] = useState(false);
  const moveBack = async () => {
    if (!candidate) return;
    setMovingBack(true);
    try {
      const r = await fetch('/api/candidates/not-responding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, action: 'move_back', candidate_ids: [candidate.id] }),
      }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      if (d.moved) { await refresh(); setSetAside(null); toast(`${candidate.name} is back in the main list.`, 'success'); }
      else toast(d.skipped?.[0]?.reason || d.error || 'That could not be saved. Try again.', 'error');
    } finally {
      setMovingBack(false);
    }
  };
  // Only the school admin (or Edcruiter support) removes a candidate.
  const canDelete = isHiringTeam(user?.role) && !!candidate;

  return (
    <>
      {nr && candidate && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <p className="flex items-start gap-2 text-sm text-amber-950">
            <UserX className="w-4 h-4 mt-0.5 shrink-0 text-amber-700" />
            <span>
              In <strong>Not responding</strong> since {new Date(nr.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })}, moved by {nr.by_name}.
              No automatic calls or messages go to them. Nothing was deleted.
            </span>
          </p>
          {isHiringTeam(user?.role) && (
            <button type="button" disabled={movingBack} onClick={() => void moveBack()} className={buttonClass('secondary', 'sm')}>
              <RotateCcw className="w-4 h-4" /> {movingBack ? 'Moving…' : 'Move back to Candidates'}
            </button>
          )}
        </div>
      )}
      <CandidateProfileModal
        layout="page"
        isOpen
        candidateId={id}
        onClose={() => router.push('/admin/candidates')}
        renderInterview={candidate ? (onChange) => <AiInterviewPanel candidateId={candidate.id} candidateName={candidate.name} onChange={onChange} mode={candidate.interview_mode} onModeChange={async () => { await refresh(); if (!inMain) await loadSetAside(); }} /> : undefined}
      />

      {candidate && <ScreeningCallPanel candidateId={candidate.id} candidateName={candidate.name} />}


      {canDelete && (
        <section className="mt-8 rounded-2xl border border-rose-200 print:hidden bg-rose-50/50 p-5 flex flex-wrap items-center justify-between gap-3">
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
