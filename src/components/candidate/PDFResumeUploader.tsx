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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
      setErrorMessage('Please upload a valid PDF document (.pdf)');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage('PDF file size exceeds 15MB limit.');
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
      <div className="flex items-center justify-between">
        <label className="text-slate-700 font-bold text-xs flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-indigo-600" />
          <span>Upload Candidate CV / Resume (PDF Format)</span>
        </label>
        <span className="text-[10px] font-mono text-indigo-600 font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Auto-audited by Edcruiter AI
        </span>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
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

          <div className="text-xs font-bold text-slate-900 mb-0.5">
            Click to upload or drag and drop your Resume PDF
          </div>
          <p className="text-[11px] text-slate-400">
            Supports PDF documents up to 15MB • Edcruiter AI extracts career gaps and teaching accreditations automatically
          </p>
        </div>
      ) : isUploading ? (
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
          <div className="text-xs font-bold text-slate-900">Ingesting & auditing PDF with Edcruiter AI...</div>
          <p className="text-[11px] text-slate-400">Detecting career gaps, upward seniority trajectory, and B.Ed/CTET credentials</p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <strong className="text-xs font-bold text-slate-900 block">
                {file?.name || 'Candidate_Resume.pdf'}
              </strong>
              <span className="text-[11px] text-emerald-300 block">
                PDF uploaded & Edcruiter AI analysis attached to scorecard ✓
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setUploadedUrl(null);
              setFile(null);
              onUploadComplete('');
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Replace PDF"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
