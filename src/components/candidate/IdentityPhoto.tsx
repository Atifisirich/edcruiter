'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Camera, RefreshCw } from 'lucide-react';
import DeviceCheck, { type DeviceReady } from './DeviceCheck';
import { describeFace, loadFaceModels, referencePhoto, type MeasuredFace } from '@/lib/faceClient';
import { referencesAgree } from '@/lib/faceMatch';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gives up on `p` after `ms`, so a slow phone can never leave the candidate staring at a spinner. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * The photo taken at the start. Later stages are compared with it, so a different
 * person sitting down to answer is noticed. Three quick frames are measured so
 * one blink or one odd angle does not decide it.
 */
export default function IdentityPhoto({
  existingUrl,
  locked = false,
  onSaved,
  withMic = true,
}: {
  existingUrl?: string;
  /** True once the timed stages have begun. The photo can no longer be replaced. */
  locked?: boolean;
  onSaved: (photoUrl: string, measured: boolean) => void;
  withMic?: boolean;
}) {
  const [device, setDevice] = useState<DeviceReady | null>(null);
  const [photo, setPhoto] = useState(existingUrl || '');
  const [retaking, setRetaking] = useState(!existingUrl);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [modelFailed, setModelFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadFaceModels().catch(() => { if (!cancelled) setModelFailed(true); });
    return () => { cancelled = true; };
  }, []);

  const [misses, setMisses] = useState(0);

  const save = async (image: string, found: MeasuredFace[]) => {
    setMessage('Saving…');
    const res = await fetch('/api/identity/reference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No measurements at all is allowed (the photo alone is kept); an empty list is not sent.
      body: JSON.stringify(found.length ? { image, descriptors: found.map((f) => f.descriptor) } : { image }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setProblem(data.error || 'The photo could not be saved. Try again.');
      return;
    }
    setPhoto(data.photo_url);
    setRetaking(false);
    setMisses(0);
    onSaved(data.photo_url, !!data.measured);
  };

  const take = async () => {
    if (!device) return;
    setBusy(true);
    setProblem('');
    setMessage('Hold still and look straight at the camera…');
    try {
      const found: MeasuredFace[] = [];
      let image: string | undefined = referencePhoto(device.video);

      // Measuring a face needs the model, which is large on a slow connection or phone.
      // Wait a limited time; never leave the candidate stuck here.
      let canMeasure = !modelFailed;
      if (canMeasure) {
        canMeasure = await withTimeout(loadFaceModels(), 12_000).then(() => true).catch(() => false);
      }

      if (canMeasure) {
        const deadline = Date.now() + 10_000;
        for (let i = 0; i < 6 && found.length < 3 && Date.now() < deadline; i++) {
          await sleep(400);
          const face = await withTimeout(describeFace(device.video), 4_000).catch(() => null);
          if (face && face.score >= 0.5 && face.size >= 0.1) {
            found.push(face);
            image = referencePhoto(device.video) || image;
          }
        }
        const agree = found.length > 0 && referencesAgree(found.map((f) => f.descriptor));
        if (!agree) {
          // Not seen clearly. The first time, say how to fix it. After that, do not block the
          // candidate: keep the photo for the reviewer and let them carry on to the next stage.
          if (misses < 1) {
            setMisses((m) => m + 1);
            setProblem(found.length === 0
              ? 'We could not see one clear face. Sit a little closer, face the light, make sure nobody else is in the picture, and press the button again.'
              : 'The pictures did not agree. Keep still, look straight at the camera, and press the button again.');
            return;
          }
          found.length = 0;
        }
      }

      if (!image) image = referencePhoto(device.video);
      if (!image) {
        setProblem('The picture could not be taken. Wait a moment for the camera to show you, then try again.');
        return;
      }
      await save(image, found);
    } catch {
      setProblem('Something went wrong. Press the button to try again.');
    } finally {
      setBusy(false);
      setMessage('');
    }
  };

  if (photo && !retaking) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Your photo" className="w-24 h-24 rounded-2xl object-cover border border-slate-200 -scale-x-100" />
        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-1.5 font-bold text-emerald-800"><CheckCircle2 className="w-4 h-4" /> Photo saved</p>
          <p className="text-xs text-slate-500 max-w-xs">
            {locked ? 'It is locked now that the timed stages have begun.' : 'The next stages are checked against this photo.'}
          </p>
          {!locked && (
            <button type="button" onClick={() => setRetaking(true)} className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Take it again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DeviceCheck withMic={withMic} onReady={setDevice} />
      {device && (
        <div className="space-y-3 text-center">
          <ul className="inline-block text-left text-xs text-slate-600 space-y-1">
            <li>• Face the light and look straight at the camera.</li>
            <li>• Only you in the picture. No sunglasses or mask.</li>
          </ul>
          <div>
            <button
              type="button"
              onClick={take}
              disabled={busy}
              className="brand-primary-btn inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              {busy ? message || 'Taking photo…' : 'Take my photo'}
            </button>
          </div>
        </div>
      )}
      {modelFailed && (
        <p className="text-[11px] text-slate-500 text-center">The automatic face check is not available on this device. Your photo is still kept for the school to see.</p>
      )}
      {problem && (
        <p role="alert" className="flex items-start gap-2 text-xs text-rose-900 bg-rose-50 border border-rose-200 rounded-xl p-3 max-w-sm mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {problem}
        </p>
      )}
    </div>
  );
}
