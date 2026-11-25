'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Mic, MessagesSquare, Send, Sparkles } from 'lucide-react';
import AiInterviewReportView from '@/components/reviewer/report/AiInterviewReportView';
import { useAdmin } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import { isHiringTeam } from '@/lib/permissions';
import type { AiInterview, InterviewMode } from '@/lib/types';
import { MODE_LABEL } from '@/lib/interviewMode';

/**
 * The optional spoken AI interview, for one candidate: invite them, run it
 * yourself as a demo, or read the report and transcript. Sits inside the
 * candidate report's AI interview section and tells it when the interview changes.
 */
export default function AiInterviewPanel({
  candidateId,
  candidateName,
  onChange,
  mode = 'five_stage',
  onModeChange,
}: {
  candidateId: string;
  candidateName: string;
  onChange?: (interview: AiInterview | null) => void;
  /** What this candidate goes through. HR can switch one candidate to the AI interview only. */
  mode?: InterviewMode;
  onModeChange?: () => void | Promise<void>;
}) {
  const { user, toast } = useAdmin();
  const canRun = isHiringTeam(user?.role);
  const [interview, setInterview] = useState<AiInterview | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/voice-interview?candidate_id=${encodeURIComponent(candidateId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setInterview(data.interview ?? null); onChange?.(data.interview ?? null); setConfigured(data.configured !== false); }
    } finally {
      setLoaded(true);
    }
  }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  const act = async (action: 'invite' | 'sample', doing: string) => {
    setBusy(doing);
    try {
      const res = await fetch('/api/voice-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, candidate_id: candidateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast(data.error || 'That did not work. Try again.', 'error'); return; }
      setInterview(data.interview);
      onChange?.(data.interview ?? null);
      const via = [data.notified?.whatsapp && 'WhatsApp', data.notified?.email && 'email'].filter(Boolean).join(' and ');
      toast(action === 'invite'
        ? `${candidateName} is invited${via ? ` and was told on ${via}` : '. We could not message them, so ask them to open their application'}. The interview shows on their application page.`
        : 'Sample report ready.', 'success');
    } finally {
      setBusy('');
    }
  };

  const first = candidateName.split(' ')[0];
  const setPath = async (interview_mode: InterviewMode | 'vacancy') => {
    const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}/interview-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interview_mode }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: 'Could not reach the server.' };
    if (!res?.ok) { toast(data.error || 'That did not work. Try again.', 'error'); return false; }
    await onModeChange?.();
    return true;
  };
  // Only the spoken interview for this one candidate: no written test or videos. What they already did is kept.
  const giveOnlyInterview = async () => {
    if (!window.confirm(`Give ${first} only the AI conversational interview?

They skip the written test and the videos, and are invited to the spoken interview now. Anything they already finished is kept. You can change this back.`)) return;
    setBusy('only');
    try {
      if (!(await setPath('ai'))) return;
      const wasInvited = interview?.status === 'invited';
      if (wasInvited) { toast(`${first} now has only the AI interview. Their invitation is still open.`, 'success'); return; }
      await act('invite', 'only');
    } finally {
      setBusy('');
    }
  };
  const changeBack = async () => {
    setBusy('back');
    try {
      if (await setPath('vacancy')) toast(`${first} is back on the steps their vacancy asks for.`, 'success');
    } finally {
      setBusy('');
    }
  };

  const link = typeof window !== 'undefined' ? `${window.location.origin}/interview/${candidateId}` : `/interview/${candidateId}`;
  const r = interview?.report;

  return (
    <div className="space-y-4" aria-label="AI interview">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-slate-500 max-w-md">An optional spoken interview with an AI interviewer. You get a scored report with quotes as evidence.</p>
        {canRun && (
          <div className="flex flex-wrap gap-2">
            {mode !== 'ai' && interview?.status !== 'in_progress' && (
              <button type="button" disabled={!!busy} onClick={() => void giveOnlyInterview()} className={buttonClass('primary', 'sm')} title="Skip the written test and videos for this candidate">
                {busy === 'only' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessagesSquare className="w-4 h-4" />} Give only the AI interview
              </button>
            )}
            {(!interview || interview.status === 'completed' || interview.status === 'abandoned') && (
              <button type="button" disabled={!!busy} onClick={() => act('invite', 'invite')} className={buttonClass(mode === 'ai' ? 'primary' : 'secondary', 'sm')} title={mode === 'ai' ? undefined : 'Adds the interview; their test stays as it is'}>
                {busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {interview ? `Invite ${first} again` : mode === 'ai' ? `Invite ${first}` : 'Add the AI interview to their test'}
              </button>
            )}
            <a href={link} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}><Mic className="w-4 h-4" /> Try it yourself <ExternalLink className="w-3 h-3" /></a>
            <button type="button" disabled={!!busy} onClick={() => act('sample', 'sample')} className={buttonClass('secondary', 'sm')}>
              {busy === 'sample' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Show a sample report
            </button>
          </div>
        )}
      </div>

      {canRun && (
        <p className="text-xs text-slate-600 print:hidden">
          Goes through: <strong>{MODE_LABEL[mode]}</strong>
          {mode === 'ai' && (
            <> · <button type="button" disabled={!!busy} onClick={() => void changeBack()} className="font-semibold text-indigo-700 hover:underline cursor-pointer disabled:opacity-50">Change back</button></>
          )}
        </p>
      )}

      {!configured && (
        <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> The live voice interview is not switched on for this site yet. You can still show a sample report.</p>
      )}

      {loaded && !interview && <p className="text-sm text-slate-500">Not invited yet.</p>}
      {interview?.status === 'invited' && <p className="text-sm text-slate-700">Invited. Waiting for {candidateName.split(' ')[0]} to take the interview. Their application page now shows it.</p>}
      {interview?.status === 'in_progress' && <p className="text-sm text-slate-700">The interview has started and is not finished yet.</p>}
      {interview?.status === 'abandoned' && <p className="text-sm text-slate-700">The interview ended before anything was said. You can invite again.</p>}
      {interview?.status === 'completed' && !r && <p className="text-sm text-slate-700">The interview is finished. The report is being written.</p>}

      {interview && interview.status === 'completed' && r && <AiInterviewReportView interview={interview} candidateName={candidateName} />}
    </div>
  );
}
