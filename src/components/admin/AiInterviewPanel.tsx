'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Mic, Send, Sparkles } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { buttonClass } from '@/components/admin/ui';
import { isHiringTeam } from '@/lib/permissions';
import type { AiInterview } from '@/lib/types';

const REC: Record<string, { label: string; cls: string }> = {
  strong: { label: 'Strong interview', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  good: { label: 'Good interview', cls: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  mixed: { label: 'Mixed interview', cls: 'bg-amber-50 text-amber-900 border-amber-200' },
  weak: { label: 'Weak interview', cls: 'bg-rose-50 text-rose-800 border-rose-200' },
};

function bar(score: number) {
  return score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-indigo-500' : score >= 4 ? 'bg-amber-500' : 'bg-rose-500';
}

/**
 * The optional spoken AI interview, for one candidate: invite them, run it
 * yourself as a demo, or read the report and transcript.
 */
export default function AiInterviewPanel({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  const { user, toast } = useAdmin();
  const canRun = isHiringTeam(user?.role);
  const [interview, setInterview] = useState<AiInterview | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/voice-interview?candidate_id=${encodeURIComponent(candidateId)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setInterview(data.interview ?? null); setConfigured(data.configured !== false); }
    } finally {
      setLoaded(true);
    }
  }, [candidateId]);

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
      toast(action === 'invite' ? `${candidateName} is invited. They will see the interview when they open their application.` : 'Sample report ready.', 'success');
    } finally {
      setBusy('');
    }
  };

  const link = typeof window !== 'undefined' ? `${window.location.origin}/interview/${candidateId}` : `/interview/${candidateId}`;
  const r = interview?.report;
  const rec = r ? REC[r.recommendation] : null;

  return (
    <section id="ai-interview" className="mt-8 scroll-mt-6 bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4" aria-label="AI interview">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2"><Mic className="w-4 h-4 text-indigo-600" /> AI interview</h2>
          <p className="text-xs text-slate-500">An optional spoken interview with an AI interviewer. You get a scored report with quotes as evidence.</p>
        </div>
        {canRun && (
          <div className="flex flex-wrap gap-2">
            {(!interview || interview.status === 'completed' || interview.status === 'abandoned') && (
              <button type="button" disabled={!!busy} onClick={() => act('invite', 'invite')} className={buttonClass('primary', 'sm')}>
                {busy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Invite {candidateName.split(' ')[0]}
              </button>
            )}
            <a href={link} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}><Mic className="w-4 h-4" /> Try it yourself <ExternalLink className="w-3 h-3" /></a>
            <button type="button" disabled={!!busy} onClick={() => act('sample', 'sample')} className={buttonClass('secondary', 'sm')}>
              {busy === 'sample' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Show a sample report
            </button>
          </div>
        )}
      </div>

      {!configured && (
        <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> The live voice interview is not switched on for this site yet. You can still show a sample report.</p>
      )}

      {loaded && !interview && <p className="text-sm text-slate-500">Not invited yet.</p>}

      {interview?.status === 'invited' && <p className="text-sm text-slate-700">Invited. Waiting for {candidateName.split(' ')[0]} to take the interview. Their application page now shows it.</p>}
      {interview?.status === 'in_progress' && <p className="text-sm text-slate-700">The interview has started and is not finished yet.</p>}
      {interview?.status === 'abandoned' && <p className="text-sm text-slate-700">The interview ended before anything was said. You can invite again.</p>}

      {interview && interview.status === 'completed' && r && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
            {interview.mode === 'sample' && <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white">SAMPLE. Made-up conversation, not a real candidate</span>}
            {interview.by_staff && interview.mode !== 'sample' && <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Demo run by your team</span>}
            {rec && r.scored && <span className={`px-2.5 py-1 rounded-full border ${rec.cls}`}>{rec.label}{r.overall ? ` · ${r.overall}/100` : ''}</span>}
            {interview.duration_sec ? <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">{Math.max(1, Math.round(interview.duration_sec / 60))} min</span> : null}
            {interview.transcript_source === 'browser' && <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200">Transcript from the candidate&apos;s browser, not checked</span>}
          </div>

          <p className="text-sm text-slate-800 leading-relaxed">{r.summary}</p>

          {r.flags.length > 0 && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Needs your attention</p>
              <ul className="list-disc pl-5">{r.flags.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}

          {r.scored && (
            <div className="space-y-3">
              {r.topics.map((t) => (
                <div key={t.key} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <span className="text-xs font-black text-slate-700">{t.score ? `${t.score}/10` : 'Not covered'}</span>
                  </div>
                  {t.score > 0 && <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full ${bar(t.score)}`} style={{ width: `${t.score * 10}%` }} /></div>}
                  {t.note && <p className="text-xs text-slate-600">{t.note}</p>}
                  {t.evidence.map((q) => <blockquote key={q} className="text-xs text-slate-700 border-l-2 border-indigo-300 pl-3 italic">&ldquo;{q}&rdquo;</blockquote>)}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {r.strengths.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100"><p className="text-xs font-extrabold uppercase text-emerald-800 mb-1">Strengths</p><ul className="list-disc pl-5 space-y-0.5 text-slate-800">{r.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
            )}
            {r.concerns.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100"><p className="text-xs font-extrabold uppercase text-amber-900 mb-1">Concerns</p><ul className="list-disc pl-5 space-y-0.5 text-slate-800">{r.concerns.map((s) => <li key={s}>{s}</li>)}</ul></div>
            )}
          </div>

          {r.followups.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-sm"><p className="text-xs font-extrabold uppercase text-indigo-800 mb-1">Ask these in your own interview</p><ol className="list-decimal pl-5 space-y-0.5 text-slate-800">{r.followups.map((s) => <li key={s}>{s}</li>)}</ol></div>
          )}

          <div>
            <button type="button" onClick={() => setShowTranscript((v) => !v)} className="text-xs font-bold text-indigo-700 underline cursor-pointer">{showTranscript ? 'Hide' : 'Read'} the full transcript</button>
            {showTranscript && (
              <div className="mt-3 max-h-96 overflow-y-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                {interview.transcript.map((t, i) => (
                  <p key={i} className="text-sm"><strong className={t.role === 'agent' ? 'text-slate-900' : 'text-indigo-800'}>{t.role === 'agent' ? 'Interviewer' : candidateName.split(' ')[0]}:</strong> {t.text}</p>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-500">The AI reads only the transcript. It is a second opinion to help you decide, never the decision itself.</p>
        </div>
      )}
    </section>
  );
}
