/**
 * Large recordings go up in pieces. Cloud Run refuses any single request over
 * 32 MB with an HTML error page, and a five-minute webcam demo is about twice
 * that, so one big upload fails however good the connection is. The browser
 * sends pieces of a few MB; when the last one arrives they are joined into the
 * one file the rest of the app already expects.
 */

import fs from 'fs';
import path from 'path';

export const CHUNK_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_CHUNKS = 40;
export const MAX_TOTAL_BYTES = 150 * 1024 * 1024;

const SAFE = /^[A-Za-z0-9_-]{6,80}$/;

export function safePart(value: unknown): string | null {
  return typeof value === 'string' && SAFE.test(value) ? value : null;
}

export function chunkDirFor(root: string, candidateId: string, uploadId: string): string {
  return path.join(root, '.chunks', `${candidateId}__${uploadId}`);
}

export function saveChunk(dir: string, index: number, bytes: Buffer): void {
  fs.mkdirSync(dir, { recursive: true });
  // Written under its own name, so sending the same piece again simply replaces it.
  fs.writeFileSync(path.join(dir, String(index).padStart(4, '0')), bytes);
}

export function receivedChunks(dir: string): number[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}$/.test(f)).map(Number).sort((a, b) => a - b);
}

export type JoinResult = { ok: true; size: number } | { ok: false; error: string };

/** Joins pieces 0 to total-1 into `target`, then removes the pieces. Fails if any is missing or the whole is too big. */
export function joinChunks(dir: string, total: number, target: string, maxBytes = MAX_TOTAL_BYTES): JoinResult {
  const have = new Set(receivedChunks(dir));
  for (let i = 0; i < total; i++) {
    if (!have.has(i)) return { ok: false, error: `Part ${i + 1} of ${total} is missing.` };
  }
  let size = 0;
  for (let i = 0; i < total; i++) size += fs.statSync(path.join(dir, String(i).padStart(4, '0'))).size;
  if (size > maxBytes) return { ok: false, error: 'The recording is too large.' };
  const fd = fs.openSync(target, 'w');
  try {
    for (let i = 0; i < total; i++) fs.writeSync(fd, fs.readFileSync(path.join(dir, String(i).padStart(4, '0'))));
  } finally {
    fs.closeSync(fd);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return { ok: true, size };
}
