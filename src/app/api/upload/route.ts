import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { authErrorResponse, requireCandidate } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUploadsDir, extensionForMime, mediaUrlFor, randomUploadFilename, safeUploadPath } from '@/lib/uploads';
import { checkRateLimit } from '@/lib/rateLimit';

const MAX_BYTES = 150 * 1024 * 1024; // 150MB — comfortably covers a 5-minute webcam recording.

/**
 * Stores a candidate's stage recording. Requires a candidate session (the
 * previous version had no auth at all and derived the saved file's extension
 * from the client-supplied filename — a caller could request `.html` and
 * plant stored XSS on this origin, or reach outside the uploads directory
 * entirely with a crafted name). The extension now comes only from an
 * allowlisted MIME type, and the filename is server-generated.
 */
export async function POST(req: NextRequest) {
  try {
    const candidate = await requireCandidate();

    const rl = checkRateLimit(req, 'media-upload', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many uploads this hour.' }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'File is too large (150MB limit).' }, { status: 413 });
    }

    const ext = extensionForMime(file.type, 'media');
    if (!ext) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}.` }, { status: 415 });
    }

    ensureUploadsDir();
    const filename = randomUploadFilename('rec', ext);
    const absPath = safeUploadPath(filename);
    if (!absPath) {
      return NextResponse.json({ error: 'Could not resolve a safe storage path.' }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    fs.writeFileSync(absPath, Buffer.from(bytes));
    db.recordUploadOwner({
      filename,
      candidate_id: candidate.candidateId,
      school_id: candidate.schoolId,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      url: mediaUrlFor(filename),
      filename,
      size: bytes.byteLength,
      candidate_id: candidate.candidateId
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to upload media file' }, { status: 500 });
  }
}
