import type { School } from './types';

/**
 * A school that signed itself up starts as 'onboarding' and is switched to
 * 'active' by the platform owner. Until then it can set itself up (campuses,
 * policies, vacancies) but nothing that spends money or reaches the public:
 * AI generation and scoring, WhatsApp/email sends, and public applications.
 */
export function schoolBlockReason(status: School['status'] | undefined): string | null {
  if (status === 'active') return null;
  if (status === 'suspended') return 'This school has been suspended. Contact Edcruiter support.';
  return 'Your school is waiting for approval from Edcruiter. This feature unlocks as soon as it is approved.';
}

/**
 * The full rule for using the product: the school must be approved and, once it
 * has a billing record, on a plan that has not ended. Schools with no billing
 * record predate plans and stay open.
 */
export function workspaceBlockReason(school: School | undefined, now: number = Date.now()): string | null {
  if (!school) return 'School not found.';
  const statusReason = schoolBlockReason(school.status);
  if (statusReason) return statusReason;

  const billing = school.billing;
  if (!billing) return null;
  if (billing.plan === 'none') {
    return 'Your school is approved but has no active plan yet. Choose a plan to unlock this feature.';
  }
  if (billing.valid_until && Date.parse(billing.valid_until) < now) {
    const ended = new Date(billing.valid_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `Your plan ended on ${ended}. Renew it to keep using this feature.`;
  }
  return null;
}

// Fields a school admin may never change on their own school. `status` is the
// approval switch itself, `billing` is what they have paid for, and the others
// are identity or have their own guarded routes (WhatsApp credentials go
// through /api/whatsapp/*).
const PROTECTED_SCHOOL_FIELDS = ['id', 'status', 'billing', 'created_at', 'whatsapp_hiring', 'roles', 'seat_limits', 'policy_video', 'policy_questions', 'hr_can_edit_policies', 'screening_call', 'screening_call_price_per_min_inr', 'screening_call_owner_cap_inr', 'screening_call_state', 'offer_letter_templates'] as const;

export function stripProtectedSchoolFields(
  updates: Record<string, unknown>,
  isSuperAdmin: boolean
): Record<string, unknown> {
  // The Google Calendar connection is only ever set by its own connect and disconnect routes.
  const rest: Record<string, unknown> = { ...updates };
  delete rest.google_calendar;
  if (isSuperAdmin) return { ...rest };
  const clean: Record<string, unknown> = { ...rest };
  for (const key of PROTECTED_SCHOOL_FIELDS) delete clean[key];
  return clean;
}

/** A school as it may be sent to a browser: the Google permission never leaves the server. */
export function schoolForClient<T extends { google_calendar?: { refresh_token_encrypted?: string } }>(school: T): T {
  if (!school.google_calendar) return school;
  const safe: { refresh_token_encrypted?: string } = { ...school.google_calendar };
  delete safe.refresh_token_encrypted;
  return { ...school, google_calendar: safe };
}
