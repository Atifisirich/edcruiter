import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { roleHome } from '@/lib/postLogin';

/**
 * Who is signed in, even if they do not belong to a school yet. /api/auth/me
 * answers only for people who do. The school setup page uses this to show which
 * account it is about to create a school for, and to send an existing member
 * to their own workspace instead of a setup form.
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session?.email) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  const user = db.getUserByEmail(session.email);
  return NextResponse.json({
    email: session.email,
    name: user?.name || session.name,
    linked: Boolean(user),
    home: user ? roleHome(user.role) : null,
  });
}
