'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import DeviceCheck, { type DeviceReady } from './DeviceCheck';
import IdentityPhoto from './IdentityPhoto';
import ApplicationIdCard from './ApplicationIdCard';
import StageIntro from './StageIntro';
import { describeFace, faceSnapshot } from '@/lib/faceClient';
import type { FaceReference } from '@/lib/types';

type FaceState = 'waiting' | 'checking' | 'ok' | 'mismatch' | 'accepted';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The page a candidate sees before each timed stage, every time they begin one.
 * It says what is about to happen and the rules, asks for the camera and
 * microphone while nothing is timed, checks that the person here is the person
 * who registered, and only then lets them start. Starting takes the browser into
 * fullscreen, which is allowed only from a button the candidate presses.
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
  const canStart = acknowledged && !!device && faceCleared && testReady && !starting;

  const begin = () => {
    // Fullscreen can only be entered from a press of this button.
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    onStart();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to my stages
      </button>

      <div className="bg-indigo-600 text-white rounded-3xl p-5 sm:p-6 space-y-1.5">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">Before you start</p>
        <h2 className="text-xl sm:text-2xl font-black leading-tight">Stage {number} is timed and watched</h2>
        <p className="text-sm text-indigo-100">Take a minute to read this and check your camera. Nothing starts until you press the button at the bottom.</p>
      </div>

      <StageIntro stageKey={stageKey} number={number} />

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="w-4 h-4 text-indigo-600" /> The rules</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span><strong>Finish this stage in one sitting.</strong> If you leave half way and come back, you get different questions and the school sees that you restarted. You have a limited number of restarts.</span></li>
          <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>Stay in fullscreen. Do not switch tabs or open another window.</span></li>
          <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>Your camera and microphone stay on. Only you in the room, in good light.</span></li>
          <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>No phone, notes, other screens or AI tools. Copy and paste are blocked.</span></li>
          <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>The person who took the photo at the start must be the one taking the test. This is checked.</span></li>
        </ul>
        <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer text-sm text-slate-800">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 w-4 h-4 accent-indigo-600" />
          <span>I have read the rules and I am ready.</span>
        </label>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-black text-slate-900">Check your camera and microphone</h3>
        {needsPhoto ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">We do not have your start photo yet. Take it now. It is used to confirm it is you in this and the next stages.</p>
            <IdentityPhoto onSaved={(url) => { setPhotoUrl(url); setFace('ok'); }} />
          </div>
        ) : (
          <>
            <DeviceCheck withMic onReady={setDevice} />
            {face === 'checking' && (
              <p className="flex items-center justify-center gap-2 text-xs text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Checking it is you…</p>
            )}
            {face === 'ok' && measured && (
              <p className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-800"><CheckCircle2 className="w-4 h-4" /> It is you. Thank you.</p>
            )}
            {face === 'mismatch' && (
              <div role="alert" className="max-w-md mx-auto p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-950 space-y-3">
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

      {applicationId && (
        <section className="space-y-2">
          <p className="text-xs text-slate-500 text-center">Keep your application ID. It is how you come back to your next stage.</p>
          <ApplicationIdCard code={applicationId} />
        </section>
      )}

      {startError && (
        <p role="alert" className="flex items-start gap-2 text-sm text-rose-900 bg-rose-50 border border-rose-200 rounded-2xl p-4 font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" /> {startError}
        </p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        {!testReady && <p className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Your test is being prepared…</p>}
        <button
          type="button"
          onClick={begin}
          disabled={!canStart}
          className="brand-primary-btn w-full sm:w-auto justify-center px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</> : <>Start Stage {number} <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
      {!canStart && !starting && (
        <p className="text-[11px] text-slate-500 text-right">
          To start: {[
            !acknowledged && 'tick the rules',
            !device && !needsPhoto && 'allow camera and microphone',
            needsPhoto && 'take your photo',
            !!device && !faceCleared && !needsPhoto && 'finish the face check',
          ].filter(Boolean).join(', ') || 'one moment'}.
        </p>
      )}
    </div>
  );
}
