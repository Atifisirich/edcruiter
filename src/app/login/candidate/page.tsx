import { redirect } from 'next/navigation';

/**
 * This page never called a real auth endpoint — its "quick sign in" list
 * just routed to /teacher regardless of which candidate was clicked. The
 * real candidate sign-in is /candidate/login (identifier + invite code).
 * Redirect rather than 404 so any bookmarked or indexed link still lands
 * somewhere real.
 */
export default function CandidateLoginRedirect() {
  redirect('/candidate/login');
}
