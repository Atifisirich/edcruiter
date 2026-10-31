'use client';

import React from 'react';
import { GRADES, GRADE_GROUPS, cleanGrades, describeGrades } from '@/lib/grades';

/**
 * Pick any grades, one at a time, such as 1, 2 and 5. The group buttons are a
 * shortcut for a whole stage of the school; they switch all of its grades on
 * together, or off together when every one is already on.
 */
export default function GradePicker({
  value,
  onChange,
  label = 'Grades',
  required,
}: {
  value: string[];
  onChange: (grades: string[]) => void;
  label?: string;
  required?: boolean;
}) {
  const selected = new Set(value);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(cleanGrades([...next]));
  };

  const toggleGroup = (ids: string[]) => {
    const next = new Set(selected);
    const allOn = ids.every((id) => next.has(id));
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    onChange(cleanGrades([...next]));
  };

  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </legend>

      <div className="flex flex-wrap gap-1.5">
        {GRADE_GROUPS.map((g) => {
          const allOn = g.ids.every((id) => selected.has(id));
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => toggleGroup(g.ids)}
              aria-pressed={allOn}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                allOn ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GRADES.map((g) => {
          const on = selected.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => toggle(g.id)}
              aria-pressed={on}
              aria-label={/^\d+$/.test(g.id) ? `Grade ${g.label}` : g.label}
              className={`min-w-10 h-10 px-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-colors ${
                on ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:border-indigo-400'
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-slate-500" aria-live="polite">
        {value.length ? <>Selected: <strong className="text-slate-700">{describeGrades(value)}</strong></> : 'Choose one or more grades.'}
      </p>
    </fieldset>
  );
}
