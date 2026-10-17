import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, requireSchoolAccess } from '@/lib/auth';

/**
 * Read-only status check. Setting up a number now goes through the wizard:
 * POST /api/whatsapp/credentials (save) → POST /api/whatsapp/verify (confirm
 * with Meta) → POST /api/whatsapp/test-send (prove a message actually lands).
 * This route stays as the cheap "what's our current state" call the admin
 * page polls, and never accepts unverified self-reported status again — the
 * old PUT here let the form set status: 'number_saved' / 'api_connected'
 * with nothing behind it.
 */
export async function GET(req: NextRequest) {
  try {
    const schoolId = new URL(req.url).searchParams.get('school_id');
    const ctx = await requireSchoolAccess(schoolId);
    const school = db.getSchoolById(ctx.schoolId);
    if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });
    // token_encrypted must never leave the server.
    const { token_encrypted: _token_encrypted, ...safe } = school.whatsapp_hiring || {};
    return NextResponse.json({ whatsapp_hiring: school.whatsapp_hiring ? safe : null, school_name: school.name });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load WhatsApp status' }, { status: 500 });
  }
}
