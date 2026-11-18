import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { AuthError, authErrorResponse, requireCandidate, requireSchoolAccess } from '@/lib/auth';
import { parseRange } from '@/lib/policyVideo';
import { streamVideoBytes } from '@/lib/policyVideoStore';

/**
 * Plays the school's policy video: to that school's candidates and staff only.
 * Answers the browser's byte-range requests (how video players load and seek),
 * reading only the stored pieces it needs.
 *
 *   GET ?school_id=…&v=<video id>
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const schoolId = url.searchParams.get('school_id') || '';
    try {
      const candidate = await requireCandidate();
      if (candidate.schoolId !== schoolId) throw new AuthError('Not your school.', 403);
    } catch {
      await requireSchoolAccess(schoolId);
    }

    const video = db.getSchoolById(schoolId)?.policy_video;
    // The id in the link must be the current video, so an old link never plays a replaced one.
    if (!video || video.id !== url.searchParams.get('v')) {
      return NextResponse.json({ error: 'Video not found.' }, { status: 404 });
    }

    const headers: Record<string, string> = {
      'Content-Type': video.mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    };

    const range = parseRange(req.headers.get('range'), video.size);
    if (range === 'unsatisfiable') {
      return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${video.size}` } });
    }
    const start = range ? range.start : 0;
    const end = range ? range.end : video.size - 1;
    const body = streamVideoBytes(video, start, end);
    return new NextResponse(body, {
      status: range ? 206 : 200,
      headers: {
        ...headers,
        'Content-Length': String(end - start + 1),
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${video.size}` } : {}),
      },
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not play the video.' }, { status: 500 });
  }
}
