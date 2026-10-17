import { redirect } from 'next/navigation';

/**
 * This page never called a real auth endpoint — its form just faked a delay
 * and redirected regardless of input. The real, working sign-in is /login
 * ("Continue with Google" -> /api/auth/google). Redirect rather than 404 so
 * any bookmarked or indexed link still lands somewhere real.
 */
export default function SchoolLoginRedirect() {
  redirect('/login');
}
