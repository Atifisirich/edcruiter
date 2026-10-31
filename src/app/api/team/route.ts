import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authErrorResponse, auditAsStaff, requireSchoolAccess } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { emailIsConfigured } from '@/lib/emailClient';
import { sendSetPasswordEmail } from '@/lib/accountEmails';
import { MAX_TEAM_SIZE, memberStatus, parseTeamInput, removalProblem, roleChangeProblem, ROLE_LABEL } from '@/lib/team';
import type { User } from '@/lib/types';

/**
 * A school's own team: the people who can sign in to its workspace. Admin only.
 * Adding someone creates their membership straight away, so they can sign in
 * with Google using that email, and emails them a link to choose a password if
 * they would rather do that. Access follows the membership, so removing someone
 * ends their access on their very next request.
 */

function present(user: User, actorId: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: memberStatus(user),
    invited_at: user.invited_at ?? null,
    last_login_at: user.last_login_at ?? null,
    is_you: user.id === actorId,
  };
}

function schoolIdParam(req: NextRequest) {
  return new URL(req.url).searchParams.get('school_id');
}

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const members = db.getUsersBySchool(ctx.schoolId).map((u) => present(u, ctx.user.id));
    return NextResponse.json({ members, max: MAX_TEAM_SIZE, emailReady: emailIsConfigured() });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not load your team.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const rl = checkRateLimit(req, 'team-invite', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) return NextResponse.json({ error: 'Too many invitations this hour. Try again later.' }, { status: 429 });

    const parsed = parseTeamInput(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { name, email, role } = parsed.value;

    const members = db.getUsersBySchool(ctx.schoolId);
    if (members.length >= MAX_TEAM_SIZE) {
      return NextResponse.json({ error: `A school can have up to ${MAX_TEAM_SIZE} team members.` }, { status: 400 });
    }
    if (db.getUserByEmail(email)) {
      return NextResponse.json(
        { error: 'That email already has an Edcruiter login, here or at another school. Use a different email address.' },
        { status: 409 }
      );
    }

    const school = db.getSchoolById(ctx.schoolId);
    const member = db.createUser({
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: ctx.schoolId,
      name,
      email,
      role,
      invited_at: new Date().toISOString(),
      invited_by: ctx.user.id,
    });
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'TEAM_MEMBER_ADDED',
      resource: `User: ${name} <${email}>`,
      details: `Added ${name} as ${ROLE_LABEL[role]}.`,
    });

    const sent = await sendSetPasswordEmail({
      to: email,
      name,
      kind: 'invite',
      schoolName: school?.name,
      inviterName: ctx.user.name,
    });
    return NextResponse.json(
      { member: present(member, ctx.user.id), emailSent: sent.ok, devLink: sent.ok ? undefined : sent.devLink },
      { status: 201 }
    );
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not add that person.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const body = await req.json().catch(() => null);
    const members = db.getUsersBySchool(ctx.schoolId);
    const target = members.find((m) => m.id === body?.id);
    if (!target) return NextResponse.json({ error: 'That person is not on your team.' }, { status: 404 });

    if (body?.resend === true) {
      if (memberStatus(target) !== 'invited') {
        return NextResponse.json({ error: 'They have already signed in.' }, { status: 400 });
      }
      const rl = checkRateLimit(req, 'team-invite', { max: 30, windowMs: 60 * 60_000 });
      if (!rl.allowed) return NextResponse.json({ error: 'Too many invitations this hour. Try again later.' }, { status: 429 });
      const sent = await sendSetPasswordEmail({
        to: target.email,
        name: target.name,
        kind: 'invite',
        schoolName: db.getSchoolById(ctx.schoolId)?.name,
        inviterName: ctx.user.name,
      });
      return NextResponse.json({ emailSent: sent.ok, devLink: sent.ok ? undefined : sent.devLink });
    }

    if (typeof body?.role === 'string' && body.role !== target.role) {
      const problem = roleChangeProblem(members, target, body.role);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      const updated = db.updateUser(target.id, { role: body.role });
      auditAsStaff(ctx, ctx.schoolId, {
        action: 'TEAM_ROLE_CHANGED',
        resource: `User: ${target.name} <${target.email}>`,
        details: `Changed role from ${ROLE_LABEL[target.role]} to ${ROLE_LABEL[body.role]}.`,
      });
      return NextResponse.json({ member: present(updated ?? target, ctx.user.id) });
    }

    return NextResponse.json({ member: present(target, ctx.user.id) });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not update that person.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireSchoolAccess(schoolIdParam(req), { minRole: 'SCHOOL_ADMIN' });
    const id = new URL(req.url).searchParams.get('id');
    const members = db.getUsersBySchool(ctx.schoolId);
    const target = members.find((m) => m.id === id);
    if (!target) return NextResponse.json({ error: 'That person is not on your team.' }, { status: 404 });

    const problem = removalProblem(members, target, ctx.user.id);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    db.deleteUser(target.id);
    auditAsStaff(ctx, ctx.schoolId, {
      action: 'TEAM_MEMBER_REMOVED',
      resource: `User: ${target.name} <${target.email}>`,
      details: `Removed ${target.name} (${ROLE_LABEL[target.role]}) from the team.`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Could not remove that person.' }, { status: 500 });
  }
}
