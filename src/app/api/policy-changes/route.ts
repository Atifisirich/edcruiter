import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditAsStaff, authErrorResponse, requireSchoolAccess, requireStaff, assertSchoolActive } from '@/lib/auth';
import { accessOf, isAdmin } from '@/lib/permissions';
import { MAX_PENDING_PER_PERSON, applyChange, cleanProposal, summarise } from '@/lib/policyChanges';
import type { PolicyChangeRequest } from '@/lib/types';

/**
 * HR's proposed changes to the school policies, and the school admin's say on
 * them. GET lists them (the admin sees all, HR sees their own). POST does the
 * rest, by action: set_access (admin), propose (HR), decide (admin), withdraw (HR).
 */

const newId = () => `pchg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
const note = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 300) : '');

export async function GET(req: NextRequest) {
  try {
    const schoolId = new URL(req.url).searchParams.get('school_id');
    const ctx = await requireSchoolAccess(schoolId);
    const school = db.getSchoolById(ctx.schoolId);
    const admin = isAdmin(ctx.role);
    const hr = accessOf(ctx.role) === 'hr';
    const all = db.getPolicyChanges(ctx.schoolId);
    const requests = admin ? all : hr ? all.filter((r) => r.requested_by.id === ctx.user.id) : [];
    const ordered = [...requests].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.requested_at.localeCompare(a.requested_at)).slice(0, 40);
    return NextResponse.json({ hr_can_edit: school?.hr_can_edit_policies === true, can_review: admin, is_hr: hr, requests: ordered });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load policy changes.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : '';
    const ctx = await requireStaff();
    const schoolId = typeof body.school_id === 'string' ? body.school_id : ctx.schoolId;
    const scoped = await requireSchoolAccess(schoolId);
    assertSchoolActive(scoped.schoolId);
    const school = db.getSchoolById(scoped.schoolId);
    const admin = isAdmin(scoped.role);
    const hr = accessOf(scoped.role) === 'hr';
    const who = { id: scoped.user.id, name: scoped.user.name };

    // The school admin switches HR's right to propose on or off.
    if (action === 'set_access') {
      if (!admin) return NextResponse.json({ error: 'Only the school admin can change this.' }, { status: 403 });
      const enabled = body.enabled === true;
      db.updateSchool(scoped.schoolId, { hr_can_edit_policies: enabled });
      auditAsStaff(scoped, scoped.schoolId, { action: 'POLICY_HR_ACCESS_CHANGED', resource: `School: ${school?.name ?? scoped.schoolId}`, details: enabled ? 'HR may now propose policy changes.' : 'HR may no longer propose policy changes.' });
      return NextResponse.json({ hr_can_edit: enabled });
    }

    if (action === 'propose') {
      if (!hr) return NextResponse.json({ error: admin ? 'You can edit the policies directly.' : 'Only HR can propose policy changes.' }, { status: 403 });
      if (school?.hr_can_edit_policies !== true) return NextResponse.json({ error: 'Your school admin has not allowed HR to edit the policies. Ask them to switch it on.' }, { status: 403 });
      const mine = db.getPolicyChanges(scoped.schoolId).filter((r) => r.requested_by.id === who.id && r.status === 'pending');
      if (mine.length >= MAX_PENDING_PER_PERSON) return NextResponse.json({ error: 'You already have many changes waiting. Ask the admin to decide on them first.' }, { status: 429 });

      const cleaned = cleanProposal(body.kind, body.payload);
      if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

      let existing: { title: string; content: string; required: boolean } | undefined;
      if (cleaned.kind === 'document_update' || cleaned.kind === 'document_delete') {
        const doc = db.getHRPoliciesBySchool(scoped.schoolId).find((p) => p.id === cleaned.payload.id);
        if (!doc) return NextResponse.json({ error: 'That policy no longer exists. Refresh the page.' }, { status: 404 });
        existing = { title: doc.title, content: doc.content, required: doc.required !== false };
      }
      const request: PolicyChangeRequest = {
        id: newId(),
        school_id: scoped.schoolId,
        kind: cleaned.kind,
        summary: summarise(cleaned.kind, cleaned.payload, existing),
        payload: cleaned.payload,
        ...(existing ? { before: existing } : {}),
        requested_by: who,
        requested_at: new Date().toISOString(),
        status: 'pending',
      };
      db.addPolicyChange(request);
      auditAsStaff(scoped, scoped.schoolId, { action: 'POLICY_CHANGE_PROPOSED', resource: request.summary, details: 'Sent to the school admin for approval.' });
      return NextResponse.json({ request });
    }

    if (action === 'decide') {
      if (!admin) return NextResponse.json({ error: 'Only the school admin can approve or reject policy changes.' }, { status: 403 });
      const r = db.getPolicyChange(String(body.id || ''));
      if (!r || r.school_id !== scoped.schoolId) return NextResponse.json({ error: 'That request was not found.' }, { status: 404 });
      if (r.status !== 'pending') return NextResponse.json({ error: `That request was already ${r.status}.` }, { status: 409 });
      const approve = body.decision === 'approve';
      if (!approve && body.decision !== 'reject') return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });

      if (approve) {
        const applied = applyChange(scoped.schoolId, r);
        if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 409 });
      }
      const updated = db.updatePolicyChange(r.id, { status: approve ? 'approved' : 'rejected', decided_by: who, decided_at: new Date().toISOString(), ...(note(body.note) ? { note: note(body.note) } : {}) });
      auditAsStaff(scoped, scoped.schoolId, { action: approve ? 'POLICY_CHANGE_APPROVED' : 'POLICY_CHANGE_REJECTED', resource: r.summary, details: `${approve ? 'Approved' : 'Rejected'} a change proposed by ${r.requested_by.name}.` });
      return NextResponse.json({ request: updated });
    }

    if (action === 'withdraw') {
      const r = db.getPolicyChange(String(body.id || ''));
      if (!r || r.school_id !== scoped.schoolId || r.requested_by.id !== who.id) return NextResponse.json({ error: 'That request was not found.' }, { status: 404 });
      if (r.status !== 'pending') return NextResponse.json({ error: `That request was already ${r.status}.` }, { status: 409 });
      const updated = db.updatePolicyChange(r.id, { status: 'withdrawn', decided_at: new Date().toISOString() });
      return NextResponse.json({ request: updated });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'The policy change request failed.' }, { status: 500 });
  }
}
