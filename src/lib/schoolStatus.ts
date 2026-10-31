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
const PROTECTED_SCHOOL_FIELDS = ['id', 'status', 'billing', 'created_at', 'whatsapp_hiring', 'roles'] as const;

export function stripProtectedSchoolFields(
  updates: Record<string, unknown>,
  isSuperAdmin: boolean
): Record<string, unknown> {
  if (isSuperAdmin) return { ...updates };
  const clean: Record<string, unknown> = { ...updates };
  for (const key of PROTECTED_SCHOOL_FIELDS) delete clean[key];
  return clean;
}
