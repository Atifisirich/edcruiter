import fs from 'fs';
import { db } from './db';
import { ensureUploadsDir, mediaUrlFor, randomUploadFilename, safeUploadPath } from './uploads';

const MAX_BYTES = 150 * 1024;
const PREFIX = 'data:image/jpeg;base64,';

/** Reads a small JPEG sent as a data URL. Null when it is missing, the wrong type or too big. */
export function decodeJpegDataUrl(value: unknown): Buffer | null {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return null;
  const buffer = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (buffer.length < 200 || buffer.length > MAX_BYTES) return null;
  // A real JPEG starts with FF D8.
  return buffer[0] === 0xff && buffer[1] === 0xd8 ? buffer : null;
}

/** Saves a picture under the candidate's name, so the candidate and their school's staff can open it and nobody else can. */
export function saveSnapshot(schoolId: string, candidateId: string, kind: 'face' | 'evidence', jpeg: Buffer): string | null {
  ensureUploadsDir();
  const filename = randomUploadFilename(kind, 'jpg');
  const absPath = safeUploadPath(filename);
  if (!absPath) return null;
  fs.writeFileSync(absPath, jpeg);
  db.recordUploadOwner({ filename, candidate_id: candidateId, school_id: schoolId, created_at: new Date().toISOString() });
  return mediaUrlFor(filename);
}
