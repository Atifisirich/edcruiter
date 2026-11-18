import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { expectedChunkBytes, MAX_VIDEO_BYTES, VIDEO_CHUNK_BYTES, videoMime } from '@/lib/policyVideo';
import { finishUpload, getUpload, removeVideoFiles, savePiece, startUpload } from '@/lib/policyVideoStore';

/**
 * Uploading the school's policy video, in 8 MB pieces (the live server takes
 * about 30 MB per request at most). School admin only.
 *
 *   POST {action:'start', title, size, type}  -> { upload_id, chunk_size, chunks }
 *   PUT  ?upload_id=…&index=n  (the piece's bytes as the body)
 *   POST {action:'finish', upload_id}         -> { video }
 */

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const body = await req.json().catch(() => null);

    if (body?.action === 'start') {
      const rl = checkRateLimit(req, 'policy-video-start', { max: 10, windowMs: 60 * 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many uploads this hour. Try again later.' }, { status: 429 });
      const mime = videoMime(body.type);
      if (!mime) return NextResponse.json({ error: 'Upload an MP4, WebM or MOV video.' }, { status: 415 });
      const size = Number(body.size);
      if (!Number.isInteger(size) || size <= 0) return NextResponse.json({ error: 'The video file is empty.' }, { status: 400 });
      if (size > MAX_VIDEO_BYTES) return NextResponse.json({ error: 'The video is larger than 2 GB. Please export a smaller copy.' }, { status: 413 });
      const title = (typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : '').slice(0, 120) || 'Our school policies';
      const session = startUpload({ schoolId: ctx.schoolId, title, mime, size, by: ctx.user.name });
      return NextResponse.json({ upload_id: session.id, chunk_size: VIDEO_CHUNK_BYTES, chunks: session.chunks });
    }

    if (body?.action === 'finish') {
      const session = typeof body.upload_id === 'string' ? getUpload(body.upload_id) : undefined;
      if (!session || session.schoolId !== ctx.schoolId) {
        return NextResponse.json({ error: 'This upload has expired. Please upload the video again.' }, { status: 404 });
      }
      const missing = session.chunks - session.received.size;
      const video = finishUpload(session);
      if (!video) return NextResponse.json({ error: `${missing} part${missing === 1 ? '' : 's'} of the video did not arrive. Please try again.` }, { status: 409 });

      const school = db.getSchoolById(ctx.schoolId);
      const previous = school?.policy_video;
      db.updateSchool(ctx.schoolId, { policy_video: video });
      if (previous && previous.id !== video.id) removeVideoFiles(previous);
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'POLICY_VIDEO_UPLOADED',
        resource: `School: ${school?.name}`,
        details: `${previous ? 'Replaced' : 'Added'} the policy video "${video.title}" (${Math.round(video.size / 1024 / 1024)} MB).`,
      });
      return NextResponse.json({ video: { id: video.id, title: video.title, size: video.size, mime: video.mime, uploaded_at: video.uploaded_at, uploaded_by: video.uploaded_by } });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not upload the video.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const url = new URL(req.url);
    const session = getUpload(url.searchParams.get('upload_id') || '');
    if (!session || session.schoolId !== ctx.schoolId) {
      return NextResponse.json({ error: 'This upload has expired. Please upload the video again.' }, { status: 404 });
    }
    const index = Number(url.searchParams.get('index'));
    if (!Number.isInteger(index) || index < 0 || index >= session.chunks) {
      return NextResponse.json({ error: 'Unknown part of the video.' }, { status: 400 });
    }
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength !== expectedChunkBytes(session.size, index)) {
      return NextResponse.json({ error: 'A part of the video arrived damaged. Please try again.' }, { status: 400 });
    }
    await savePiece(session, index, bytes);
    return NextResponse.json({ ok: true, received: session.received.size, chunks: session.chunks });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not save that part of the video.' }, { status: 500 });
  }
}
