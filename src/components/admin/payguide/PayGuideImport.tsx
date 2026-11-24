'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import { Badge, buttonClass, selectClass } from '@/components/admin/ui';
import { gradeSummary } from '@/lib/payGuide';
import { displayName, levelLabel, problemsOf, type EditRole } from '@/lib/payGuideEdit';
import type { PayBasis } from '@/lib/payGuideImport';

const inr = (n: string) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`;

/** An example sheet the school can fill in: one row per job, one column per stretch of experience. */
export function downloadExampleSheet() {
  const rows = [
    ['Role', 'Grades', '0-2 years', '2-5 years', '5+ years'],
    ['Pre-primary teacher', 'Nursery, LKG, UKG', 15000, 18000, 22000],
    ['Primary teacher', '1-5', 18000, 22000, 28000],
    ['Middle school teacher', '6-8', 22000, 27000, 34000],
    ['Secondary teacher', '9-10', 26000, 32000, 40000],
    ['Senior secondary teacher', '11-12', 30000, 38000, 48000],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Pay by experience');
  XLSX.writeFile(book, 'Pay_Guide_Example.xlsx');
}

type Read = { roles: EditRole[]; notes: string[]; method: 'sheet' | 'ai' };

export default function PayGuideImport({
  schoolId, campusId, campusName, hasJobsHere, onApply, onClose,
}: {
  schoolId: string;
  /** The campus the jobs are for ('' for every campus). */
  campusId: string;
  campusName: string;
  /** Whether this campus already has jobs, which decides if "replace" is offered. */
  hasJobsHere: boolean;
  onApply: (roles: EditRole[], mode: 'add' | 'replace') => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [basis, setBasis] = useState<PayBasis>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorNotes, setErrorNotes] = useState<string[]>([]);
  const [read, setRead] = useState<Read | null>(null);
  const [mode, setMode] = useState<'add' | 'replace'>('add');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async (f: File, b: PayBasis) => {
    setBusy(true);
    setError('');
    setErrorNotes([]);
    setRead(null);
    try {
      const body = new FormData();
      body.set('school_id', schoolId);
      body.set('file', f);
      body.set('branch', campusId);
      body.set('basis', b);
      const res = await fetch('/api/pay-guide/import', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not read this file.'); setErrorNotes(data.notes ?? []); return; }
      setRead({ roles: data.roles, notes: data.notes ?? [], method: data.method });
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    void send(f, basis);
  };

  const incomplete = read ? read.roles.filter((r) => problemsOf(r).length > 0).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="pg-import-title">
      <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <h2 id="pg-import-title" className="text-lg font-bold text-slate-900">Bring in your pay sheet</h2>
            <p className="text-sm text-slate-500">Upload the Excel or PDF you already use. We read the jobs and the pay for each stretch of experience, and you check them before anything is saved.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={buttonClass('ghost', 'sm')}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {/* 1. Choose the file */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]); }}
            className={`rounded-2xl border-2 border-dashed p-6 text-center ${drag ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50'}`}
          >
            {busy ? (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700"><Loader2 className="w-4 h-4 animate-spin" /> Reading {file?.name}…</p>
            ) : (
              <>
                <UploadCloud className="mx-auto w-8 h-8 text-indigo-600" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{file ? file.name : 'Drop your pay sheet here'}</p>
                <p className="text-sm text-slate-500">Excel (.xlsx, .xls), CSV or PDF, up to 5 MB</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => input.current?.click()} className={buttonClass('primary')}><FileSpreadsheet className="w-4 h-4" /> {file ? 'Choose a different file' : 'Choose a file'}</button>
                  <button type="button" onClick={downloadExampleSheet} className={buttonClass('secondary')}><Download className="w-4 h-4" /> Download an example sheet</button>
                </div>
              </>
            )}
            <input ref={input} type="file" accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt,.pdf,application/pdf,text/csv" className="sr-only" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          </div>

          <details className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold text-slate-900">What should my sheet look like?</summary>
            <div className="mt-3 space-y-2">
              <p>The simplest: one row for each job, and one column for each stretch of experience.</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="p-2">Role</th><th className="p-2">Grades</th><th className="p-2">0-2 years</th><th className="p-2">2-5 years</th><th className="p-2">5+ years</th></tr></thead>
                  <tbody><tr><td className="p-2">Primary teacher</td><td className="p-2">1-5</td><td className="p-2">18000</td><td className="p-2">22000</td><td className="p-2">28000</td></tr></tbody>
                </table>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Pay can be one figure, or a range like 22,000-26,000. We fill the lowest and highest around a single figure.</li>
                <li>You can also give Min, Usual and Max in three small columns under each stretch of experience.</li>
                <li>Extra columns we use if they are there: Campus, Subject, B.Ed top-up, M.Ed top-up. A sheet named after a campus is read for that campus.</li>
                <li>Yearly figures (CTC, LPA, per annum) are divided by 12 for you.</li>
                <li>Your own layout is fine too. If we cannot read it, an AI reads it and you check the figures.</li>
              </ul>
            </div>
          </details>

          {error && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <p className="flex items-start gap-2 font-semibold"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</p>
              {errorNotes.map((n) => <p key={n} className="mt-1 pl-6">{n}</p>)}
            </div>
          )}

          {/* 2. Check what was read */}
          {read && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Found {read.roles.length} {read.roles.length === 1 ? 'job' : 'jobs'}</p>
                {read.method === 'ai' && <Badge tone="amber"><Sparkles className="w-3 h-3" /> Read by AI. Check the figures.</Badge>}
                {incomplete > 0 && <Badge tone="amber">{incomplete} need a small fix after</Badge>}
              </div>

              {read.notes.length > 0 && (
                <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {read.notes.map((n) => <li key={n}>• {n}</li>)}
                </ul>
              )}

              <ul className="space-y-3">
                {read.roles.map((r) => {
                  const problems = problemsOf(r);
                  return (
                    <li key={r.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{displayName(r)}</p>
                        <p className="text-xs text-slate-500">{r.grades.length ? gradeSummary(r.grades) : 'Grades not found'}{r.subjects.length ? ` · ${r.subjects.join(', ')}` : ''}</p>
                      </div>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-3 font-medium">Experience</th><th className="py-1 pr-3 font-medium">Lowest</th><th className="py-1 pr-3 font-medium">Usual</th><th className="py-1 font-medium">Highest</th></tr></thead>
                          <tbody className="tabular-nums">
                            {r.tiers.map((t, i) => (
                              <tr key={i} className="border-t border-slate-100">
                                <td className="py-1.5 pr-3 text-slate-700">{levelLabel(t)}</td>
                                <td className="py-1.5 pr-3">{t.min ? inr(t.min) : '-'}</td>
                                <td className="py-1.5 pr-3 font-semibold text-slate-900">{t.ideal ? inr(t.ideal) : '-'}</td>
                                <td className="py-1.5">{t.max ? inr(t.max) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {(r.bed || r.masters) && <p className="mt-1 text-xs text-slate-500">Extra for {[r.bed && `a B.Ed: ${inr(r.bed)}`, r.masters && `a master’s: ${inr(r.masters)}`].filter(Boolean).join(' · ')} a month</p>}
                      {problems.length > 0 && <p className="mt-2 text-xs font-medium text-amber-800">{problems[0]}</p>}
                    </li>
                  );
                })}
              </ul>

              {hasJobsHere && (
                <fieldset className="rounded-xl border border-slate-200 p-3 text-sm">
                  <legend className="px-1 text-xs font-semibold text-slate-500">{campusName} already has jobs</legend>
                  <label className="flex items-center gap-2 py-1"><input type="radio" name="pg-mode" checked={mode === 'add'} onChange={() => setMode('add')} /> Add these next to my existing jobs</label>
                  <label className="flex items-center gap-2 py-1"><input type="radio" name="pg-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace my existing jobs with these</label>
                </fieldset>
              )}
              <p className="text-sm text-slate-500">These go into the editor for {campusName}. Nothing is saved until you press “Save the Pay Guide”.</p>
            </div>
          )}

          {/* Fix a wrong reading */}
          {(read || error) && file && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>Numbers look wrong?</span>
              <select value={basis} onChange={(e) => { const b = e.target.value as PayBasis; setBasis(b); void send(file, b); }} className={`${selectClass} !w-auto`} aria-label="How the figures are written">
                <option value="auto">Work it out for me</option>
                <option value="monthly">These are monthly figures</option>
                <option value="yearly">These are yearly figures</option>
              </select>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>Cancel</button>
          <button type="button" disabled={!read || read.roles.length === 0 || busy} onClick={() => read && onApply(read.roles, hasJobsHere ? mode : 'add')} className={buttonClass('primary')}>
            Use {read ? read.roles.length : ''} {read?.roles.length === 1 ? 'job' : 'jobs'}
          </button>
        </div>
      </div>
    </div>
  );
}
