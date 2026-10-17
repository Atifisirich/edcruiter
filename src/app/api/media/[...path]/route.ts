import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { findMediaOwner, safeUploadPath, UPLOADS_URL_PREFIX } from '@/lib/uploads';
import { requireCandidateOrStaff } from '@/lib/auth';

const CONTENT_TYPES: Record<string, string> = {
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  png: 'image/png',
  jpg: 'image/jpeg',
  pdf: 'application/pdf'
};

/**
 * Serves candidate media (resumes, interview recordings) only to the
 * candidate it belongs to or staff at that candidate's school. Replaces
 * public/uploads/, which Next served to anyone with the URL.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filename = segments.join('/');
  const urlPath = `${UPLOADS_URL_PREFIX}${filename}`;

  const owner = findMediaOwner(urlPath);
  if (!owner) {
    // No record references this filename — either it never existed or it was
    // never attached to a candidate. Either way, nothing to authorize against.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await requireCandidateOrStaff(owner.candidateId);
  } catch {
    return NextResponse.json({ error: 'Not authorized to view this file.' }, { status: 403 });
  }

  const absPath = safeUploadPath(filename);
  if (!absPath || !fs.existsSync(absPath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const data = fs.readFileSync(absPath);

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
