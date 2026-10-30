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

// Fields a school admin may never change on their own school. `status` is the
// approval switch itself, and the others are identity or have their own
// guarded routes (WhatsApp credentials go through /api/whatsapp/*).
const PROTECTED_SCHOOL_FIELDS = ['id', 'status', 'created_at', 'whatsapp_hiring'] as const;

export function stripProtectedSchoolFields(
  updates: Record<string, unknown>,
  isSuperAdmin: boolean
): Record<string, unknown> {
  if (isSuperAdmin) return { ...updates };
  const clean: Record<string, unknown> = { ...updates };
  for (const key of PROTECTED_SCHOOL_FIELDS) delete clean[key];
  return clean;
}
