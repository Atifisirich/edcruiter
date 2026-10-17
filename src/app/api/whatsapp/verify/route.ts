import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveCredentials, verifyPhoneNumber, WhatsAppConfigError } from '@/lib/whatsappClient';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';

/**
 * Step 4 of the connect wizard: calls the Graph API's own phone-number
 * lookup so status reflects what Meta actually reports (quality rating,
 * verified display name), not what the admin typed into a form.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const school = db.getSchoolById(ctx.schoolId);
    if (!school?.whatsapp_hiring) {
      return NextResponse.json({ error: 'Save WhatsApp credentials before verifying.' }, { status: 400 });
    }

    let creds;
    try {
      creds = resolveCredentials(school);
    } catch (e) {
      return NextResponse.json({ error: e instanceof WhatsAppConfigError ? e.message : 'Not configured.' }, { status: 400 });
    }

    const result = await verifyPhoneNumber(creds);

    if (!result.ok) {
      db.updateSchool(ctx.schoolId, {
        whatsapp_hiring: {
          ...school.whatsapp_hiring,
          last_error: { code: 0, title: result.detail, at: new Date().toISOString() }
        }
      });
      return NextResponse.json({ ok: false, error: result.detail }, { status: 502 });
    }

    const updated = db.updateSchool(ctx.schoolId, {
      whatsapp_hiring: {
        ...school.whatsapp_hiring,
        status: 'verified',
        quality_rating: (result.qualityRating as 'GREEN' | 'YELLOW' | 'RED' | undefined) || 'UNKNOWN',
        verified_at: new Date().toISOString(),
        last_error: undefined
      }
    });

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'WHATSAPP_VERIFIED',
      resource: `WhatsApp: ${result.verifiedName || result.displayName}`,
      details: `Quality rating ${result.qualityRating}.`
    });

    return NextResponse.json({ ok: true, whatsapp_hiring: updated?.whatsapp_hiring });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to verify WhatsApp number' }, { status: 500 });
  }
}
