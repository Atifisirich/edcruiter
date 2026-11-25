'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, BookOpen, CheckCircle2, Clock, Headphones, Loader2, MessageSquare, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles, Users,
} from 'lucide-react';

type Phase = 'loading' | 'lobby' | 'connecting' | 'live' | 'finishing' | 'done' | 'error';
type Line = { role: 'agent' | 'user'; text: string };

const LANGUAGES = ['English', 'Hindi', 'Telugu'] as const;
const SPEAKS: Record<string, string> = { English: 'English', Hindi: 'हिन्दी', Telugu: 'తెలుగు' };
const TOTAL_SECONDS = 18 * 60;

const AGENDA = [
  { icon: Users, name: 'Your career', hint: 'Schools, dates, results' },
  { icon: BookOpen, name: 'Your subject', hint: 'Concepts, explained simply' },
  { icon: Sparkles, name: 'A real lesson', hint: 'Planning and teaching' },
  { icon: BookOpen, name: 'Assessment', hint: 'How you check learning' },
  { icon: Users, name: 'Your classroom', hint: 'A real situation' },
  { icon: ShieldCheck, name: 'Child safety', hint: 'Exactly what you would do' },
  { icon: Headphones, name: 'Every learner', hint: 'Students who need more' },
  { icon: Users, name: 'Professional conduct', hint: 'Disagreement and growth' },
];

interface AgentLike {
  start(): Promise<void>;
  waitForConnect(timeout?: number): Promise<boolean>;
  stop(): Promise<void>;
  mute(): void;
  unmute(): void;
}

/** Level (0 to 1) of the microphone, for the meter. Uses its own short-lived stream, separate from the interview's. */
function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0);
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      if (stop) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      setGranted(true);
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 5));
        raf = requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => setGranted(false));
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => undefined);
    };
  }, [active]);
  return { level, granted };
}

/** A person tile in the room: a round avatar whose rings move with their voice. */
function Tile({ name, role, initial, level, speaking, accent, children }: { name: string; role: string; initial: string; level: number; speaking: boolean; accent: string; children?: React.ReactNode }) {
  const ring = 1 + Math.min(0.5, level * 0.6);
  return (
    <div className={`relative rounded-3xl p-5 flex flex-col items-center justify-center text-center gap-3 min-h-[220px] transition-colors ${speaking ? 'bg-white/10 ring-2 ring-white/40' : 'bg-white/5 ring-1 ring-white/10'}`}>
      <div className="relative w-24 h-24 flex items-center justify-center">
        <span className={`absolute inset-0 rounded-full ${accent} opacity-30 transition-transform duration-100`} style={{ transform: `scale(${speaking ? ring * 1.25 : 1})` }} />
        <span className={`absolute inset-2 rounded-full ${accent} opacity-40 transition-transform duration-100`} style={{ transform: `scale(${speaking ? ring : 1})` }} />
        <span className={`relative w-16 h-16 rounded-full ${accent} text-white text-2xl font-black flex items-center justify-center shadow-lg`}>{initial}</span>
      </div>
      <div>
        <p className="text-base font-bold text-white">{name}</p>
        <p className="text-xs text-slate-300">{role}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The spoken AI interview, in the browser, laid out like a proper interview
 * room: a lobby with a microphone check, then two tiles (the interviewer and
 * you) with live captions, a clock, and an end button that asks first. The
 * candidate talks to a Sarvam voice agent; the session address comes from our
 * own server (the API key never reaches this page). When it ends, the server
 * reads the conversation back from Sarvam and writes the school's report.
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
  const [agentLevel, setAgentLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notice, setNotice] = useState('');

  const agentRef = useRef<AgentLike | null>(null);
  const linesRef = useRef<Line[]>([]);
  const interviewRef = useRef('');
  const startedAt = useRef(0);
  const finishing = useRef(false);
  const transcriptEnd = useRef<HTMLDivElement | null>(null);

  const mic = useMicLevel(phase === 'lobby' || phase === 'live');
  const micLevel = muted ? 0 : mic.level;

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
      setPhase(data.interview?.status === 'completed' && data.viewer !== 'staff' ? 'done' : 'lobby');
    } catch {
      setError('Could not reach the server. Check your connection and refresh.');
      setPhase('error');
    }
  }, [id]);

  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);
  useEffect(() => () => { agentRef.current?.stop().catch(() => undefined); }, []);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [lines, showTranscript]);
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setConfirmEnd(false);
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
    setMuted(false);
    try {
      const res = await fetch('/api/voice-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', candidate_id: id, language }),
      });
      const start = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(start.error || 'Could not start the interview.');
      interviewRef.current = start.interview_id;

      if (start.engine === 'own') {
        // Our own pipeline: the browser listens and plays; our server hears, thinks and speaks through Sarvam.
        const { OwnInterviewClient } = await import('@/lib/voice/browserInterview');
        const client = new OwnInterviewClient({ candidateId: id, interviewId: start.interview_id }, {
          onState: (s) => setAgentState(s),
          onLine: (l) => { linesRef.current = [...linesRef.current, l]; setLines(linesRef.current); setNotice(''); },
          onAgentLevel: (l) => setAgentLevel(l),
          onMicLevel: () => undefined,
          onEnd: () => { if (!finishing.current) void finish(); },
          onError: (m) => setNotice(m),
        });
        agentRef.current = {
          start: () => client.start(),
          waitForConnect: async () => true,
          stop: () => client.stop(),
          mute: () => client.setMuted(true),
          unmute: () => client.setMuted(false),
        };
        startedAt.current = Date.now();
        setSeconds(0);
        setPhase('live');
        await client.start();
        return;
      }

      const sdk = await import('sarvam-conv-ai-sdk/browser');
      const audio = new sdk.BrowserAudioInterface(16000, {
        outputLevelCallback: (l: { rms: number }) => setAgentLevel(Math.min(1, l.rms * 6)),
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

  const first = name ? name.trim().split(/\s+/)[0] : 'there';
  const remaining = Math.max(0, TOTAL_SECONDS - seconds);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  const agentSpeaking = /speak/i.test(agentState);
  const listening = /listen/i.test(agentState);
  const lastAgent = [...lines].reverse().find((l) => l.role === 'agent')?.text;
  const lastUser = lines.length && lines[lines.length - 1].role === 'user' ? lines[lines.length - 1].text : '';
  const caption = lastAgent ?? 'Asha is getting ready…';
  const stateLabel = agentSpeaking ? 'Asha is speaking' : listening ? 'Asha is listening' : 'Asha is thinking…';
  const live = phase === 'live';

  return (
    <div className={`fixed inset-0 z-[60] overflow-y-auto ${live || phase === 'connecting' || phase === 'finishing' ? 'bg-slate-950 text-white' : 'bg-gradient-to-b from-indigo-50 via-white to-slate-50 text-slate-900'}`}>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 min-h-full flex flex-col">
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-black flex items-center justify-center">E</span>
            <div className="leading-tight">
              <p className={`text-sm font-black ${live ? 'text-white' : 'text-slate-900'}`}>Edcruiter interview</p>
              <p className={`text-[11px] ${live ? 'text-slate-400' : 'text-slate-500'}`}>{viewer === 'staff' ? 'Demo run by your team' : 'Spoken AI interview'}</p>
            </div>
          </div>
          {live && (
            <div className="flex items-center gap-3 text-xs font-bold text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> Recording as text</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10"><Clock className="w-3.5 h-3.5" /> {mm}:{ss}</span>
            </div>
          )}
        </header>

        {phase === 'loading' && <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}

        {phase === 'error' && (
          <div role="alert" className="max-w-xl p-5 rounded-3xl bg-rose-50 border border-rose-200 text-sm text-rose-900 space-y-3">
            <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>
            <button type="button" onClick={() => { setError(''); setPhase('loading'); void load(); }} className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-xs font-bold cursor-pointer">Try again</button>
          </div>
        )}

        {phase === 'lobby' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            <section className="lg:col-span-3 space-y-5">
              <div className="space-y-1.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">Before we begin</p>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight">Hello {first}, your interview</h1>
                <p className="text-slate-600 leading-relaxed">This is a structured interview of about 18 minutes with <strong>Asha</strong>, an AI interviewer. She asks about your career and your teaching, one question at a time, and follows up on your answers. Be specific: she will ask for real examples, and she may ask you to explain or justify what you say. You can ask her to repeat a question.</p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-3">
                <p className="text-sm font-black">What Asha will cover</p>
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {AGENDA.map((a, i) => (
                    <li key={a.name} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center">{i + 1}</span>
                      <span className="leading-tight"><span className="block text-sm font-bold">{a.name}</span><span className="block text-[11px] text-slate-500">{a.hint}</span></span>
                    </li>
                  ))}
                </ol>
              </div>

              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex gap-2.5"><Headphones className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> Sit somewhere quiet. Headphones help Asha hear you clearly.</li>
                <li className="flex gap-2.5"><MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> Answer directly, with examples from your real classes. General answers will be followed by more questions.</li>
                <li className="flex gap-2.5"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" /> The conversation is saved as text. The school team reads it with a written report. A person makes every decision.</li>
              </ul>
            </section>

            <aside className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-md p-5 space-y-5 lg:sticky lg:top-6">
              {!configured && <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-950">The voice interview is not switched on for this site yet.</p>}

              <div className="space-y-2">
                <p className="text-sm font-black">1. Check your microphone</p>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {mic.granted ? <Mic className="w-4 h-4 text-emerald-600" /> : <MicOff className="w-4 h-4 text-slate-400" />}
                    <span className={mic.granted ? 'font-semibold text-emerald-800' : 'text-slate-600'}>{mic.granted ? 'Microphone is on. Say a few words.' : 'Allow the microphone when your browser asks.'}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${Math.round(mic.level * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">The bar should move when you speak.</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-black">2. Choose your language</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Interview language">
                  {LANGUAGES.map((l) => (
                    <button key={l} type="button" onClick={() => setLanguage(l)} className={`px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer ${language === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300'}`}>{SPEAKS[l]}</button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">You can switch language any time. Asha follows you.</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-black">3. Agree and begin</p>
                <label className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer text-sm ${agreed ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-indigo-300'}`}>
                  <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-indigo-600" />
                  <span><strong>Tick this box</strong> to say you understand this is an AI interview, recorded as text for the school.</span>
                </label>
                {viewer === 'staff' && status === 'completed' && (
                  <p className="text-xs text-slate-600">An earlier run exists. Starting again replaces it. <Link className="font-bold text-indigo-700 underline" href={`/admin/candidates/${id}`}>See the report</Link></p>
                )}
                <button type="button" onClick={begin} disabled={!agreed || !configured} className="brand-primary-btn w-full justify-center px-6 py-4 rounded-2xl font-bold text-base shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <Mic className="w-5 h-5" /> Join the interview
                </button>
              </div>
            </aside>
          </div>
        )}

        {phase === 'connecting' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-20">
            <div className="w-20 h-20 rounded-full bg-indigo-500/30 flex items-center justify-center animate-pulse"><span className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-xl font-black">A</span></div>
            <p className="text-lg font-bold">Connecting you to Asha…</p>
            <p className="text-sm text-slate-400">Allow the microphone if your browser asks.</p>
          </div>
        )}

        {live && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" aria-label="Time used">
              <div className="h-full bg-indigo-400 transition-[width] duration-1000" style={{ width: `${Math.min(100, (seconds / TOTAL_SECONDS) * 100)}%` }} />
            </div>
            <p className="text-center text-xs text-slate-400">{remaining > 60 ? `About ${Math.ceil(remaining / 60)} minutes left` : 'Nearly done'}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Tile name="Asha" role="AI interviewer" initial="A" level={agentLevel} speaking={agentSpeaking} accent="bg-indigo-500" />
              <Tile name={first === 'there' ? 'You' : `${first} (you)`} role={muted ? 'Microphone muted' : 'Candidate'} initial={first.charAt(0).toUpperCase() || 'Y'} level={micLevel} speaking={!muted && micLevel > 0.12} accent="bg-emerald-500">
                <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden" aria-hidden="true"><div className="h-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${Math.round(micLevel * 100)}%` }} /></div>
              </Tile>
            </div>

            <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-5 text-center space-y-2 min-h-[112px]" aria-live="polite">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">{stateLabel}</p>
              <p className="text-lg sm:text-xl font-semibold leading-snug">{caption}</p>
              {lastUser && <p className="text-sm text-emerald-300">You: {lastUser}</p>}
              {notice && <p className="text-xs text-amber-300">{notice}</p>}
            </div>

            {showTranscript && (
              <div className="rounded-3xl bg-white/5 ring-1 ring-white/10 p-4 max-h-52 overflow-y-auto space-y-2">
                {lines.length === 0 && <p className="text-sm text-slate-400">The conversation will appear here.</p>}
                {lines.map((l, i) => (
                  <p key={i} className={`text-sm leading-relaxed ${l.role === 'agent' ? 'text-slate-100' : 'text-emerald-300'}`}><strong>{l.role === 'agent' ? 'Asha' : 'You'}:</strong> {l.text}</p>
                ))}
                <div ref={transcriptEnd} />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button type="button" onClick={toggleMute} className={`px-5 py-3 rounded-full text-sm font-bold flex items-center gap-2 cursor-pointer ${muted ? 'bg-amber-500 text-slate-950' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                {muted ? <><MicOff className="w-4 h-4" /> Unmute</> : <><Mic className="w-4 h-4" /> Mute</>}
              </button>
              <button type="button" onClick={() => setShowTranscript((v) => !v)} className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" /> {showTranscript ? 'Hide' : 'Show'} transcript
              </button>
              <button type="button" onClick={() => setConfirmEnd(true)} className="px-5 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
                <PhoneOff className="w-4 h-4" /> Leave
              </button>
            </div>
            <p className="text-center text-[11px] text-slate-500">Take your time to think. If you need a question again, say &ldquo;please repeat that&rdquo;.</p>
          </div>
        )}

        {confirmEnd && (
          <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Leave the interview">
            <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
              <h2 className="text-lg font-black">Leave the interview?</h2>
              <p className="text-sm text-slate-600">If Asha has not finished her questions, the school sees a shorter interview. You will not be able to start again unless the school invites you.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmEnd(false)} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold cursor-pointer">Stay</button>
                <button type="button" onClick={() => void finish()} className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold cursor-pointer">Leave and finish</button>
              </div>
            </div>
          </div>
        )}

        {phase === 'finishing' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-20">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
            <p className="text-lg font-bold">Thank you. Saving your interview…</p>
            <p className="text-sm text-slate-400">This takes a few seconds. Please keep this page open.</p>
          </div>
        )}

        {phase === 'done' && (
          <section className="max-w-xl mx-auto w-full bg-white rounded-3xl border border-slate-200 shadow-md p-8 text-center space-y-4 my-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-2xl font-black">Thank you, {first}. Your interview is done.</h2>
            <p className="text-sm text-slate-600 leading-relaxed">The school team will read your interview and be in touch about the next step. You do not need to do anything else.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {viewer === 'staff'
                ? <Link href={`/admin/candidates/${id}#ai-interview`} className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">See the report</Link>
                : <Link href={`/candidate/${id}`} className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">Back to my application</Link>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
