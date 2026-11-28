'use client';

import Link from 'next/link';
import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet, Upload, CheckCircle2, X,
  Download, ArrowRight, Loader2, Check, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { flagDuplicateLeads, type CvLead } from '@/lib/cvLead';
import InterviewModePicker from '@/components/admin/InterviewModePicker';
import type { InterviewMode } from '@/lib/types';
import { csvMatrix, type LeadField } from '@/lib/leadSheet';
import { CHOOSABLE_FIELDS, candidatesFrom, readCandidateSheet, rowProblem, type CandidateSheet } from '@/lib/candidateSheet';

export interface ParsedCandidate {
  name: string;
  email: string;
  phone: string;
  subject: string;
  segment: string;
  qualification: string;
  experience: string;
  prior_org: string;
  /** Rupees a month, read from the sheet's salary columns. */
  current_salary_monthly?: number;
  expected_salary_monthly?: number;
  /** Set on rows read from a CV: the file name and what to check. */
  source?: string;
  warnings?: string[];
}

interface ExcelCandidateUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV_DATA = `Name,Email,Phone,Subject,Segment,Qualification,Experience,PreviousSchool,CurrentSalaryMonthly,ExpectedSalaryMonthly
Dr. Priya Nair,priya.science@gmail.com,+91 98765 11223,Physics,Senior Secondary (Grades 11-12),M.Sc (Physics) + B.Ed,4.5 Years,Delhi Public School,42000,48000
Sanjay Mukherjee,sanjay.math@gmail.com,+91 98765 22334,Mathematics,Secondary (Grades 9-10),M.Sc (Math) + B.Ed,3.0 Years,Oakridge International,35000,40000
Kavita Deshmukh,kavita.bio@gmail.com,+91 98765 33445,Biology,Secondary (Grades 9-10),M.Sc (Botany) + B.Ed,5.0 Years,Chirec International,38000,45000`;

function matrixFromWorkbook(buffer: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  // raw: true so a phone number Excel stored as a number stays whole (readSheet writes it out).
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
}

export default function ExcelCandidateUploaderModal({
  isOpen,
  onClose,
  onSuccess
}: ExcelCandidateUploaderModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCandidate[]>([]);
  // The sheet as read, so HR can change which column is which. Null for CVs.
  const [sheet, setSheet] = useState<CandidateSheet | null>(null);
  const [columns, setColumns] = useState<Partial<Record<LeadField, number>>>({});
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const [contactAttested, setContactAttested] = useState(false);
  // Send each teacher their WhatsApp test invite straight after the import.
  const [sendInvites, setSendInvites] = useState(true);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('five_stage');
  const [inviteResult, setInviteResult] = useState<{
    summary?: { sent: number; already_invited: number; no_phone: number; no_consent: number; waiting_for_daily_limit: number; failed: number };
    firstFailure?: string;
    error?: string;
    imported: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [cvProgress, setCvProgress] = useState<{ done: number; total: number } | null>(null);
  const [cvUnreadable, setCvUnreadable] = useState<{ filename: string; error: string }[]>([]);

  if (!isOpen) return null;

  const schoolIdForRequests = () =>
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  // Reads CVs five at a time, so one slow file cannot stall the whole batch,
  // and shows progress. Nothing is saved until the school confirms the import.
  const handleCvFiles = async (picked: FileList | File[]) => {
    const pdfs = Array.from(picked).filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (pdfs.length === 0) {
      setParseError('Choose CVs in PDF format.');
      return;
    }
    const files = pdfs.slice(0, 50);
    setParseError(pdfs.length > files.length ? `Only the first 50 of ${pdfs.length} CVs were read. Import these, then add the rest.` : '');
    setParsedRows([]);
    setSheet(null);
    setCvUnreadable([]);
    setFileName(`${files.length} CV${files.length === 1 ? '' : 's'}`);
    setCvProgress({ done: 0, total: files.length });

    const rows: ParsedCandidate[] = [];
    const unreadable: { filename: string; error: string }[] = [];
    for (let i = 0; i < files.length; i += 5) {
      const batch = files.slice(i, i + 5);
      const form = new FormData();
      form.append('school_id', schoolIdForRequests());
      batch.forEach((f) => form.append('files', f));
      try {
        const res = await fetch('/api/candidates/cv-parse', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not read these CVs.');
        for (const r of data.results as Array<{ filename: string; ok: boolean; error?: string; lead?: CvLead }>) {
          if (r.ok && r.lead) rows.push(r.lead);
          else unreadable.push({ filename: r.filename, error: r.error || 'Could not be read.' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not read these CVs.';
        batch.forEach((f) => unreadable.push({ filename: f.name, error: message }));
      }
      setCvProgress({ done: Math.min(i + batch.length, files.length), total: files.length });
    }

    setCvProgress(null);
    setCvUnreadable(unreadable);
    if (rows.length === 0) {
      setParseError('None of these CVs could be read. See the reasons below, or use an Excel file.');
      return;
    }
    setParsedRows(flagDuplicateLeads(rows.map((r) => ({ ...r, warnings: r.warnings ?? [] }))));
  };

  const updateRow = (idx: number, patch: Partial<ParsedCandidate>) =>
    setParsedRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRow = (idx: number) => setParsedRows((rows) => rows.filter((_, i) => i !== idx));
  // A lead needs a name and a real way to reach them.
  const incompleteCount = parsedRows.filter((r) => rowProblem(r) !== null).length;

  const showSheet = (read: CandidateSheet) => {
    setSheet(read);
    setColumns(read.mapping);
    setParsedRows(candidatesFrom(read));
  };

  /** HR changed a column. The rows are read again, so edits typed into the table are replaced. */
  const chooseColumn = (field: LeadField, value: string) => {
    if (!sheet) return;
    const next = { ...columns };
    if (value === '') delete next[field];
    else next[field] = Number(value);
    setColumns(next);
    setParsedRows(candidatesFrom(sheet, next));
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError('');
    setParsedRows([]);
    setSheet(null);
    const lower = file.name.toLowerCase();

    try {
      let matrix: unknown[][];
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        matrix = csvMatrix(await file.text());
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        matrix = matrixFromWorkbook(await file.arrayBuffer());
      } else {
        // Try Excel first, then CSV text
        try {
          matrix = matrixFromWorkbook(await file.arrayBuffer());
        } catch {
          matrix = csvMatrix(await file.text());
        }
      }

      const read = readCandidateSheet(matrix);
      if (candidatesFrom(read).length === 0) {
        setParseError(
          'No valid leads found. Use columns like Name, Phone, Subject (Email optional). Download the template or try CSV.'
        );
        return;
      }
      showSheet(read);
    } catch {
      setParseError('Could not read this file. Save as .xlsx or .csv and try again.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_DATA], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Edcruiter_Teacher_Leads_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadSample = () => {
    setFileName('Sample_Teacher_Leads.csv');
    setParseError('');
    showSheet(readCandidateSheet(csvMatrix(SAMPLE_CSV_DATA)));
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return;
    if (!contactAttested) {
      setImportError('Confirm that the school has permission to contact these candidates before importing.');
      return;
    }
    setImporting(true);
    setImportError('');
    try {
      const schoolId =
        (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

      // A single batch request, not one call per row — this both matches
      // the API's bulk-import path (which records one school-attested
      // consent decision for the whole list) and avoids what the old
      // per-row loop did: each call hit the public single-applicant
      // endpoint, so importing more than a handful of rows tripped that
      // endpoint's anti-spam rate limit, and every call issued a fresh
      // candidate login cookie in the admin's own browser — the admin's
      // session ended up "signed in" as whichever candidate imported last.
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          school_attested: true,
          interview_mode: interviewMode,
          candidates: parsedRows.map((row) => ({
            school_id: schoolId,
            name: row.name,
            email: row.email,
            phone: row.phone,
            applied_subject: row.subject,
            applied_segment: row.segment,
            qualification: row.qualification || undefined,
            experience_band: row.experience || undefined,
            prior_org: row.prior_org || undefined,
            ...(row.current_salary_monthly !== undefined ? { current_salary_monthly: row.current_salary_monthly } : {}),
            ...(row.expected_salary_monthly !== undefined ? { expected_salary_monthly: row.expected_salary_monthly } : {}),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch import failed.');

      const importedIds: string[] = (data.candidates || []).map((c: { id: string }) => c.id);

      if (sendInvites && importedIds.length > 0) {
        // The profiles exist now. Send the invites and show what happened
        // instead of closing, so a school can see who did not get one and why.
        let result: NonNullable<typeof inviteResult> = { imported: importedIds.length };
        try {
          const inv = await fetch('/api/whatsapp/invite-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ school_id: schoolId, candidate_ids: importedIds }),
          });
          const invData = await inv.json();
          result = inv.ok
            ? { imported: importedIds.length, summary: invData.summary, firstFailure: invData.first_failure }
            : { imported: importedIds.length, error: invData.error || 'The invites could not be sent.' };
        } catch {
          result = { imported: importedIds.length, error: 'The invites could not be sent. Check your connection, then send them from the candidate list.' };
        }
        setInviteResult(result);
        return;
      }

      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onSuccess();
        onClose();
      }, 900);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Batch import failed. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Bulk import teacher leads</h3>
              <p className="text-xs text-slate-500">
                Excel or CSV with Name + Phone + Subject (email optional). Up to 200 rows.
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                Many leads to filter first? <Link href="/admin/leads" className="font-bold underline">Use Lead screening</Link>: the AI calls them and only good fits come here.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {parsedRows.length === 0 ? (
          <div className="space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 sm:p-10 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer space-y-3 ${
                dragActive
                  ? 'border-indigo-600 bg-indigo-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-900">
                  Drop Excel / CSV here, or <span className="text-indigo-600 underline">browse</span>
                </p>
                <span className="text-[11px] text-slate-500 block">
                  Columns: Name, Phone, Subject — Email / Grade / Qualification optional
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 text-xs text-slate-700 space-y-2">
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleCvFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <p className="font-extrabold text-slate-900 text-sm">Or add teachers from their CVs</p>
              <p>
                Choose up to 50 CV PDFs. AI reads the name, phone, email, subject and experience off each one.
                You check the list before anything is saved, and the CV files are not stored.
              </p>
              {cvProgress ? (
                <p className="font-bold text-indigo-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reading CVs… {cvProgress.done} of {cvProgress.total}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => cvInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-white border border-indigo-300 text-indigo-700 font-bold hover:bg-indigo-50"
                >
                  Choose CV PDFs
                </button>
              )}
            </div>

            {cvUnreadable.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">{cvUnreadable.length} file{cvUnreadable.length === 1 ? '' : 's'} could not be read:</p>
                <ul className="list-disc pl-4">
                  {cvUnreadable.map((u) => <li key={u.filename}><strong>{u.filename}</strong> — {u.error}</li>)}
                </ul>
              </div>
            )}

            {parseError && (
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV template
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              >
                Load demo sample
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  {parsedRows.length} lead{parsedRows.length === 1 ? '' : 's'} from {fileName || 'file'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParsedRows([]);
                  setSheet(null);
                  setFileName(null);
                  setParseError('');
                  setCvUnreadable([]);
                }}
                className="text-xs text-emerald-800 underline font-semibold"
              >
                Start over
              </button>
            </div>

            {cvUnreadable.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold">{cvUnreadable.length} file{cvUnreadable.length === 1 ? '' : 's'} could not be read:</p>
                <ul className="list-disc pl-4">
                  {cvUnreadable.map((u) => <li key={u.filename}><strong>{u.filename}</strong> — {u.error}</li>)}
                </ul>
              </div>
            )}

            {sheet && (
              <div className="p-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 space-y-2">
                <p className="text-xs font-bold text-slate-900">
                  Which column is which?{' '}
                  <span className="font-normal text-slate-600">
                    {sheet.read.headerRow === null ? 'Your file has no heading row, so we looked at what is in each column.' : 'Check these match your file.'}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CHOOSABLE_FIELDS.map(({ field, label }) => (
                    <label key={field} className="text-[11px] font-semibold text-slate-600">
                      {label}
                      <select
                        value={columns[field] ?? ''}
                        onChange={(e) => chooseColumn(field, e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-900"
                      >
                        <option value="">Not in my file</option>
                        {sheet.read.columns.map((c) => (
                          <option key={c.index} value={c.index}>
                            {sheet.read.headerRow === null ? c.header : c.header.slice(0, 30)}{c.sample[0] ? ` (e.g. ${c.sample[0].slice(0, 22)})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500">Check each row. You can fix a name, phone, subject or email directly in the table.</p>
            <div className="rounded-2xl border border-slate-200 overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-2" aria-label="Remove" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {parsedRows.map((row, idx) => {
                    const cell = 'w-full bg-transparent px-1.5 py-1 rounded border border-transparent hover:border-slate-300 focus:border-indigo-400 focus:bg-white focus:outline-none';
                    const problem = rowProblem(row);
                    const incomplete = problem !== null;
                    return (
                      <React.Fragment key={idx}>
                        <tr className={incomplete ? 'bg-rose-50/60' : 'hover:bg-slate-50/70'}>
                          <td className="py-1.5 px-2"><input aria-label="Name" value={row.name} onChange={(e) => updateRow(idx, { name: e.target.value })} className={`${cell} font-bold text-slate-900`} placeholder="Name" /></td>
                          <td className="py-1.5 px-2"><input aria-label="Phone" value={row.phone} onChange={(e) => updateRow(idx, { phone: e.target.value })} className={`${cell} font-mono text-[11px]`} placeholder="Phone" /></td>
                          <td className="py-1.5 px-2"><input aria-label="Subject" value={row.subject} onChange={(e) => updateRow(idx, { subject: e.target.value })} className={`${cell} text-indigo-700 font-semibold`} /></td>
                          <td className="py-1.5 px-2"><input aria-label="Email" value={row.email} onChange={(e) => updateRow(idx, { email: e.target.value })} className={`${cell} text-[11px]`} placeholder="Email" /></td>
                          <td className="py-1.5 px-2 text-right">
                            <button type="button" onClick={() => removeRow(idx)} title="Remove this row" className="text-slate-400 hover:text-rose-600 p-1"><X className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                        {(row.warnings?.length || incomplete) ? (
                          <tr className={incomplete ? 'bg-rose-50/60' : ''}>
                            <td colSpan={5} className="px-3 pb-2 text-[11px] text-amber-800">
                              {row.source && <span className="font-mono text-slate-400 mr-2">{row.source}</span>}
                              {problem && <span className="text-rose-700 font-semibold mr-2">{problem}</span>}
                              {row.warnings?.join(' · ')}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {incompleteCount > 0 && (
              <p className="text-xs text-rose-700 font-semibold">
                {incompleteCount} row{incompleteCount === 1 ? ' needs' : 's need'} a fix: a name, and a real phone number or an email. Fix or remove {incompleteCount === 1 ? 'it' : 'them'} to import.
              </p>
            )}

            <InterviewModePicker value={interviewMode} onChange={setInterviewMode} legend={`How should these ${parsedRows.length} candidates be assessed?`} note="Everyone in this import gets the same. You can invite any one of them to the AI interview later from their page." />

            <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={contactAttested}
                onChange={(e) => setContactAttested(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm the school has permission to contact these {parsedRows.length} candidates by WhatsApp and email about this application.
              </span>
            </label>
            <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-indigo-200 bg-indigo-50 text-xs text-indigo-900 cursor-pointer">
              <input
                type="checkbox"
                checked={sendInvites}
                onChange={(e) => setSendInvites(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <strong>Send each teacher their test invite on WhatsApp right after the import.</strong>{' '}
                Teachers with a phone number get a message with their application ID and a button that opens their test.
              </span>
            </label>
            {importError && <p className="text-xs text-rose-600 font-semibold">{importError}</p>}

            {inviteResult ? (
              <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 space-y-2">
                <p className="font-extrabold text-sm">{inviteResult.imported} teacher profiles created</p>
                {inviteResult.error ? (
                  <p className="text-rose-700 font-semibold">{inviteResult.error}</p>
                ) : inviteResult.summary && (
                  <ul className="space-y-1">
                    <li>✅ <strong>{inviteResult.summary.sent}</strong> invites sent on WhatsApp</li>
                    {inviteResult.summary.no_phone > 0 && <li>• {inviteResult.summary.no_phone} have no phone number</li>}
                    {inviteResult.summary.no_consent > 0 && <li>• {inviteResult.summary.no_consent} have not agreed to WhatsApp messages</li>}
                    {inviteResult.summary.waiting_for_daily_limit > 0 && (
                      <li>⏳ {inviteResult.summary.waiting_for_daily_limit} are waiting: WhatsApp&apos;s daily limit for new numbers was reached. Send them again tomorrow.</li>
                    )}
                    {inviteResult.summary.failed > 0 && (
                      <li className="text-rose-700">⚠️ {inviteResult.summary.failed} failed{inviteResult.firstFailure ? ` (${inviteResult.firstFailure})` : ''}</li>
                    )}
                  </ul>
                )}
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setInviteResult(null); onSuccess(); onClose(); }}
                    className="brand-primary-btn px-5 py-2 rounded-xl text-xs font-bold text-white"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || !contactAttested || incompleteCount > 0}
                className="brand-primary-btn px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing leads…
                  </>
                ) : importSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    Import complete
                  </>
                ) : (
                  <>
                    Confirm import ({parsedRows.length})
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
