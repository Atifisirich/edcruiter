'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Headphones, Loader2, Mic, MicOff, PhoneOff, ShieldCheck, Volume2 } from 'lucide-react';

type Phase = 'loading' | 'ready' | 'connecting' | 'live' | 'finishing' | 'done' | 'error';
type Line = { role: 'agent' | 'user'; text: string };

const LANGUAGES = ['English', 'Hindi', 'Telugu'] as const;
const SPEAKS: Record<string, string> = { English: 'English', Hindi: 'हिन्दी', Telugu: 'తెలుగు' };

interface AgentLike {
  start(): Promise<void>;
  waitForConnect(timeout?: number): Promise<boolean>;
  stop(): Promise<void>;
  mute(): void;
  unmute(): void;
  getInteractionId?: () => string | undefined;
}

/**
 * The spoken AI interview, in the browser. The candidate talks to a Sarvam voice
 * agent through their microphone. The session address comes from our own server
 * (the API key never reaches this page). When it ends, the server reads the
 * conversation back from Sarvam and writes the school's report.
 */
export default function VoiceInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<'staff' | 'candidate'>('candidate');
  const [name, setName] = useState('');
  const [configured, setConfigured] = useState(true);
  const [status, setStatus] = useState('');
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>('English');
  const [agreed, setAgreed] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [agentState, setAgentState] = useState('');
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);

  const agentRef = useRef<AgentLike | null>(null);
  const linesRef = useRef<Line[]>([]);
  const interviewRef = useRef('');
  const startedAt = useRef(0);
  const finishing = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/voice-interview?candidate_id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not open this page. Sign in with your application link first.'); setPhase('error'); return; }
      setViewer(data.viewer === 'staff' ? 'staff' : 'candidate');
      setName(data.name || '');
      setConfigured(data.configured !== false);
      setStatus(data.interview?.status || '');
      if (data.interview?.language && LANGUAGES.includes(data.interview.language)) setLanguage(data.interview.language);
      setPhase(data.interview?.status === 'completed' && data.viewer !== 'staff' ? 'done' : 'ready');
    } catch {
      setError('Could not reach the server. Check your connection and refresh.');
      setPhase('error');
    }
  }, [id]);

  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => () => { agentRef.current?.stop().catch(() => undefined); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [lines]);
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setPhase('finishing');
    const spoken = Math.round((Date.now() - startedAt.current) / 1000);
    try { await agentRef.current?.stop(); } catch { /* already closed */ }
    agentRef.current = null;
    try {
      const res = await fetch('/api/voice-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'finish', candidate_id: id, interview_id: interviewRef.current, transcript: linesRef.current.map((l) => ({ role: l.role, content: l.text })), duration_sec: spoken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the interview.');
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the interview.');
      setPhase('error');
    }
  }, [id]);

  const begin = async () => {
    setError('');
    setPhase('connecting');
    finishing.current = false;
    linesRef.current = [];
    setLines([]);
    try {
      // Ask for the microphone first, from the button press, so the browser allows sound.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
      if (!probe) throw new Error('We need your microphone. Allow it in the browser address bar, then press Start again.');
      probe.getTracks().forEach((t) => t.stop());

      const res = await fetch('/api/voice-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', candidate_id: id, language }),
      });
      const start = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(start.error || 'Could not start the interview.');
      interviewRef.current = start.interview_id;

      const sdk = await import('sarvam-conv-ai-sdk/browser');
      const audio = new sdk.BrowserAudioInterface(16000, {
        outputLevelCallback: (l: { rms: number }) => setLevel(Math.min(1, l.rms * 6)),
      });
      const agent = new sdk.ConversationAgent({
        // The real key stays on our server; the session address is fetched through it.
        apiKey: 'via-edcruiter-server',
        baseUrl: `${window.location.origin}/api/voice-interview/runtime/`,
        config: {
          org_id: start.runtime.org_id,
          workspace_id: start.runtime.workspace_id,
          app_id: start.runtime.app_id,
          ...(start.runtime.version ? { version: start.runtime.version } : {}),
          user_identifier: start.interview_id,
          user_identifier_type: 'custom',
          interaction_type: sdk.InteractionType.CALL,
          input_sample_rate: 16000,
          output_sample_rate: 16000,
          agent_variables: start.variables,
          initial_language_name: language as never,
        },
        audioInterface: audio,
        stateCallback: (s: unknown) => setAgentState(String(s)),
        transcriptCallback: async (m: { role: unknown; content: string }) => {
          const text = String(m.content || '').trim();
          if (!text) return;
          const role: Line['role'] = String(m.role).toLowerCase().includes('user') ? 'user' : 'agent';
          linesRef.current = [...linesRef.current, { role, text }];
          setLines(linesRef.current);
        },
        endCallback: async () => { if (!finishing.current) void finish(); },
      }) as unknown as AgentLike;
      agentRef.current = agent;
      startedAt.current = Date.now();
      await agent.start();
      const ok = await agent.waitForConnect(15);
      if (!ok) throw new Error('Could not connect to the interviewer. Check your internet and try again.');
      setSeconds(0);
      setPhase('live');
    } catch (e) {
      try { await agentRef.current?.stop(); } catch { /* nothing to close */ }
      agentRef.current = null;
      setError(e instanceof Error ? e.message : 'Could not start the interview.');
      setPhase('error');
    }
  };

  const toggleMute = () => {
    const a = agentRef.current;
    if (!a) return;
    if (muted) { a.unmute(); setMuted(false); } else { a.mute(); setMuted(true); }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const stateLabel = /speak/i.test(agentState) ? 'The interviewer is speaking' : /listen/i.test(agentState) ? 'Your turn. Speak naturally' : 'Connecting…';

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-900 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="space-y-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">AI interview{viewer === 'staff' ? ' · demo run by your team' : ''}</p>
          <h1 className="text-2xl font-black">{name ? `Hello ${name.split(' ')[0]}` : 'Your AI interview'}</h1>
        </header>

        {phase === 'loading' && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}

        {phase === 'error' && (
          <div role="alert" className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-900 space-y-3">
            <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>
            <button type="button" onClick={() => { setError(''); void load(); }} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-xs font-bold cursor-pointer">Try again</button>
          </div>
        )}

        {phase === 'ready' && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
            {!configured && (
              <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">The voice interview is not switched on for this site yet.</p>
            )}
            <p className="text-sm text-slate-700 leading-relaxed">
              This is a <strong>spoken interview of about 12 minutes</strong> with an AI interviewer. It asks six questions about your teaching, one at a time, and may ask a short follow-up. There are no trick questions.
            </p>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2.5"><Headphones className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> Sit in a quiet room. Headphones work best.</li>
              <li className="flex gap-2.5"><Mic className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> Allow your microphone when the browser asks. Speak like you would to a colleague.</li>
              <li className="flex gap-2.5"><Volume2 className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> You can ask it to repeat or simplify a question.</li>
              <li className="flex gap-2.5"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> The conversation is recorded as text. The school sees the transcript and a written report.</li>
            </ul>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700">Language to start in</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Interview language">
                {LANGUAGES.map((l) => (
                  <button key={l} type="button" onClick={() => setLanguage(l)} className={`px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer ${language === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'}`}>{SPEAKS[l]}</button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">You can switch language during the interview; the interviewer follows you.</p>
            </div>

            <label className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer text-sm ${agreed ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-indigo-300'}`}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-indigo-600" />
              <span><strong>Tick this box</strong> to say you understand this is an AI interview and you agree to it being recorded as text for the school.</span>
            </label>

            {viewer === 'staff' && status === 'completed' && (
              <p className="text-xs text-slate-600">An earlier run exists for this person. Starting again replaces it. <Link className="font-bold text-indigo-700 underline" href={`/admin/candidates/${id}`}>See the report</Link></p>
            )}

            <button type="button" onClick={begin} disabled={!agreed || !configured} className="brand-primary-btn w-full sm:w-auto justify-center px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Mic className="w-4 h-4" /> Start the interview
            </button>
          </section>
        )}

        {phase === 'connecting' && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Connecting to your interviewer… allow the microphone if asked.</p>}

        {phase === 'live' && (
          <section className="space-y-4">
            <div className="bg-indigo-600 text-white rounded-3xl p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-indigo-200">{mm}:{ss}</p>
                <p className="text-lg font-black">{stateLabel}</p>
              </div>
              <div className="flex items-end gap-1 h-10" aria-hidden="true">
                {[0.3, 0.6, 1, 0.6, 0.3].map((w, i) => (
                  <span key={i} className="w-1.5 rounded-full bg-white/80 transition-all" style={{ height: `${8 + Math.round(level * w * 32)}px` }} />
                ))}
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 max-h-[46vh] overflow-y-auto space-y-3" aria-live="polite">
              {lines.length === 0 && <p className="text-sm text-slate-500">The conversation appears here as you talk.</p>}
              {lines.map((l, i) => (
                <p key={i} className={`text-sm leading-relaxed ${l.role === 'agent' ? 'text-slate-900' : 'text-indigo-800'}`}>
                  <strong>{l.role === 'agent' ? 'Interviewer' : 'You'}:</strong> {l.text}
                </p>
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={toggleMute} className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold flex items-center gap-2 cursor-pointer">
                {muted ? <><MicOff className="w-4 h-4" /> Unmute</> : <><Mic className="w-4 h-4" /> Mute</>}
              </button>
              <button type="button" onClick={() => void finish()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
                <PhoneOff className="w-4 h-4" /> End the interview
              </button>
            </div>
          </section>
        )}

        {phase === 'finishing' && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Saving your interview. This takes a few seconds…</p>}

        {phase === 'done' && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-3 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-black">Thank you, your interview is done</h2>
            <p className="text-sm text-slate-600">The school team will read it and be in touch about the next step.</p>
            {viewer === 'staff' && <Link href={`/admin/candidates/${id}`} className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold">See the report</Link>}
          </section>
        )}
      </div>
    </main>
  );
}
