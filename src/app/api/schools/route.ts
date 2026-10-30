import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { School } from '@/lib/types';
import { SLOKA_DEFAULT_STAGES } from '@/lib/defaultData';
import { formatWhatsAppDisplay, toWhatsAppE164 } from '@/lib/whatsapp';
import { authErrorResponse, auditAsStaff, requireNewSignup, requireSchoolAccess, requireStaff } from '@/lib/auth';
import { stripProtectedSchoolFields } from '@/lib/schoolStatus';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('school_id');
    const ctx = await requireStaff();

    if (schoolId) {
      if (!ctx.isSuperAdmin && ctx.schoolId !== schoolId) {
        return NextResponse.json({ error: 'That school does not belong to you.' }, { status: 403 });
      }
      const school = db.getSchoolById(schoolId);
      if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });
      return NextResponse.json({ school });
    }

    // Listing every tenant is a platform operation only.
    if (!ctx.isSuperAdmin) {
      return NextResponse.json({ error: 'Only platform administrators can list all schools.' }, { status: 403 });
    }
    return NextResponse.json({ schools: db.getSchools() });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to fetch schools' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Two ways to reach this route: a platform super admin onboarding a
    // tenant on a school's behalf, or a first-time visitor self-provisioning
    // their own school (self-serve signup). Anyone who already has a User
    // record — any role, any school — falls into neither and is rejected;
    // this route creates a tenant's *first* admin, not additional ones.
    let founderEmail: string | undefined;
    let founderName: string | undefined;
    let auditActorId = 'platform_super_admin';
    let auditActorName = 'Platform Administrator';
    let auditActorRole: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' = 'SUPER_ADMIN';

    const staffCtx = await requireStaff({ anyOf: ['SUPER_ADMIN'] }).catch(() => null);
    if (!staffCtx) {
      const signup = await requireNewSignup();
      founderEmail = signup.email;
      founderName = signup.name;
      auditActorRole = 'SCHOOL_ADMIN';
    } else {
      auditActorId = staffCtx.user.id;
      auditActorName = staffCtx.user.name;
    }

    const body = await req.json();
    const { name, code, primary_contact, branches, subjects, segments, curricula, whatsapp_number, whatsapp_display_name, shortlist_bands, hr_policy_answers } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    const wa = toWhatsAppE164(whatsapp_number || primary_contact?.phone || '');

    const newSchool: School = {
      id: `school_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      code,
      primary_contact: primary_contact || (founderEmail
        ? { name: founderName || 'Admin', email: founderEmail, phone: '' }
        : { name: 'Admin', email: 'admin@school.edu', phone: '' }),
      branches: branches || [],
      subjects: subjects || ['English', 'Math', 'Science'],
      segments: segments || ['Primary (Grades 1-5)', 'Middle School (Grades 6-8)'],
      curricula: curricula || ['CBSE'],
      stages_config: SLOKA_DEFAULT_STAGES,
      created_at: new Date().toISOString(),
      // A school that signed itself up waits for the platform owner to approve
      // it; one the platform owner creates is approved from the start.
      status: founderEmail ? 'onboarding' : 'active',
      // A self-signup has paid for nothing yet; the platform owner sets its
      // plan once payment arrives. A school the owner creates is complimentary
      // until they set a plan.
      billing: founderEmail ? { plan: 'none', updated_at: new Date().toISOString() } : undefined,
      shortlist_bands: shortlist_bands || undefined,
      hr_policy_answers: hr_policy_answers || undefined,
      whatsapp_hiring: wa
        ? {
            display_number: formatWhatsAppDisplay(wa),
            e164: wa,
            display_name: (whatsapp_display_name || name || 'School hiring').trim(),
            provider: 'platform_shared',
            status: 'credentials_saved',
            saved_at: new Date().toISOString()
          }
        : undefined
    };

    db.createSchool(newSchool);

    // Self-serve path: provision the founding visitor as this school's admin
    // in the same request. Their existing Google session resolves to this
    // User record on their very next request — no new cookie needed.
    if (founderEmail) {
      const founder = db.createUser({
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        school_id: newSchool.id,
        name: founderName || founderEmail,
        email: founderEmail,
        role: 'SCHOOL_ADMIN'
      });
      auditActorId = founder.id;
      auditActorName = founder.name;
    }

    db.addAuditLog({
      id: `audit_${Date.now()}`,
      school_id: newSchool.id,
      actor_id: auditActorId,
      actor_name: auditActorName,
      actor_role: auditActorRole,
      action: 'TENANT_CREATED',
      resource: `School: ${newSchool.name}`,
      details: founderEmail
        ? `Self-serve signup: ${founderEmail} created and now administers this school.`
        : `Onboarded new school tenant with ${newSchool.branches.length} branches.`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ school: newSchool }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to create school' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { school_id, updates } = body;
    if (!school_id) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    }

    const ctx = await requireSchoolAccess(school_id, { minRole: 'SCHOOL_ADMIN' });

    // Only the platform owner may change `status` (the approval switch) and a
    // few identity fields; a school admin sending status: 'active' used to
    // approve their own school.
    const updated = db.updateSchool(ctx.schoolId, stripProtectedSchoolFields(updates || {}, ctx.isSuperAdmin));
    if (!updated) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    auditAsStaff(ctx, ctx.schoolId, {
      action: 'TENANT_CONFIG_UPDATE',
      resource: `School: ${updated.name}`,
      details: 'Updated school configuration settings (branches, stages, rubrics).'
    });

    return NextResponse.json({ school: updated });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to update school' }, { status: 500 });
  }
}
