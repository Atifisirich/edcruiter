'use client';

import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { buttonClass, inputClass } from '../ui';
import { parseCsvText, parseWorkbook, type ParsedCandidate } from '../ExcelCandidateUploaderModal';

export interface UploadDone { listId: string; added: number; skipped: { name: string; phone: string; why: string }[] }

/**
 * Upload a spreadsheet of people to screen by AI call: a new lead list, or more
 * people for an existing one. A name and a phone number per row are enough.
 */
export default function LeadUploadDialog({ schoolId, listId, onClose, onDone }: { schoolId: string; listId?: string; onClose: () => void; onDone: (r: UploadDone) => void }) {
  const [name, setName] = useState('');
  const [rows, setRows] = useState<ParsedCandidate[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const read = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      const parsed = /\.(xlsx|xls)$/i.test(file.name) ? parseWorkbook(await file.arrayBuffer()) : parseCsvText(await file.text());
      if (!parsed.length) { setRows(null); setError('No rows found. The first row should be headings such as Name and Phone.'); return; }
      setRows(parsed);
      if (!listId && !name) setName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
    } catch {
      setRows(null);
      setError('That file could not be read. Use an Excel file (.xlsx) or a CSV.');
    }
  };

  const withPhone = rows?.filter((r) => r.phone.replace(/\D/g, '').length >= 10).length ?? 0;

  const upload = async () => {
    if (!rows) return;
    setBusy(true);
    setError('');
    try {
      let id = listId;
      if (!id) {
        const r = await fetch('/api/lead-lists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, name }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Could not create the list.');
        id = d.list.id as string;
      }
      const r = await fetch(`/api/lead-lists/${encodeURIComponent(id)}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          school_attested: attested,
          rows: rows.map((x) => ({ name: x.name, phone: x.phone, email: x.email, subject: x.subject, segment: x.segment, qualification: x.qualification, experience: x.experience, prior_org: x.prior_org })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not add the people.');
      onDone({ listId: id, added: d.added, skipped: d.skipped ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={listId ? 'Add people to this list' : 'New lead list'}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">{listId ? 'Add more people' : 'Upload leads to screen'}</h2>
            <p className="text-sm text-slate-500">They stay out of your candidate list. The AI calls them, and only good fits move into Candidates.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={buttonClass('ghost', 'sm')}><X className="w-4 h-4" /></button>
        </div>

        {!listId && (
          <label className="block text-xs font-semibold text-slate-600">
            List name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. November job portal leads" className={`${inputClass} mt-1`} />
          </label>
        )}

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void read(f); }}
          className={`w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer ${rows ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'}`}
        >
          {rows ? (
            <span className="space-y-1 block">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <span className="block text-sm font-bold text-slate-900">{rows.length} people in {fileName}</span>
              <span className="block text-xs text-slate-600">{withPhone} with a phone number{rows.length - withPhone ? ` · ${rows.length - withPhone} without (they will be skipped)` : ''}</span>
            </span>
          ) : (
            <span className="space-y-1 block">
              <FileSpreadsheet className="w-7 h-7 text-indigo-600 mx-auto" />
              <span className="block text-sm font-bold text-slate-900">Choose an Excel or CSV file</span>
              <span className="block text-xs text-slate-500">Columns: Name and Phone are enough. Email, Subject and others are used if present.</span>
            </span>
          )}
        </button>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />

        <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
          <span>The school has permission to contact these people about this job.</span>
        </label>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>Cancel</button>
          <button type="button" onClick={() => void upload()} disabled={!rows || !withPhone || !attested || busy || (!listId && name.trim().length < 2)} className={buttonClass('primary')}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload {withPhone || ''} {withPhone === 1 ? 'person' : 'people'}
          </button>
        </div>
      </div>
    </div>
  );
}
