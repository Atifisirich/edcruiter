'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';

interface PDFResumeUploaderProps {
  schoolId: string;
  candidateId: string;
  defaultResumeUrl?: string;
  claimedName?: string;
  claimedQualification?: string;
  claimedExperience?: string;
  claimedSubject?: string;
  claimedPriorOrg?: string;
  onUploadComplete: (url: string, report?: any) => void;
}

export default function PDFResumeUploader({
  schoolId,
  candidateId,
  defaultResumeUrl,
  claimedName,
  claimedQualification,
  claimedExperience,
  claimedSubject,
  claimedPriorOrg,
  onUploadComplete
}: PDFResumeUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(defaultResumeUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // What the AI actually read off the CV, so the candidate can see it was taken in.
  const [readSummary, setReadSummary] = useState<{
    name?: string; degrees?: string[]; years?: number; mismatches?: string[]; notRead?: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('That file is not a PDF. Please choose your CV as a PDF file.');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage('That file is larger than 15 MB. Please choose a smaller PDF.');
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('school_id', schoolId);
      formData.append('candidate_id', candidateId);
      if (claimedName) formData.append('claimed_name', claimedName);
      if (claimedQualification) formData.append('claimed_qualification', claimedQualification);
      if (claimedExperience) formData.append('claimed_experience', claimedExperience);
      if (claimedSubject) formData.append('claimed_subject', claimedSubject);
      if (claimedPriorOrg) formData.append('claimed_prior_org', claimedPriorOrg);

      const res = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload and analyze resume PDF');
      }

      setUploadedUrl(data.url);
      const r = data.report;
      setReadSummary(
        data.read && r
          ? {
              name: r.name_on_cv || undefined,
              degrees: r.qualifications_match?.degrees_found,
              years: typeof r.total_experience_years === 'number' ? r.total_experience_years : undefined,
              mismatches: r.form_vs_cv_discrepancies
            }
          : { notRead: true }
      );
      onUploadComplete(data.url, data.report);
    } catch (err: any) {
      console.error('PDF upload error:', err);
      setErrorMessage(err.message || 'Error uploading PDF resume. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label className="text-slate-700 font-bold text-sm flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span>Your CV <span className="text-indigo-600">*</span></span>
        </label>
        <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-600" /> AI reads it and checks it against your details
        </span>
      </div>

      {errorMessage && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-semibold flex items-start gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!uploadedUrl && !isUploading ? (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 hover:border-indigo-300 bg-slate-50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-2 border border-indigo-100">
            <Upload className="w-6 h-6" />
          </div>

          <div className="text-sm font-bold text-slate-900 mb-0.5">
            Tap to choose your CV
            <span className="hidden sm:inline font-semibold text-slate-500"> or drag it here</span>
          </div>
          <p className="text-xs text-slate-500">
            PDF only, up to 15 MB. It should show your name, qualifications and experience.
          </p>
        </div>
      ) : isUploading ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <div className="text-sm font-bold text-slate-900">Reading your CV…</div>
          <p className="text-xs text-slate-500">This takes about 20 seconds. Please keep this page open.</p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-sm font-bold text-slate-900 block break-all">
                {file?.name || 'Candidate_Resume.pdf'}
              </strong>
              <span className="text-xs text-emerald-800 block">
                {readSummary?.notRead
                  ? 'CV saved. We could not read it automatically, so a reviewer will open it.'
                  : 'CV uploaded and read'}
              </span>
              {readSummary && !readSummary.notRead && (
                <ul className="mt-1.5 text-xs text-slate-600 space-y-0.5">
                  {readSummary.name && <li>Name on CV: <strong>{readSummary.name}</strong></li>}
                  {readSummary.degrees && readSummary.degrees.length > 0 && <li>Qualifications found: <strong>{readSummary.degrees.join(', ')}</strong></li>}
                  {readSummary.years !== undefined && <li>Experience found: <strong>{readSummary.years} year{readSummary.years === 1 ? '' : 's'}</strong></li>}
                  {readSummary.mismatches && readSummary.mismatches.length > 0 && (
                    <li className="text-amber-800 font-semibold">Please check your details against your CV: {readSummary.mismatches.join('; ')}</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setUploadedUrl(null);
              setFile(null);
              onUploadComplete('');
            }}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Replace
          </button>
        </div>
      )}
    </div>
  );
}
