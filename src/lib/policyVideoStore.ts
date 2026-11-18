/**
 * Where the policy video's pieces live on disk, and the uploads in progress.
 * Server only. The pure rules (piece sizes, ranges, questions) are in policyVideo.ts.
 */

import fs from 'fs';
import { randomBytes } from 'crypto';
import { ensureUploadsDir, safeUploadPath } from './uploads';
import { chunkCount, chunkFilename, piecesFor, VIDEO_CHUNK_BYTES } from './policyVideo';
import type { PolicyVideo } from './types';

export interface UploadSession {
  id: string;
  schoolId: string;
  title: string;
  mime: string;
  size: number;
  chunks: number;
  received: Set<number>;
  by: string;
  startedAt: number;
}

/** An unfinished upload is dropped after six hours, with its pieces. */
const SESSION_TTL_MS = 6 * 60 * 60_000;

// One copy of the app runs (see the hosting notes), so uploads in progress can
// live in memory. Kept on globalThis so a code reload in development keeps them.
const store = globalThis as unknown as { __policyVideoUploads?: Map<string, UploadSession> };
const sessions: Map<string, UploadSession> = (store.__policyVideoUploads ??= new Map());

function pathFor(videoId: string, index: number): string | null {
  return safeUploadPath(chunkFilename(videoId, index));
}

function deletePieces(videoId: string, chunks: number) {
  for (let i = 0; i < chunks; i++) {
    const p = pathFor(videoId, i);
    if (p) fs.promises.unlink(p).catch(() => undefined);
  }
}

function sweepStale() {
  const now = Date.now();
  for (const s of sessions.values()) {
    if (now - s.startedAt > SESSION_TTL_MS) {
      sessions.delete(s.id);
      deletePieces(s.id, s.chunks);
    }
  }
}

export function startUpload(input: { schoolId: string; title: string; mime: string; size: number; by: string }): UploadSession {
  sweepStale();
  // One upload per school at a time: starting again replaces an unfinished one.
  for (const s of sessions.values()) {
    if (s.schoolId === input.schoolId) {
      sessions.delete(s.id);
      deletePieces(s.id, s.chunks);
    }
  }
  const session: UploadSession = {
    id: `${Date.now()}${randomBytes(6).toString('hex')}`,
    ...input,
    chunks: chunkCount(input.size),
    received: new Set(),
    startedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getUpload(id: string): UploadSession | undefined {
  sweepStale();
  return sessions.get(id);
}

export async function savePiece(session: UploadSession, index: number, bytes: Uint8Array): Promise<void> {
  ensureUploadsDir();
  const p = pathFor(session.id, index);
  if (!p) throw new Error('Could not resolve a safe storage path.');
  await fs.promises.writeFile(p, bytes);
  session.received.add(index);
}

/** The finished video, once every piece has arrived; the session is closed. */
export function finishUpload(session: UploadSession): PolicyVideo | null {
  if (session.received.size !== session.chunks) return null;
  sessions.delete(session.id);
  return {
    id: session.id,
    title: session.title,
    mime: session.mime,
    size: session.size,
    chunk_size: VIDEO_CHUNK_BYTES,
    chunks: session.chunks,
    uploaded_at: new Date().toISOString(),
    uploaded_by: session.by,
  };
}

/** Deletes a stored video's pieces. Best effort: a missing piece is already gone. */
export function removeVideoFiles(video: PolicyVideo | undefined) {
  if (video) deletePieces(video.id, video.chunks);
}

/**
 * Streams bytes start..end (inclusive) of a stored video, reading only the
 * pieces it needs, a slice at a time, so a long video never sits in memory.
 */
export function streamVideoBytes(video: PolicyVideo, start: number, end: number): ReadableStream<Uint8Array> {
  const plan = piecesFor(start, end, video.chunk_size);
  let i = 0;
  let pos = 0; // position inside plan[i]
  const SLICE = 1024 * 1024;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (i < plan.length) {
        const piece = plan[i];
        const from = piece.from + pos;
        if (from > piece.to) { i++; pos = 0; continue; }
        const p = pathFor(video.id, piece.index);
        if (!p) { controller.error(new Error('Bad piece path')); return; }
        const length = Math.min(SLICE, piece.to - from + 1);
        const handle = await fs.promises.open(p, 'r');
        try {
          const buf = Buffer.alloc(length);
          const { bytesRead } = await handle.read(buf, 0, length, from);
          if (bytesRead === 0) { controller.error(new Error('Video piece is missing or short.')); return; }
          pos += bytesRead;
          controller.enqueue(new Uint8Array(buf.buffer, buf.byteOffset, bytesRead));
          return;
        } finally {
          await handle.close();
        }
      }
      controller.close();
    },
  });
}

/** True when every piece of a stored video is on disk. */
export function videoFilesPresent(video: PolicyVideo): boolean {
  for (let i = 0; i < video.chunks; i++) {
    const p = pathFor(video.id, i);
    if (!p || !fs.existsSync(p)) return false;
  }
  return true;
}
