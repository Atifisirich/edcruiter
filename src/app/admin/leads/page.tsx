'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, PhoneCall, Upload } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { EmptyState, PageHeader, buttonClass } from '@/components/admin/ui';
import LeadUploadDialog from '@/components/admin/leads/LeadUploadDialog';

type ListCard = {
  id: string; name: string; status: 'setup' | 'running' | 'paused' | 'done'; total: number; good_fit: number; needs_look: number;
  set_aside: number; waiting: number; progress: number; created_at: string; has_setup: boolean; good_fit_text?: string; note?: string;
};

const STATUS: Record<ListCard['status'], { label: string; cls: string }> = {
  setup: { label: 'Set up screening', cls: 'bg-amber-100 text-amber-900' },
  running: { label: 'Calling now', cls: 'bg-indigo-100 text-indigo-800' },
  paused: { label: 'Paused', cls: 'bg-slate-200 text-slate-700' },
  done: { label: 'Finished', cls: 'bg-emerald-100 text-emerald-800' },
};

/** Lead screening: bulk uploads the AI calls and filters, kept apart from Candidates. */
export default function LeadListsPage() {
  const { schoolId } = useAdmin();
  const router = useRouter();
  const [lists, setLists] = useState<ListCard[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/lead-lists?school_id=${encodeURIComponent(schoolId)}`);
    const d = await r.json().catch(() => ({}));
    setLists(r.ok ? d.lists : []);
  }, [schoolId]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead screening"
        description="Upload a list of leads, say who you are looking for, and the AI calls everyone. Good fits move into Candidates on their own; the rest are set aside with the reason."
        actions={<button type="button" onClick={() => setUploading(true)} className={buttonClass('primary')}><Upload className="w-4 h-4" /> Upload leads</button>}
      />

      {lists === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[0, 1].map((i) => <div key={i} className="h-40 rounded-3xl bg-slate-100 animate-pulse" />)}</div>
      ) : lists.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200">
          <EmptyState
            Icon={PhoneCall}
            title="No lead lists yet"
            description="Got 400 leads from a job portal or a walk-in drive? Upload them here. Your candidate list stays clean."
            action={<button type="button" onClick={() => setUploading(true)} className={buttonClass('primary')}><Upload className="w-4 h-4" /> Upload leads</button>}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lists.map((l) => (
            <li key={l.id}>
              <Link href={`/admin/leads/${l.id}`} className="block bg-white rounded-3xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-900 truncate">{l.name}</p>
                    <p className="text-xs text-slate-500 truncate">{l.good_fit_text || 'Screening not set up yet'}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS[l.status].cls}`}>{l.status === 'setup' && l.has_setup ? 'Ready to start' : STATUS[l.status].label}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { n: l.total, label: 'Leads', cls: 'text-slate-900' },
                    { n: l.good_fit, label: 'Good fit', cls: 'text-emerald-600' },
                    { n: l.needs_look, label: 'Need a look', cls: 'text-amber-600' },
                    { n: l.set_aside, label: 'Set aside', cls: 'text-slate-500' },
                  ].map((x) => (
                    <div key={x.label}>
                      <p className={`text-2xl font-black ${x.cls}`}>{x.n}</p>
                      <p className="text-[11px] text-slate-500">{x.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${l.progress}%` }} /></div>
                  <p className="text-[11px] text-slate-500 flex justify-between"><span>{l.note || `${l.progress}% screened`}</span><span className="inline-flex items-center gap-1 font-bold text-indigo-700">Open <ArrowRight className="w-3 h-3" /></span></p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {uploading && (
        <LeadUploadDialog
          schoolId={schoolId}
          onClose={() => setUploading(false)}
          onDone={(r) => {
            try { sessionStorage.setItem(`lead-upload-${r.listId}`, JSON.stringify({ added: r.added, skipped: r.skipped })); } catch { /* not needed */ }
            router.push(`/admin/leads/${r.listId}`);
          }}
        />
      )}
    </div>
  );
}
