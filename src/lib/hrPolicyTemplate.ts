/**
 * Structured school HR / faculty policy fields.
 * Schools fill the bare-minimum template; free-text policies can still be added.
 */

export type HrPolicyFieldType = 'number' | 'text' | 'boolean' | 'select';

export interface HrPolicyFieldDef {
  id: string;
  section: string;
  label: string;
  type: HrPolicyFieldType;
  required?: boolean;
  unit?: string;
  options?: string[];
  help?: string;
}

export const HR_POLICY_FIELD_DEFS: HrPolicyFieldDef[] = [
  { id: 'reporting_time', section: 'Working hours', label: 'Reporting / school start time', type: 'text', required: true, help: 'e.g. 7:45 AM' },
  { id: 'working_days', section: 'Working hours', label: 'Working days per week', type: 'number', required: true },
  { id: 'saturday_working', section: 'Working hours', label: 'Saturdays working?', type: 'select', options: ['No', 'Alternate Saturdays', 'All Saturdays', 'As announced'], required: true },
  { id: 'teaching_periods_per_day', section: 'Working hours', label: 'Typical teaching periods per day', type: 'number' },

  { id: 'casual_leave_days', section: 'Leave', label: 'Casual leave days per year', type: 'number', required: true, unit: 'days' },
  { id: 'sick_leave_days', section: 'Leave', label: 'Sick leave days per year', type: 'number', required: true, unit: 'days' },
  { id: 'earned_leave_days', section: 'Leave', label: 'Earned / privilege leave days per year', type: 'number', unit: 'days' },
  { id: 'summer_holiday_days', section: 'Leave', label: 'Summer holiday / vacation days', type: 'number', required: true, unit: 'days' },
  { id: 'winter_holiday_days', section: 'Leave', label: 'Winter / Christmas break days', type: 'number', unit: 'days' },
  { id: 'maternity_leave_days', section: 'Leave', label: 'Maternity leave (days)', type: 'number', unit: 'days' },
  { id: 'paternity_leave_days', section: 'Leave', label: 'Paternity leave (days)', type: 'number', unit: 'days' },

  { id: 'notice_period_days', section: 'Contract', label: 'Notice period', type: 'number', required: true, unit: 'days' },
  { id: 'probation_months', section: 'Contract', label: 'Probation period', type: 'number', unit: 'months' },
  { id: 'contract_type', section: 'Contract', label: 'Typical contract type', type: 'select', options: ['Permanent', 'Fixed-term', 'Probation then permanent', 'Visiting / part-time'], required: true },

  { id: 'pf_provided', section: 'Pay & benefits', label: 'Provident Fund (PF) provided?', type: 'boolean', required: true },
  { id: 'esi_provided', section: 'Pay & benefits', label: 'ESI / medical insurance provided?', type: 'boolean' },
  { id: 'gratuity_applicable', section: 'Pay & benefits', label: 'Gratuity applicable?', type: 'boolean' },
  { id: 'salary_structure_notes', section: 'Pay & benefits', label: 'Salary structure notes (CTC, allowances)', type: 'text' },

  { id: 'accommodation_provided', section: 'Housing & transport', label: 'Staff accommodation provided?', type: 'boolean', required: true },
  { id: 'accommodation_details', section: 'Housing & transport', label: 'Accommodation details (if yes)', type: 'text' },
  { id: 'transport_provided', section: 'Housing & transport', label: 'Staff transport / bus provided?', type: 'boolean' },
  { id: 'meal_provided', section: 'Housing & transport', label: 'Staff meals / canteen benefit?', type: 'boolean' },

  { id: 'child_safeguarding_commitment', section: 'Safeguarding', label: 'Zero-tolerance child safeguarding (POCSO) policy applies', type: 'boolean', required: true },
  { id: 'background_check_required', section: 'Safeguarding', label: 'Police / background verification required before joining', type: 'boolean', required: true },
  { id: 'code_of_conduct_summary', section: 'Safeguarding', label: 'Code of conduct summary for teachers', type: 'text', required: true },

  { id: 'lesson_plan_required', section: 'Academic expectations', label: 'Weekly lesson plans required?', type: 'boolean' },
  { id: 'parent_meeting_expectation', section: 'Academic expectations', label: 'Parent meeting / PTM expectation', type: 'text' },
  { id: 'extra_duties', section: 'Academic expectations', label: 'Extra duties (exam duty, events, substitution)', type: 'text' },
];

export type HrPolicyAnswers = Record<string, string | number | boolean | ''>;

export function formatHrAnswersAsPolicyText(answers: HrPolicyAnswers): string {
  const bySection = new Map<string, string[]>();
  for (const def of HR_POLICY_FIELD_DEFS) {
    const raw = answers[def.id];
    if (raw === undefined || raw === '' || raw === null) continue;
    let display: string;
    if (def.type === 'boolean') display = raw === true || raw === 'true' ? 'Yes' : 'No';
    else if (def.unit) display = `${raw} ${def.unit}`;
    else display = String(raw);
    const line = `• ${def.label}: ${display}`;
    const list = bySection.get(def.section) || [];
    list.push(line);
    bySection.set(def.section, list);
  }
  const parts: string[] = [
    'FACULTY HR POLICY (school-configured)',
    'Teachers must confirm they have read and accept the following before completing the assessment.',
    '',
  ];
  for (const [section, lines] of bySection) {
    parts.push(section.toUpperCase());
    parts.push(...lines);
    parts.push('');
  }
  return parts.join('\n').trim();
}

export function missingRequiredHrFields(answers: HrPolicyAnswers): string[] {
  return HR_POLICY_FIELD_DEFS
    .filter((d) => d.required)
    .filter((d) => {
      const v = answers[d.id];
      if (d.type === 'boolean') return v === undefined || v === '';
      return v === undefined || v === '' || v === null;
    })
    .map((d) => d.label);
}
