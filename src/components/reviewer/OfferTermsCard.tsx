'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import type { OfferTerms } from '@/lib/types';
import { MAX_TERM_TEXT, termLines } from '@/lib/offerTerms';

type Form = Pick<OfferTerms, 'accommodation' | 'accommodation_note' | 'pf' | 'pf_note' | 'other' | 'include_in_letter'>;
const EMPTY: Form = { accommodation: '', accommodation_note: '', pf: '', pf_note: '', other: '', include_in_letter: false };
const field = 'mt-1 w-full p-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900';

/**
 * What goes with the salary: accommodation, PF and anything else promised.
 * Shown only to those who may see pay (the server refuses everyone else, and
 * then this renders nothing).
 */
export default function OfferTermsCard({ candidateId, onSaved }: { candidateId: string; onSaved?: (terms: OfferTerms) => void }) {
  const [terms, setTerms] = useState<OfferTerms | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/candidates/${candidateId}/offer-terms`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) { setAllowed(true); setTerms(d.terms); } })
      .catch(() => { /* the card stays hidden */ });
    return () => { cancelled = true; };
  }, [candidateId]);

  if (!allowed) return null;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const open = () => { setForm(terms ? { ...EMPTY, ...terms } : EMPTY); setError(''); setEditing(true); };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/candidates/${candidateId}/offer-terms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not save.'); return; }
      setTerms(data.terms);
      setEditing(false);
      onSaved?.(data.terms);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const lines = termLines(terms);
  const yesNo = (label: string, key: 'accommodation' | 'pf', noteKey: 'accommodation_note' | 'pf_note', placeholder: string) => (
    <div className="grid sm:grid-cols-[10rem_1fr] gap-2">
      <label className="block text-xs font-bold text-slate-700">
        {label}
        <select value={form[key]} onChange={(e) => set(key, e.target.value as Form['pf'])} className={field}>
          <option value="">Not discussed</option>
          <option value="yes">Provided</option>
          <option value="no">Not provided</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-700">
        Details
        <input value={form[noteKey]} maxLength={MAX_TERM_TEXT} onChange={(e) => set(noteKey, e.target.value)} placeholder={placeholder} className={field} />
      </label>
    </div>
  );

  return (
    <section aria-label="Offer conditions" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Offer conditions</h2>
          <p className="text-xs text-slate-500">Accommodation, PF and anything else agreed with the salary. Your team sees this; the teacher only if you put it in the letter.</p>
        </div>
        {!editing && (
          <button type="button" onClick={open} className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer print:hidden">
            <Pencil className="w-3.5 h-3.5" /> {lines.length ? 'Edit' : 'Add conditions'}
          </button>
        )}
      </div>

      {!editing && (lines.length ? (
        <>
          <ul className="space-y-1.5">
            {lines.map((l) => <li key={l} className="flex gap-2 text-sm text-slate-800"><Check className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" />{l}</li>)}
          </ul>
          <p className="text-[11px] text-slate-500">{terms!.include_in_letter ? 'Printed in the offer letter. ' : 'Not printed in the offer letter. '}Last saved by {terms!.updated_by} on {new Date(terms!.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
        </>
      ) : <p className="text-sm text-slate-500">Nothing recorded yet.</p>)}

      {editing && (
        <div className="space-y-3">
          {yesNo('Accommodation', 'accommodation', 'accommodation_note', 'e.g. shared room on campus, from joining')}
          {yesNo('Provident fund (PF)', 'pf', 'pf_note', 'e.g. after probation')}
          <label className="block text-xs font-bold text-slate-700">
            Other conditions (one per line)
            <textarea value={form.other} maxLength={MAX_TERM_TEXT} rows={3} onChange={(e) => set('other', e.target.value)} placeholder="e.g. Free transport from Kukatpally" className={field} />
          </label>
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.include_in_letter} onChange={(e) => set('include_in_letter', e.target.checked)} className="mt-0.5" />
            Print these conditions in the offer letter the teacher gets
          </label>
          {error && <p role="alert" className="text-xs text-rose-700 font-semibold">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void save()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save conditions
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-bold text-slate-600 hover:underline cursor-pointer">Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
