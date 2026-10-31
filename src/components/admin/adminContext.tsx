'use client';

import { createContext, useContext } from 'react';
import type { Candidate, School } from '@/lib/types';

export type ToastKind = 'success' | 'error' | 'info';

export interface AdminContextValue {
  school: School | null;
  schoolId: string;
  /** The signed-in person, for greetings. */
  user: { name: string; email: string; role: string } | null;
  candidates: Candidate[];
  loading: boolean;
  refresh: () => Promise<void>;
  setSchool: (school: School) => void;
  openAddCandidate: () => void;
  openNewVacancy: () => void;
  openBulkUpload: () => void;
  toast: (message: string, kind?: ToastKind) => void;
}

export const AdminContext = createContext<AdminContextValue | null>(null);

/** The school, its candidates and the shared actions, for any page inside the hiring dashboard. */
export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used inside the hiring dashboard');
  return ctx;
}
