/**
 * Measuring a face in the browser. A small face-recognition model (the vendored
 * copy of face-api.js in public/face-api, served from this site because the
 * page's security policy allows nothing else) turns a face into 128 numbers. The
 * numbers, never the model's verdict, are what the server compares with the photo
 * taken at the start. If the model cannot load on a device, callers carry on
 * without identity checks; the photo is still kept for the reviewer.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window { faceapi?: any }
}

export interface MeasuredFace {
  descriptor: number[];
  score: number;
  /** Width of the face as a share of the picture's width. */
  size: number;
}

let loading: Promise<any> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('The face model could not be loaded.'));
    document.head.appendChild(el);
  });
}

/** Loads the face model once. Rejects if it cannot be loaded. */
export function loadFaceModels(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser.'));
  if (loading) return loading;
  loading = (async () => {
    if (!window.faceapi) await injectScript('/face-api/face-api.js');
    const f = window.faceapi;
    if (!f) throw new Error('The face model did not start.');
    const base = `${window.location.origin}/face-api`;
    await Promise.all([
      f.nets.tinyFaceDetector.loadFromUri(base),
      f.nets.faceLandmark68TinyNet.loadFromUri(base),
      f.nets.faceRecognitionNet.loadFromUri(base),
    ]);
    return f;
  })().catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

/** Measures the one face in `source`. Null when there is no face, or more than one (it could be the wrong one). */
export async function describeFace(source: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement): Promise<MeasuredFace | null> {
  const f = await loadFaceModels();
  const options = new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const all = await f.detectAllFaces(source, options).withFaceLandmarks(true).withFaceDescriptors();
  if (!all || all.length !== 1) return null;
  const hit = all[0];
  const width = (source as HTMLVideoElement).videoWidth || (source as HTMLCanvasElement).width || 1;
  return {
    descriptor: Array.from(hit.descriptor as Float32Array),
    score: hit.detection.score,
    size: hit.detection.box.width / width,
  };
}

function toJpeg(source: HTMLVideoElement, width: number, quality: number): string | undefined {
  const w = source.videoWidth;
  const h = source.videoHeight;
  if (!w || !h) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((h / w) * width);
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** A small picture of the camera's view, for the reviewer. */
export function faceSnapshot(video: HTMLVideoElement, width = 200): string | undefined {
  return toJpeg(video, width, 0.6);
}

/** The photo kept as the candidate's reference. */
export function referencePhoto(video: HTMLVideoElement): string | undefined {
  return toJpeg(video, 480, 0.8);
}
