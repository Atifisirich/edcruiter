'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Mic, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { stopStream, trackStream } from '@/lib/mediaRegistry';

export interface DeviceReady {
  video: HTMLVideoElement;
  stream: MediaStream;
}

/** A reason the candidate can act on, rather than one message for every failure. */
export function describeDeviceError(err: unknown, wantMic: boolean): string {
  const name = (err as { name?: string } | null)?.name;
  const what = wantMic ? 'camera and microphone' : 'camera';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return `Access to your ${what} was blocked. Click the camera icon in the address bar, choose Allow, then press the button again.`;
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return `No ${what} was found. Plug in or turn on your webcam${wantMic ? ' and microphone' : ''}, then try again.`;
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your camera or microphone is being used by another app or tab (Zoom, Meet, Teams). Close it, then try again.';
    case 'SecurityError':
      return 'The browser will not open the camera on this page. Make sure the address starts with https://.';
    default:
      return `Your ${what} could not start. Try again. If it keeps failing, restart your browser.`;
  }
}

/**
 * Asks for the camera (and microphone) and shows what they see and hear. This is
 * done before a stage begins, while nothing is timed, so the browser's permission
 * questions are answered first. A permission question that appears in the middle
 * of a recording is one of the things that knocks a browser out of fullscreen.
 */
export default function DeviceCheck({
  withMic,
  onReady,
  autoStart = false,
}: {
  withMic: boolean;
  onReady: (ready: DeviceReady | null) => void;
  autoStart?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const goneRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const onReadyRef = useRef(onReady);
  const [status, setStatus] = useState<'idle' | 'asking' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [hasMic, setHasMic] = useState(false);
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  const meter = useCallback((stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        const pct = Math.min(100, Math.round((avg / 90) * 100));
        setLevel(pct);
        if (pct > 12) setHeard(true);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* the meter is a nicety */
    }
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('This browser cannot open the camera here. Use the latest Chrome or Edge, and make sure the address starts with https://.');
      return;
    }
    setStatus('asking');
    setError('');
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: withMic ? { echoCancellation: true, noiseSuppression: true } : false,
        });
      } catch (first) {
        const name = (first as { name?: string }).name;
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'NotReadableError') throw first;
        // One of the two is missing. Say which.
        const cameraOnly = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
        if (cameraOnly) {
          cameraOnly.getTracks().forEach((t) => t.stop());
          throw Object.assign(new Error('mic'), { name: 'NotFoundError', mic: true });
        }
        throw first;
      }
      trackStream(stream);
      if (goneRef.current) { stopStream(stream); return; }
      stopStream(streamRef.current);
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      const audio = stream.getAudioTracks().length > 0;
      setHasMic(audio);
      if (audio) meter(stream);
      setStatus('ready');
      if (video) onReadyRef.current({ video, stream });
    } catch (err) {
      setStatus('error');
      setError((err as { mic?: boolean }).mic
        ? 'Your camera works but no microphone was found. Plug in or turn on a microphone, then try again.'
        : describeDeviceError(err, withMic));
      onReadyRef.current(null);
    }
  }, [meter, withMic]);

  useEffect(() => {
    goneRef.current = false;
    if (autoStart) {
      // Asking for a camera starts a browser prompt; the state it sets is the prompt's own progress.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      start();
    }
    return () => {
      goneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {});
      stopStream(streamRef.current);
      streamRef.current = null;
      onReadyRef.current(null);
    };
  }, [autoStart, start]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] max-w-sm w-full mx-auto rounded-2xl bg-slate-900 overflow-hidden border border-slate-200">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover block -scale-x-100" />
        {status !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center text-slate-200 bg-slate-900/95">
            {status === 'asking' ? <Loader2 className="w-7 h-7 animate-spin text-indigo-300" /> : <Camera className="w-7 h-7 text-indigo-300" />}
            <p className="text-xs leading-relaxed max-w-xs">
              {status === 'asking'
                ? `Your browser is asking for permission. Choose Allow for the ${withMic ? 'camera and microphone' : 'camera'}.`
                : status === 'error'
                ? error
                : `We need your ${withMic ? 'camera and microphone' : 'camera'}. Nothing is recorded in this step.`}
            </p>
            {status !== 'asking' && (
              <button
                type="button"
                onClick={start}
                className="brand-primary-btn px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                {status === 'error' ? 'Try again' : `Allow ${withMic ? 'camera and microphone' : 'camera'}`}
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold">
        <li className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${status === 'ready' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
          {status === 'ready' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
          Camera {status === 'ready' ? 'on' : 'not yet'}
        </li>
        {withMic && (
          <li className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${status === 'ready' && hasMic ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            {status === 'ready' && hasMic ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            Microphone {status === 'ready' && hasMic ? 'on' : 'not yet'}
          </li>
        )}
      </ul>

      {withMic && status === 'ready' && hasMic && (
        <div className="max-w-sm mx-auto space-y-1">
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${level}%` }} />
          </div>
          <p className="text-[11px] text-center text-slate-500">
            {heard ? 'We can hear you.' : 'Say a few words. The bar should move.'}
          </p>
        </div>
      )}

      {status === 'ready' && withMic && !hasMic && (
        <p role="alert" className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-sm mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> No microphone was found. The recorded stages need one.
        </p>
      )}
    </div>
  );
}
