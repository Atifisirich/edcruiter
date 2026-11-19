'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, Circle, Clock, Loader2, ShieldCheck } from 'lucide-react';
import DeviceCheck, { type DeviceReady } from './DeviceCheck';
import IdentityPhoto from './IdentityPhoto';
import ApplicationIdCard from './ApplicationIdCard';
import { STAGE_GUIDE } from '@/lib/candidateStageGuide';
import { describeFace, faceSnapshot } from '@/lib/faceClient';
import type { FaceReference } from '@/lib/types';

type FaceState = 'waiting' | 'checking' | 'ok' | 'mismatch' | 'accepted';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RULES = [
  'Do the whole stage in one sitting. If you leave and come back, the questions change and the school sees you restarted.',
  'Stay in fullscreen. Do not switch tabs or open other windows.',
  'Camera and microphone stay on. Only you in the room, in good light.',
  'No phone, notes, other screens or AI tools. Copy and paste are blocked.',
  'The person who took the start photo must be the one taking the test. This is checked.',
];

/** One line of the checklist beside the Start button: done, or still to do. */
function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs font-bold ${done ? 'text-emerald-700' : 'text-slate-500'}`}>
      {done ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <Circle className="w-4 h-4 shrink-0 text-slate-300" />}
      {children}
    </li>
  );
}

/**
 * The single page a candidate sees before each timed stage. Everything is on
 * one screen: what the stage is, the rules, the camera check and the Start
 * button. The button stays at the bottom of the screen and lists exactly what is
 * still to do, so nobody has to scroll to find out why they cannot start.
 * Starting takes the browser into fullscreen, which is allowed only from a button
 * the candidate presses.
 */
export default function StageBriefing({
  stageKey,
  number,
  applicationId,
  faceReference,
  testReady,
  starting,
  startError,
  onStart,
  onBack,
}: {
  stageKey: string;
  number: number;
  applicationId?: string;
  faceReference?: FaceReference;
  testReady: boolean;
  starting: boolean;
  startError: string;
  onStart: () => void;
  onBack: () => void;
}) {
  const guide = STAGE_GUIDE[stageKey];
  const [device, setDevice] = useState<DeviceReady | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(faceReference?.photo_url || '');
  const [face, setFace] = useState<FaceState>('waiting');
  const checkedFor = useRef<MediaStream | null>(null);

  const needsPhoto = !photoUrl;
  const measured = !!faceReference?.measured;

  const runCheck = useCallback(async (d: DeviceReady) => {
    setFace('checking');
    let last = 'unchecked';
    for (let i = 0; i < 3; i++) {
      await sleep(i === 0 ? 700 : 900);
      const found = await describeFace(d.video).catch(() => null);
      if (!found) continue;
      const res = await fetch('/api/identity/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor: found.descriptor, stage_key: stageKey, phase: 'start', image: faceSnapshot(d.video, 200) }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      last = typeof data.verdict === 'string' ? data.verdict : 'unchecked';
      if (last === 'match' || last === 'unchecked') { setFace('ok'); return; }
      if (last === 'mismatch') { setFace('mismatch'); return; }
    }
    // Could not measure a face, or the result stayed unclear: let them through. Live checks carry on during the stage.
    setFace('ok');
  }, [stageKey]);

  useEffect(() => {
    if (!device || needsPhoto || !measured) return;
    if (checkedFor.current === device.stream) return;
    checkedFor.current = device.stream;
    runCheck(device);
  }, [device, needsPhoto, measured, runCheck]);

  const faceCleared = needsPhoto ? false : !measured || face === 'ok' || face === 'accepted';
  const cameraDone = !needsPhoto && !!device;
  const canStart = acknowledged && cameraDone && faceCleared && testReady && !starting;

  const begin = () => {
    // Fullscreen can only be entered from a press of this button.
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    onStart();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to my stages
      </button>

      {/* What is about to happen, in one glance */}
      <div className="bg-indigo-600 text-white rounded-3xl px-5 py-4 space-y-1.5">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">Stage {number} of 5 is next</p>
        <h2 className="text-lg sm:text-xl font-black leading-tight">{guide?.title ?? `Stage ${number}`}</h2>
        {guide && <p className="text-sm text-indigo-100">{guide.summary}</p>}
        <p className="text-sm text-white">Do the <strong>three things</strong> below. The Start button at the bottom turns on when they are done.</p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-bold">
          {guide && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15"><Clock className="w-3 h-3" /> {guide.time}</span>}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15"><Camera className="w-3 h-3" /> Camera and microphone on</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15"><ShieldCheck className="w-3 h-3" /> Timed and watched</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* 1. Read, and agree */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">1</span>
            Read what to do and the rules
          </h3>
          {guide && (
            <ol className="space-y-2">
              {guide.steps.map((step, i) => (
                <li key={step} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-black flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-900">The rules</p>
            <ul className="space-y-1.5 text-[13px] text-amber-950">
              {RULES.map((r) => (
                <li key={r} className="flex gap-2"><span className="text-amber-700 font-black">•</span><span>{r}</span></li>
              ))}
            </ul>
          </div>
          <label className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer text-sm transition-colors ${acknowledged ? 'bg-emerald-50 border-emerald-400 text-emerald-950' : 'bg-white border-indigo-300 text-slate-900'}`}>
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 w-5 h-5 shrink-0 accent-indigo-600" />
            <span>
              <strong>Tick this box</strong> to say you have read the rules and will follow them.
            </span>
          </label>
        </section>

        {/* 2. Camera */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">2</span>
            Turn on your camera and microphone
          </h3>
          {needsPhoto ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">We do not have your start photo yet. Take it now. It is used to confirm it is you in this and the next stages.</p>
              <IdentityPhoto onSaved={(url) => { setPhotoUrl(url); setFace('ok'); }} />
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600">When your browser asks, press <strong>Allow</strong>. You should see yourself below. We then check that it is you.</p>
              <DeviceCheck withMic onReady={setDevice} />
              {face === 'checking' && (
                <p className="flex items-center justify-center gap-2 text-xs text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Checking it is you…</p>
              )}
              {face === 'ok' && measured && (
                <p className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="w-4 h-4" /> It is you. Thank you.</p>
              )}
              {face === 'mismatch' && (
                <div role="alert" className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-950 space-y-3">
                  <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" /> <span><strong>We could not match you to your start photo.</strong> Sit in good light, face the camera and take off anything covering your face. If this is not you, please do not continue; the school has been told.</span></p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { if (device) { checkedFor.current = null; runCheck(device); } }} className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-xs font-bold cursor-pointer">Try again</button>
                    <button type="button" onClick={() => setFace('accepted')} className="px-4 py-2 rounded-xl bg-amber-100 border border-amber-300 text-xs font-bold cursor-pointer">It is me, continue (noted for the school)</button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {applicationId && (
        <details className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
          <summary className="text-xs font-bold text-slate-700 cursor-pointer">Your application ID (keep it to come back to your next stage)</summary>
          <div className="mt-3"><ApplicationIdCard code={applicationId} /></div>
        </details>
      )}

      {startError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-2xl p-4 font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" /> {startError}
        </p>
      )}

      {/* 3. Start. Stays at the bottom of the screen so it is never out of sight. */}
      <div className="sticky bottom-3 z-10 bg-white/95 backdrop-blur rounded-3xl border border-slate-200 shadow-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6">
        <div className="flex-1 space-y-1.5">
          <p className="flex items-center gap-2 text-sm font-black text-slate-900">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">3</span>
            Press Start when all three are ticked
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <Check done={acknowledged}>Rules ticked</Check>
            <Check done={cameraDone}>Camera and microphone on</Check>
            <Check done={cameraDone && faceCleared}>It is you</Check>
            <Check done={testReady}>{testReady ? 'Test ready' : 'Test being prepared…'}</Check>
          </ul>
        </div>
        <button
          type="button"
          onClick={begin}
          disabled={!canStart}
          className="brand-primary-btn w-full lg:w-auto justify-center px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</> : <>Start Stage {number} <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
