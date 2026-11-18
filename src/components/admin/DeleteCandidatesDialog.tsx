'use client';

import React, { useState } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import type { Candidate } from '@/lib/types';
import { buttonClass, inputClass } from './ui';
import { useAdmin } from './adminContext';

const CONFIRM_WORD = 'DELETE';

/**
 * Asks once, clearly, before candidates are removed for good: it lists every
 * name, says what goes with them, and needs DELETE typed before the button
 * works. Used for one candidate (their report page) and for a ticked list.
 */
export default function DeleteCandidatesDialog({
  candidates,
  onClose,
  onDeleted,
}: {
  candidates: Pick<Candidate, 'id' | 'name' | 'email' | 'applied_subject'>[];
  onClose: () => void;
  onDeleted: (deletedIds: string[]) => void;
}) {
  const { schoolId, refresh, toast } = useAdmin();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const count = candidates.length;
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/candidates/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, candidate_ids: candidates.map((c) => c.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete.');
      const deleted: string[] = data.deleted || [];
      toast(`${deleted.length} ${deleted.length === 1 ? 'candidate' : 'candidates'} deleted.`, 'success');
      await refresh();
      onDeleted(deleted);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby="delete-candidates-title">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h2 id="delete-candidates-title" className="text-base font-semibold text-slate-900">
              Delete {count === 1 ? candidates[0].name : `${count} candidates`} permanently?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Their application, test answers, scores, recordings, CV, flags and messages are removed. This cannot be undone.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {count > 1 && (
          <ul className="px-5 py-3 overflow-y-auto text-sm divide-y divide-slate-100 border-b border-slate-100">
            {candidates.map((c) => (
              <li key={c.id} className="py-1.5 flex justify-between gap-3">
                <span className="font-medium text-slate-900 truncate">{c.name}</span>
                <span className="text-slate-500 truncate">{c.applied_subject || c.email}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="p-5 space-y-3">
          <label className="block text-sm text-slate-700">
            Type <strong>{CONFIRM_WORD}</strong> to confirm
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void run(); }}
              className={`${inputClass} mt-1.5`}
              aria-label={`Type ${CONFIRM_WORD} to confirm`}
            />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={buttonClass('secondary')}>Cancel</button>
            <button type="button" onClick={() => void run()} disabled={!ready} className={buttonClass('danger')}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {busy ? 'Deleting…' : count === 1 ? 'Delete candidate' : `Delete ${count} candidates`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
