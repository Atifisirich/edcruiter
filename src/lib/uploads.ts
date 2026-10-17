import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { db } from './db';

/**
 * Candidate media (resumes, interview recordings) lives under data/uploads,
 * not public/. The old public/uploads/ directory was served by Next
 * statically to anyone with the URL, with no auth check — every resume and
 * every interview recording in the product was a guessable filename away
 * from anyone on the internet. Files here are only reachable through
 * /api/media/[...path], which checks the requester owns the record before
 * streaming a single byte.
 */
export const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');
export const UPLOADS_URL_PREFIX = '/api/media/';

export function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

const MEDIA_MIME_EXT: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'image/png': 'png',
  'image/jpeg': 'jpg'
};

const RESUME_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf'
};

/**
 * Picks a safe extension from the browser-reported MIME type against an
 * allowlist — never from the client-supplied filename. The previous upload
 * route took `file.name.split('.').pop()` directly into the saved path,
 * which let a caller choose the extension (including `.html`, enabling
 * stored XSS from this origin) and, combined with a crafted name, escape
 * the uploads directory entirely.
 *
 * Strips codec parameters before matching — a MediaRecorder blob's
 * reported type is almost never the bare "video/webm" this table's keys
 * use, it's "video/webm;codecs=vp8,opus" (the exact codec string varies by
 * browser). An exact-match lookup against the full string rejected nearly
 * every real recording with a 415, which VideoRecorderUpload's upload
 * failure handling then silently masked by falling back to a local
 * blob: URL — playable in that same tab, dead everywhere else (a reload,
 * a reviewer's report, or the server trying to hand it to the AI scorer).
 */
export function extensionForMime(mimeType: string, kind: 'media' | 'resume'): string | null {
  const table = kind === 'resume' ? RESUME_MIME_EXT : MEDIA_MIME_EXT;
  const base = mimeType.split(';')[0].trim().toLowerCase();
  return table[base] || null;
}

/** Generates an unguessable filename. Never derived from user input. */
export function randomUploadFilename(prefix: string, ext: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
}

/**
 * Resolves a requested filename to an absolute path, refusing anything that
 * would resolve outside UPLOADS_DIR (path traversal via `..`, an absolute
 * path, or a URL-encoded variant of either).
 */
export function safeUploadPath(filename: string): string | null {
  const decoded = decodeURIComponent(filename);
  if (decoded.includes('\0')) return null;
  const resolved = path.resolve(UPLOADS_DIR, decoded);
  const withSep = UPLOADS_DIR.endsWith(path.sep) ? UPLOADS_DIR : UPLOADS_DIR + path.sep;
  if (!resolved.startsWith(withSep)) return null;
  return resolved;
}

export function mediaUrlFor(filename: string): string {
  return `${UPLOADS_URL_PREFIX}${filename}`;
}

/**
 * Finds which candidate a stored media URL belongs to, so /api/media can
 * authorize access the same way the rest of the app does (that candidate,
 * or staff at their school) instead of trusting the URL alone.
 */
export function findMediaOwner(urlPath: string): { candidateId: string; schoolId: string } | undefined {
  return db.findCandidateByMediaUrl(urlPath);
}
