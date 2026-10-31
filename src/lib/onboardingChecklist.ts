/**
 * The "Get started" checklist on the hiring dashboard. Each step says what to
 * do, why, and where to do it, and is ticked from what the school already has.
 */

export interface ChecklistInput {
  school: { branches?: unknown[]; whatsapp_hiring?: { status?: string } | null } | null;
  counts: { tests: number; policies: number; vacancies: number; candidates: number; teamMembers: number };
}

export interface ChecklistItem {
  key: 'school' | 'whatsapp' | 'test' | 'policy' | 'vacancy' | 'candidates' | 'team';
  label: string;
  hint: string;
  /** A page to open, or an action the dashboard performs itself. */
  href?: string;
  action?: 'add-candidate' | 'new-vacancy';
  done: boolean;
}

export function buildChecklist({ school, counts }: ChecklistInput): ChecklistItem[] {
  const whatsapp = school?.whatsapp_hiring;
  return [
    {
      key: 'school',
      label: 'Set up your school',
      hint: 'Campuses, subjects and boards',
      href: '/admin/settings',
      done: (school?.branches?.length ?? 0) > 0,
    },
    {
      key: 'whatsapp',
      label: 'Connect your WhatsApp number',
      hint: 'Send test invites from your school’s own number',
      href: '/admin/whatsapp',
      done: !!whatsapp && whatsapp.status !== 'not_connected',
    },
    {
      key: 'test',
      label: 'Create your first AI test',
      hint: 'Pick a subject, grade and board',
      href: '/admin/tests',
      done: counts.tests > 0,
    },
    {
      key: 'policy',
      label: 'Add your school policies',
      hint: 'Teachers read and accept them in stage 5',
      href: '/admin/policies',
      done: counts.policies > 0,
    },
    {
      key: 'vacancy',
      label: 'Post a vacancy',
      hint: 'Publish it on your jobs page',
      action: 'new-vacancy',
      done: counts.vacancies > 0,
    },
    {
      key: 'candidates',
      label: 'Add your first candidates',
      hint: 'One by one, or upload a list',
      action: 'add-candidate',
      done: counts.candidates > 0,
    },
    {
      key: 'team',
      label: 'Invite your hiring team',
      hint: 'HODs, principal and management',
      href: '/admin/team',
      done: counts.teamMembers > 1,
    },
  ];
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number; percent: number } {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/** The first step still to do, so the dashboard can point at it. */
export function nextStep(items: ChecklistItem[]): ChecklistItem | undefined {
  return items.find((i) => !i.done);
}
