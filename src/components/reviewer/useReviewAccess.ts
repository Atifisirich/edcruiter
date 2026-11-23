'use client';

import { useEffect, useState } from 'react';
import type { ReviewRound, RoleDef, UserRole } from '@/lib/types';

export interface ReviewAccess {
  rounds: ReviewRound[];
  /** A campus's own review flow, by branch id. See reviewRounds.ts. */
  branch_rounds?: Record<string, ReviewRound[]>;
  roles: RoleDef[];
  me: { id: string; name: string; role: UserRole; role_id: string; role_name: string };
}

/**
 * The school's review rounds and who is signed in, so a page shows each person
 * only the decisions they may take. The server checks every action again.
 */
export function useReviewAccess(): ReviewAccess | null {
  const [access, setAccess] = useState<ReviewAccess | null>(null);
  useEffect(() => {
    let cancelled = false;
    const schoolId = localStorage.getItem('edcruiter_school_id') || '';
    fetch(`/api/review-rounds${schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.rounds) setAccess(d); })
      .catch(() => { /* the page shows read-only until this loads */ });
    return () => { cancelled = true; };
  }, []);
  return access;
}
