/**
 * "Not responding": candidates HR (or the admin) set aside because they never
 * answer: no reply, no pick-up, never started the test. They leave the main
 * list, its tabs and counts, and the dashboard, and nothing automatic (AI
 * calls, retries, the test link sent after a wait) goes to them. Nothing is
 * deleted: they can be opened, and moved back in one click. Pure, so the rules
 * are tested without a page or a server.
 */

import type { Candidate, NotResponding } from './types';

export const MAX_SET_ASIDE_PER_REQUEST = 500;

export function isNotResponding(c: Pick<Candidate, 'not_responding'> | null | undefined): boolean {
  return !!c?.not_responding;
}

/** Why this candidate cannot be set aside, or null when they can. */
export function setAsideProblem(c: Pick<Candidate, 'not_responding' | 'status' | 'selected_at' | 'lead'>): string | null {
  if (c.lead && c.lead.status !== 'moved') return 'They are on a lead list. Manage them there.';
  if (c.status === 'hired' || c.selected_at) return 'They are already selected.';
  if (isNotResponding(c)) return 'Already in Not responding.';
  return null;
}

/** The change that moves a candidate to Not responding, recording who did it and when. */
export function setAside(actor: { id: string; name: string }, nowIso: string = new Date().toISOString()): { not_responding: NotResponding } {
  return { not_responding: { at: nowIso, by_id: actor.id, by_name: actor.name } };
}

/** The change that moves them back to the main list. */
export function moveBack(): { not_responding: null } {
  return { not_responding: null };
}

/** How the school could still reach them, for the Not responding list. */
export interface Reach {
  phone: boolean;
  whatsapp: boolean;
  email: boolean;
}

const realEmail = (e: string | undefined) => !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !e.endsWith('.local');
const realPhone = (p: string | undefined) => (p ?? '').replace(/\D/g, '').length >= 10;

export function reachOf(c: Pick<Candidate, 'phone' | 'email'>, whatsappConsent: boolean): Reach {
  const phone = realPhone(c.phone);
  return { phone, whatsapp: phone && whatsappConsent, email: realEmail(c.email) };
}

/** "Phone · WhatsApp · Email", "Phone only", or "No way to reach them". */
export function reachText(r: Reach): string {
  const ways = [r.phone && 'Phone', r.whatsapp && 'WhatsApp', r.email && 'Email'].filter(Boolean) as string[];
  if (!ways.length) return 'No way to reach them';
  if (ways.length === 1) return `${ways[0]} only`;
  return ways.join(' · ');
}
