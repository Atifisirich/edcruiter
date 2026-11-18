/**
 * Support mode, in the browser: which school the platform owner is looking at.
 *
 * The hiring dashboard pages read their school from localStorage
 * ('edcruiter_school_id'). A school's own staff get it from their session
 * (SchoolIdGate). The platform owner has no school, so support mode writes the
 * chosen one there, and the server records each entry and exit in that
 * school's activity log (/api/support-session).
 */

export const SCHOOL_KEY = 'edcruiter_school_id';

export async function enterSupportMode(schoolId: string): Promise<void> {
  const res = await fetch('/api/support-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ school_id: schoolId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not open the workspace');
  try { localStorage.setItem(SCHOOL_KEY, schoolId); } catch { /* storage blocked */ }
}

export async function exitSupportMode(schoolId: string): Promise<void> {
  try {
    await fetch('/api/support-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, action: 'exit' }),
    });
  } catch { /* leaving still works offline */ }
  try { localStorage.removeItem(SCHOOL_KEY); } catch { /* storage blocked */ }
}

export function storedSchoolId(): string {
  try { return localStorage.getItem(SCHOOL_KEY) || ''; } catch { return ''; }
}
