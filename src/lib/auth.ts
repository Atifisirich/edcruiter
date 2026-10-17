import { NextResponse } from 'next/server';
import { db } from './db';
import { getCandidateSession, getSessionUser } from './session';
import { User, UserRole } from './types';

/**
 * Authorization for API routes.
 *
 * Two distinct principals reach this app:
 *   - Staff  — signed in with Google, matched to a `User` record by email.
 *   - Candidates — issued a scoped cookie at login, able to see only themselves.
 *
 * Route handlers must call `requireStaff` or `requireCandidate` before touching
 * the database. `proxy.ts` gates page navigation, but it is a convenience for
 * humans, not a security boundary — every API route enforces its own access.
 */

/** Higher number wins. Used only for "at least this role" checks. */
const ROLE_RANK: Record<UserRole, number> = {
  REPORTING_MANAGER: 1,
  INSTITUTE_HEAD: 2,
  FINAL_DECISION_MAKER: 3,
  SCHOOL_ADMIN: 4,
  SUPER_ADMIN: 5
};

export type StaffContext = {
  user: User;
  /** null only for SUPER_ADMIN, who is not scoped to one tenant. */
  schoolId: string | null;
  role: UserRole;
  isSuperAdmin: boolean;
};

export type CandidateContext = {
  candidateId: string;
  schoolId: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Converts an AuthError into a response. Any other error is re-thrown so real
 * bugs still surface as 500s rather than being disguised as access failures.
 */
export function authErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export type NewSignupContext = {
  email: string;
  name: string;
};

/**
 * For self-serve tenant creation only: a signed-in Google session with no
 * existing User record. POST /api/schools uses this to let a first-time
 * visitor provision exactly one school and become its admin in the same
 * request. Anyone who already has a User record — any role, any school —
 * is not eligible here; this is first-time provisioning, not a way for an
 * existing school admin to spin up additional tenants through this route.
 */
export async function requireNewSignup(): Promise<NewSignupContext> {
  const session = await getSessionUser();
  if (!session?.email) {
    throw new AuthError('Sign in with Google to create a school.', 401);
  }
  if (db.getUserByEmail(session.email)) {
    throw new AuthError('This account is already linked to a school.', 403);
  }
  return { email: session.email, name: session.name || session.email };
}

/** Resolves the signed-in staff member, or null when not signed in / not a known user. */
export async function getStaffContext(): Promise<StaffContext | null> {
  const session = await getSessionUser();
  if (!session?.email) return null;

  const user = db.getUserByEmail(session.email);
  if (!user) return null;

  return {
    user,
    schoolId: user.school_id,
    role: user.role,
    isSuperAdmin: user.role === 'SUPER_ADMIN'
  };
}

/**
 * Requires a signed-in staff member, optionally of a minimum role or one of a
 * specific set. Throws `AuthError`, which route handlers turn into a response.
 */
export async function requireStaff(options?: {
  minRole?: UserRole;
  anyOf?: UserRole[];
}): Promise<StaffContext> {
  const ctx = await getStaffContext();
  if (!ctx) {
    throw new AuthError('Sign in to continue.', 401);
  }

  if (options?.anyOf && !options.anyOf.includes(ctx.role)) {
    throw new AuthError('Your role does not have access to this resource.', 403);
  }

  if (options?.minRole && ROLE_RANK[ctx.role] < ROLE_RANK[options.minRole]) {
    throw new AuthError('Your role does not have access to this resource.', 403);
  }

  return ctx;
}

/**
 * Resolves which school a staff request may act on.
 *
 * Ordinary staff are pinned to their own school and any `school_id` supplied by
 * the client is ignored — that parameter was previously the only thing standing
 * between one school and every other school's candidates. Only a super admin may
 * name a tenant, and must name one explicitly for tenant-scoped reads.
 */
export function resolveSchoolId(ctx: StaffContext, requested?: string | null): string {
  if (!ctx.isSuperAdmin) {
    if (!ctx.schoolId) {
      throw new AuthError('Your account is not linked to a school.', 403);
    }
    return ctx.schoolId;
  }

  const wanted = requested?.trim();
  if (!wanted) {
    throw new AuthError('school_id is required for platform administrators.', 403);
  }
  return wanted;
}

/** Requires staff who may act on `schoolId` specifically. */
export async function requireSchoolAccess(
  requested: string | null | undefined,
  options?: { minRole?: UserRole; anyOf?: UserRole[] }
): Promise<StaffContext & { schoolId: string }> {
  const ctx = await requireStaff(options);
  const schoolId = resolveSchoolId(ctx, requested);
  return { ...ctx, schoolId };
}

/** Requires a signed-in candidate. Optionally asserts it is a specific candidate. */
export async function requireCandidate(candidateId?: string): Promise<CandidateContext> {
  const session = await getCandidateSession();
  if (!session) {
    throw new AuthError('Sign in to continue your application.', 401);
  }

  if (candidateId && session.cid !== candidateId) {
    throw new AuthError('You can only access your own application.', 403);
  }

  return { candidateId: session.cid, schoolId: session.school_id };
}

/**
 * Allows either the candidate themselves or staff at the owning school.
 * Used by routes the candidate portal and the reviewer console share.
 */
export async function requireCandidateOrStaff(candidateId: string): Promise<
  { kind: 'candidate'; schoolId: string } | { kind: 'staff'; ctx: StaffContext; schoolId: string }
> {
  const candidateSession = await getCandidateSession();
  if (candidateSession?.cid === candidateId) {
    return { kind: 'candidate', schoolId: candidateSession.school_id };
  }

  const staff = await getStaffContext();
  if (staff) {
    const candidate = db.getCandidateByIdPublic(candidateId);
    if (!candidate) {
      throw new AuthError('Candidate not found.', 403);
    }
    if (!staff.isSuperAdmin && staff.schoolId !== candidate.school_id) {
      throw new AuthError('That candidate belongs to another school.', 403);
    }
    return { kind: 'staff', ctx: staff, schoolId: candidate.school_id };
  }

  throw new AuthError('Sign in to continue.', 401);
}

/**
 * Writes an audit entry attributed to the principal that actually performed the
 * action. The previous hardcoded actor ids made the trail unusable as evidence.
 */
export function auditAsStaff(
  ctx: StaffContext,
  schoolId: string,
  entry: { action: string; resource: string; details: string }
) {
  db.addAuditLog({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    school_id: schoolId,
    actor_id: ctx.user.id,
    actor_name: ctx.user.name,
    actor_role: ctx.role,
    action: entry.action,
    resource: entry.resource,
    details: entry.details,
    timestamp: new Date().toISOString()
  });
}
