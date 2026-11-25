'use client';

import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { buttonClass, inputClass, selectClass } from '../ui';
import { csvMatrix, leadRowsFrom, phoneIn, readSheet, type LeadField, type SheetRead } from '@/lib/leadSheet';

export interface UploadDone { listId: string; added: number; skipped: { name: string; phone: string; why: string }[] }

/** The first sheet of a workbook as rows of cells. A number keeps its full digits (a phone stored as a number). */
function workbookMatrix(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws || !ws['!ref']) return [];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const out: unknown[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: unknown[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      if (!cell) { row.push(''); continue; }
      // Long whole numbers (phones) from the value; everything else as Excel shows it (dates, money).
      row.push(cell.t === 'n' && typeof cell.v === 'number' && Number.isInteger(cell.v) && Math.abs(cell.v) >= 1e6 ? cell.v : cell.w ?? cell.v ?? '');
    }
    out.push(row);
  }
  return out;
}

/**
 * Upload a spreadsheet of people to screen by AI call: a new lead list, or more
 * people for an existing one. The name and phone columns are found by what is
 * in them, shown to HR to correct, and every other column is kept as the
 * person's form answers, which the AI reads before the call.
 */
export default function LeadUploadDialog({ schoolId, listId, onClose, onDone }: { schoolId: string; listId?: string; onClose: () => void; onDone: (r: UploadDone) => void }) {
  const [name, setName] = useState('');
  const [sheet, setSheet] = useState<SheetRead | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<LeadField, number>>>({});
  const [fileName, setFileName] = useState('');
  const [attested, setAttested] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const read = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      const matrix = /\.(xlsx|xls)$/i.test(file.name) ? workbookMatrix(await file.arrayBuffer()) : csvMatrix(await file.text());
      const s = readSheet(matrix);
      if (!s.rows.length) { setSheet(null); setError('No people found in that file.'); return; }
      setSheet(s);
      setMapping(s.mapping);
      if (!listId && !name) setName(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
    } catch {
      setSheet(null);
      setError('That file could not be read. Use an Excel file (.xlsx) or a CSV.');
    }
  };

  const rows = useMemo(() => (sheet ? leadRowsFrom(sheet, mapping) : []), [sheet, mapping]);
  const ready = rows.filter((r) => r.name && phoneIn(r.phone));
  const answerColumns = sheet ? sheet.columns.filter((c) => !Object.values(mapping).includes(c.index) && rows.some((r) => r.answers.some((a) => a.q === c.header.slice(0, 120)))) : [];

  const pick = (field: 'name' | 'phone', value: string) => {
    setMapping((m) => {
      const next = { ...m };
      if (value === '') delete next[field]; else next[field] = Number(value);
      // A column is used for one thing only.
      for (const k of Object.keys(next) as LeadField[]) if (k !== field && next[k] === next[field]) delete next[k];
      return next;
    });
  };

  const upload = async () => {
    if (!sheet) return;
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
        body: JSON.stringify({ school_id: schoolId, school_attested: attested, rows }),
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

  const columnOption = (i: number) => {
    const c = sheet!.columns[i];
    return `${c.header}${c.sample[0] ? ` (e.g. ${c.sample[0].slice(0, 24)})` : ''}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={listId ? 'Add people to this list' : 'New lead list'}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[92vh] overflow-y-auto">
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
          className={`w-full rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer ${sheet ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'}`}
        >
          {sheet ? (
            <span className="space-y-1 block">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
              <span className="block text-sm font-bold text-slate-900">{rows.length} {rows.length === 1 ? 'row' : 'rows'} in {fileName}</span>
              <span className="block text-xs text-slate-600">
                {ready.length} with a name and phone number{rows.length - ready.length ? ` · ${rows.length - ready.length} without (they will be skipped)` : ''}
                {sheet.cutOff ? ` · ${sheet.cutOff} more after the first 5,000 were left out` : ''}
              </span>
              <span className="block text-xs text-indigo-700 font-semibold">Choose another file</span>
            </span>
          ) : (
            <span className="space-y-1 block">
              <FileSpreadsheet className="w-7 h-7 text-indigo-600 mx-auto" />
              <span className="block text-sm font-bold text-slate-900">Choose an Excel or CSV file</span>
              <span className="block text-xs text-slate-500">Any layout. We find the name and phone columns, and keep every other column (place, qualification, form answers).</span>
            </span>
          )}
        </button>
        <input ref={input} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ''; }} />

        {sheet && (
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-900">Check the columns</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {(['name', 'phone'] as const).map((f) => (
                <label key={f} className="block text-xs font-semibold text-slate-600">
                  {f === 'name' ? 'Name is in' : 'Phone number is in'}
                  <select value={mapping[f] ?? ''} onChange={(e) => pick(f, e.target.value)} className={`${selectClass} mt-1 w-full`}>
                    <option value="">Choose a column…</option>
                    {sheet.columns.map((c) => <option key={c.index} value={c.index}>{columnOption(c.index)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {ready[0] && <p className="text-xs text-slate-600">First person: <strong className="text-slate-900">{ready[0].name}</strong>, {ready[0].phone}</p>}
            {answerColumns.length > 0 && (
              <p className="text-xs text-slate-600">
                Also kept, and read by the AI before each call so it does not ask again:{' '}
                <span className="text-slate-800">{answerColumns.map((c) => c.header).slice(0, 8).join(' · ')}{answerColumns.length > 8 ? ` and ${answerColumns.length - 8} more` : ''}</span>
              </p>
            )}
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
          <span>The school has permission to contact these people about this job.</span>
        </label>

        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>Cancel</button>
          <button type="button" onClick={() => void upload()} disabled={!sheet || !ready.length || !attested || busy || (!listId && name.trim().length < 2)} className={buttonClass('primary')}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload {ready.length || ''} {ready.length === 1 ? 'person' : 'people'}
          </button>
        </div>
      </div>
    </div>
  );
}

