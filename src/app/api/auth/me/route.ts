import { NextResponse } from 'next/server';
import { authErrorResponse, requireStaff } from '@/lib/auth';

/**
 * "Who am I" for a signed-in staff member. Client code that needs to know
 * the real user recording an action — not a hardcoded placeholder, not a
 * free-text field the person types their own name into — fetches this once
 * rather than guessing. See reviewer/[role]/page.tsx's clearance flow,
 * which used to hardcode 'Head of Department (Physics)', 'Principal Dr.
 * Raman', etc. per role regardless of who was actually signed in.
 */
export async function GET() {
  try {
    const ctx = await requireStaff();
    return NextResponse.json({
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.role,
      school_id: ctx.schoolId,
    });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: 'Failed to load session' }, { status: 500 });
  }
}
