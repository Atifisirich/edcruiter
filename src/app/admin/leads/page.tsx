'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneCall, Upload } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { EmptyState, PageHeader, buttonClass } from '@/components/admin/ui';
import LeadUploadDialog from '@/components/admin/leads/LeadUploadDialog';
import LeadOverview, { type LeadListRow } from '@/components/admin/leads/LeadOverview';

/** Lead screening: bulk uploads the AI calls and filters, kept apart from Candidates. */
export default function LeadListsPage() {
  const { schoolId } = useAdmin();
  const router = useRouter();
  const [lists, setLists] = useState<LeadListRow[] | null>(null);
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
        <LeadOverview lists={lists} />
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
