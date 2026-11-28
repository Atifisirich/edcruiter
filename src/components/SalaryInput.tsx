'use client';

import React from 'react';
import { digitsOnly, formatMonthly, SALARY_HINT } from '@/lib/salary';

/**
 * A salary box: rupees a month, digits only. Anything else typed or pasted is
 * dropped as it arrives, and the figure is read back underneath ("₹35,000 / month").
 */
export default function SalaryInput({
  value,
  onChange,
  label,
  hint = SALARY_HINT,
  placeholder = '35000',
  disabled,
  required,
  className = '',
  inputClassName = '',
  compact,
}: {
  /** Digits only, or ''. */
  value: string;
  onChange: (digits: string) => void;
  label?: React.ReactNode;
  hint?: string | null;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  /** No read-back line, for tight rows such as the Pay Guide tiers. */
  compact?: boolean;
}) {
  const n = Number(value);
  const id = React.useId();
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>}
      <div className={`${label ? 'mt-1 ' : ''}flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 ${disabled ? 'opacity-60' : ''}`}>
        <span className="pl-3 text-sm font-semibold text-slate-500" aria-hidden="true">₹</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          aria-describedby={hint && !compact ? `${id}-hint` : undefined}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          className={`min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm tabular-nums text-slate-900 placeholder-slate-400 focus:outline-none ${inputClassName}`}
        />
        <span className="pr-3 text-xs text-slate-500 whitespace-nowrap" aria-hidden="true">/ month</span>
      </div>
      {!compact && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {value && n > 0 ? <strong className="text-slate-800">{formatMonthly(n)}</strong> : hint}
        </p>
      )}
    </div>
  );
}
