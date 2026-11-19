import React from 'react';
import { Download, Eye, FileText } from 'lucide-react';

/**
 * The CV a candidate uploaded, for the school team: open it in a new tab to
 * read, or save a copy. Both go through the protected media route, which only
 * serves it to staff of the candidate's own school.
 */
export default function CvActions({ resumeUrl, candidateName }: { resumeUrl?: string; candidateName?: string }) {
  if (!resumeUrl) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <FileText className="w-4 h-4 text-slate-400" /> No CV uploaded yet.
      </div>
    );
  }
  const separator = resumeUrl.includes('?') ? '&' : '?';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={resumeUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
      >
        <Eye className="w-3.5 h-3.5" /> View CV
      </a>
      <a
        href={`${resumeUrl}${separator}download=1`}
        download
        aria-label={candidateName ? `Download ${candidateName}'s CV` : 'Download CV'}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> Download
      </a>
    </div>
  );
}
