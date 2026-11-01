'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Camera, RefreshCw } from 'lucide-react';
import DeviceCheck, { type DeviceReady } from './DeviceCheck';
import { describeFace, loadFaceModels, referencePhoto, type MeasuredFace } from '@/lib/faceClient';
import { referencesAgree } from '@/lib/faceMatch';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const take = async () => {
    if (!device) return;
    setBusy(true);
    setProblem('');
    setMessage('Hold still and look straight at the camera…');
    try {
      const found: MeasuredFace[] = [];
      let image: string | undefined;
      if (!modelFailed) {
        for (let i = 0; i < 6 && found.length < 3; i++) {
          await sleep(450);
          const face = await describeFace(device.video).catch(() => null);
          if (face && face.score >= 0.6 && face.size >= 0.15) {
            found.push(face);
            image = referencePhoto(device.video);
          }
        }
        if (found.length < 2) {
          setProblem('We could not see one clear face. Sit a little closer, face the light, make sure nobody else is in the picture, and look straight at the camera.');
          return;
        }
        if (!referencesAgree(found.map((f) => f.descriptor))) {
          setProblem('The pictures did not agree. Keep still, look straight at the camera, and try again.');
          return;
        }
      } else {
        image = referencePhoto(device.video);
      }
      if (!image) {
        setProblem('The picture could not be taken. Try again.');
        return;
      }

      setMessage('Saving…');
      const res = await fetch('/api/identity/reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, descriptors: found.map((f) => f.descriptor) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(data.error || 'The photo could not be saved. Try again.');
        return;
      }
      setPhoto(data.photo_url);
      setRetaking(false);
      onSaved(data.photo_url, !!data.measured);
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
