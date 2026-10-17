import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encryptSecret } from '@/lib/secrets';
import { formatWhatsAppDisplay, toWhatsAppE164 } from '@/lib/whatsapp';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';

/**
 * Step 2–3 of the connect wizard: a school admin pastes their Phone number
 * ID, WhatsApp Business Account ID, and System User token. The token is
 * encrypted before it touches the data file and is never echoed back in any
 * response — see src/lib/secrets.ts.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });

    const provider: 'platform_shared' | 'school_waba' = body.provider === 'school_waba' ? 'school_waba' : 'platform_shared';

    if (provider === 'platform_shared') {
      const school = db.updateSchool(ctx.schoolId, {
        whatsapp_hiring: {
          display_number: formatWhatsAppDisplay(process.env.WHATSAPP_PLATFORM_DISPLAY_E164 || ''),
          e164: process.env.WHATSAPP_PLATFORM_DISPLAY_E164 || '',
          display_name: (body.display_name || 'Edcruiter').trim(),
          provider: 'platform_shared',
          status: 'credentials_saved',
          saved_at: new Date().toISOString()
        }
      });
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'WHATSAPP_CREDENTIALS_SAVED',
        resource: 'WhatsApp: platform shared number',
        details: 'Switched to the platform-shared sending number.'
      });
      return NextResponse.json({ whatsapp_hiring: school?.whatsapp_hiring });
    }

    const { phone_number_id, waba_id, token, display_number, display_name } = body;
    if (!phone_number_id || !waba_id || !token) {
      return NextResponse.json({ error: 'phone_number_id, waba_id and token are all required.' }, { status: 400 });
    }

    const e164 = toWhatsAppE164(display_number || '') || '';
    const school = db.updateSchool(ctx.schoolId, {
      whatsapp_hiring: {
        display_number: e164 ? formatWhatsAppDisplay(e164) : (display_number || ''),
        e164,
        display_name: (display_name || 'School hiring').trim(),
        provider: 'school_waba',
        waba_id,
        phone_number_id,
        token_encrypted: encryptSecret(token),
        status: 'credentials_saved',
        saved_at: new Date().toISOString()
      }
    });

    if (!school) {
      return NextResponse.json({ error: 'School not found.' }, { status: 404 });
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'WHATSAPP_CREDENTIALS_SAVED',
      resource: `WhatsApp: ${phone_number_id}`,
      details: 'Saved school-owned WhatsApp Business Account credentials.'
    });

    // Never echo the token back, even encrypted.
    const { whatsapp_hiring } = school;
    return NextResponse.json({
      whatsapp_hiring: whatsapp_hiring ? { ...whatsapp_hiring, token_encrypted: undefined } : undefined
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to save WhatsApp credentials' }, { status: 500 });
  }
}
