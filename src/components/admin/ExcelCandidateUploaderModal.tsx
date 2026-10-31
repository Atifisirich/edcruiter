'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet, Upload, CheckCircle2, X,
  Download, ArrowRight, Loader2, Check, AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import { flagDuplicateLeads, type CvLead } from '@/lib/cvLead';

interface ParsedCandidate {
  name: string;
  email: string;
  phone: string;
  subject: string;
  segment: string;
  qualification: string;
  experience: string;
  prior_org: string;
  /** Set on rows read from a CV: the file name and what to check. */
  source?: string;
  warnings?: string[];
}

interface ExcelCandidateUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV_DATA = `Name,Email,Phone,Subject,Segment,Qualification,Experience,PreviousSchool
Dr. Priya Nair,priya.science@gmail.com,+91 98765 11223,Physics,Senior Secondary (Grades 11-12),M.Sc (Physics) + B.Ed,4.5 Years,Delhi Public School
Sanjay Mukherjee,sanjay.math@gmail.com,+91 98765 22334,Mathematics,Secondary (Grades 9-10),M.Sc (Math) + B.Ed,3.0 Years,Oakridge International
Kavita Deshmukh,kavita.bio@gmail.com,+91 98765 33445,Biology,Secondary (Grades 9-10),M.Sc (Botany) + B.Ed,5.0 Years,Chirec International`;

type SheetField = Exclude<keyof ParsedCandidate, 'source' | 'warnings'>;

const HEADER_ALIASES: Record<SheetField, string[]> = {
  name: ['name', 'full name', 'candidate', 'teacher', 'teacher name', 'applicant'],
  email: ['email', 'e-mail', 'mail', 'email id', 'email address'],
  phone: ['phone', 'mobile', 'whatsapp', 'contact', 'phone number', 'mobile number', 'number', 'cell'],
  subject: ['subject', 'applied subject', 'subject applied', 'discipline', 'department'],
  segment: ['segment', 'grade', 'grades', 'level', 'band', 'class'],
  qualification: ['qualification', 'degree', 'degrees', 'degrees & b.ed', 'education', 'b.ed'],
  experience: ['experience', 'exp', 'years', 'experience band', 'yrs'],
  prior_org: ['previousschool', 'previous school', 'prior school', 'last school', 'organization', 'org', 'school']
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cols.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols.map((c) => c.replace(/^["']|["']$/g, '').trim());
}

function mapHeaderIndex(headers: string[]): Partial<Record<SheetField, number>> {
  const map: Partial<Record<SheetField, number>> = {};
  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    (Object.keys(HEADER_ALIASES) as (SheetField)[]).forEach((field) => {
      if (map[field] !== undefined) return;
      if (HEADER_ALIASES[field].some((alias) => h === alias || h.includes(alias))) {
        map[field] = idx;
      }
    });
  });
  return map;
}

function rowToCandidate(
  cols: string[],
  map: Partial<Record<SheetField, number>>,
  rowIndex: number,
  positional: boolean
): ParsedCandidate | null {
  const get = (field: SheetField, positionalIdx: number, fallback: string) => {
    if (!positional && map[field] !== undefined) {
      return (cols[map[field]!] || '').trim() || fallback;
    }
    return (cols[positionalIdx] || '').trim() || fallback;
  };

  const name = get('name', 0, '');
  if (!name || normalizeHeader(name) === 'name' || name.toLowerCase() === 'full name') return null;

  const phone = get('phone', 2, '');
  const emailRaw = get('email', 1, '');
  const subject = get('subject', 3, 'General');
  const looksLikeEmail = emailRaw.includes('@');
  // Spreadsheets with Name, Subject, Phone (no email column)
  const phoneFromEmailSlot = !looksLikeEmail && /^[\d+\s()-]{8,}$/.test(emailRaw) ? emailRaw : '';
  const subjectFromEmailSlot = !looksLikeEmail && !phoneFromEmailSlot && emailRaw && !phone ? emailRaw : '';

  // A missing phone or email stays blank. The old placeholders ("+91 00000
  // 00000", "lead.<digits>@school.local") looked real, so an invite was sent
  // to a number that does not exist.
  const resolvedPhone = phone || phoneFromEmailSlot || '';
  const resolvedSubject = subject !== 'General' ? subject : (subjectFromEmailSlot || 'General');
  const email = looksLikeEmail ? emailRaw : '';

  return {
    name,
    email,
    phone: resolvedPhone,
    subject: resolvedSubject,
    segment: get('segment', 4, 'Secondary (Grades 9-10)'),
    qualification: get('qualification', 5, ''),
    experience: get('experience', 6, ''),
    prior_org: get('prior_org', 7, '')
  };
}

function parseMatrix(rows: string[][]): ParsedCandidate[] {
  if (!rows.length) return [];
  const nonEmpty = rows
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((c) => c));
  if (!nonEmpty.length) return [];

  const headerMap = mapHeaderIndex(nonEmpty[0]);
  const hasNamedHeaders = headerMap.name !== undefined;
  const dataRows = hasNamedHeaders ? nonEmpty.slice(1) : nonEmpty;
  const positional = !hasNamedHeaders;

  const out: ParsedCandidate[] = [];
  dataRows.forEach((cols, i) => {
    const cand = rowToCandidate(cols, headerMap, i + 1, positional);
    if (cand) out.push(cand);
  });
  return out.slice(0, 200);
}

function parseCsvText(text: string): ParsedCandidate[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  return parseMatrix(lines.map(splitCsvLine));
}

function parseWorkbook(buffer: ArrayBuffer): ParsedCandidate[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: ''
  }) as string[][];
  return parseMatrix(rows);
}

export default function ExcelCandidateUploaderModal({
  isOpen,
  onClose,
  onSuccess
}: ExcelCandidateUploaderModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCandidate[]>([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');
  const [contactAttested, setContactAttested] = useState(false);
  // Send each teacher their WhatsApp test invite straight after the import.
  const [sendInvites, setSendInvites] = useState(true);
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
  // A lead needs a name and some way to reach them.
  const rowIsComplete = (r: ParsedCandidate) => Boolean(r.name.trim() && (r.phone.trim() || r.email.trim()));
  const incompleteCount = parsedRows.filter((r) => !rowIsComplete(r)).length;

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError('');
    setParsedRows([]);
    const lower = file.name.toLowerCase();

    try {
      let parsed: ParsedCandidate[] = [];
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseCsvText(text);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        parsed = parseWorkbook(buffer);
      } else {
        // Try Excel first, then CSV text
        try {
          parsed = parseWorkbook(await file.arrayBuffer());
        } catch {
          parsed = parseCsvText(await file.text());
        }
      }

      if (parsed.length === 0) {
        setParseError(
          'No valid leads found. Use columns like Name, Phone, Subject (Email optional). Download the template or try CSV.'
        );
        return;
      }
      setParsedRows(parsed);
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
    setParsedRows(parseCsvText(SAMPLE_CSV_DATA));
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
                    const incomplete = !rowIsComplete(row);
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
                              {incomplete && <span className="text-rose-700 font-semibold mr-2">Needs a name and a phone or email.</span>}
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
                {incompleteCount} row{incompleteCount === 1 ? '' : 's'} need a name and a phone or email. Fix or remove {incompleteCount === 1 ? 'it' : 'them'} to import.
              </p>
            )}

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
