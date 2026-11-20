import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireCandidate } from '@/lib/auth';
import { db } from '@/lib/db';
import { ensureUploadsDir, extensionForMime, mediaUrlFor, randomUploadFilename, safeUploadPath, UPLOADS_DIR } from '@/lib/uploads';
import { checkRateLimit } from '@/lib/rateLimit';
import { CHUNK_MAX_BYTES, MAX_CHUNKS, chunkDirFor, joinChunks, receivedChunks, safePart, saveChunk } from '@/lib/chunkedUpload';

/**
 * One piece of a large recording. Same rules as /api/upload (a signed-in
 * candidate, an allowlisted type, a server-made file name); the last piece
 * joins them and answers with the file's address, exactly as /api/upload does.
 */
export async function POST(req: NextRequest) {
  try {
    const candidate = await requireCandidate();
    const rl = checkRateLimit(req, 'media-upload-chunk', { max: 400, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many uploads this hour.' }, { status: 429 });

    const form = await req.formData();
    const piece = form.get('chunk') as File | null;
    const uploadId = safePart(form.get('upload_id'));
    const index = Number(form.get('index'));
    const total = Number(form.get('total'));
    const mime = String(form.get('mime') || '');

    if (!piece || !uploadId || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > MAX_CHUNKS || index < 0 || index >= total) {
      return NextResponse.json({ error: 'That upload piece was not in the right form.' }, { status: 400 });
    }
    if (piece.size > CHUNK_MAX_BYTES) return NextResponse.json({ error: 'That upload piece is too large.' }, { status: 413 });
    const ext = extensionForMime(mime, 'media');
    if (!ext) return NextResponse.json({ error: `Unsupported file type: ${mime || 'unknown'}.` }, { status: 415 });
    const owner = safePart(candidate.candidateId);
    if (!owner) return NextResponse.json({ error: 'Could not store this recording.' }, { status: 500 });

    ensureUploadsDir();
    const dir = chunkDirFor(UPLOADS_DIR, owner, uploadId);
    saveChunk(dir, index, Buffer.from(await piece.arrayBuffer()));

    if (receivedChunks(dir).length < total) return NextResponse.json({ success: true, done: false, received: receivedChunks(dir).length });

    const filename = randomUploadFilename('rec', ext);
    const absPath = safeUploadPath(filename);
    if (!absPath) return NextResponse.json({ error: 'Could not resolve a safe storage path.' }, { status: 500 });
    const joined = joinChunks(dir, total, absPath);
    if (!joined.ok) return NextResponse.json({ error: joined.error }, { status: 400 });

    db.recordUploadOwner({ filename, candidate_id: candidate.candidateId, school_id: candidate.schoolId, created_at: new Date().toISOString() });
    return NextResponse.json({ success: true, done: true, url: mediaUrlFor(filename), filename, size: joined.size, candidate_id: candidate.candidateId });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to upload this part of the recording.' }, { status: 500 });
  }
}
