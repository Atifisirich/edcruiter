'use client';

/**
 * The small set of building blocks every hiring-dashboard page is made from,
 * so the pages look like one product: a page header, cards, stat tiles, badges,
 * buttons, empty states and a progress bar.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';

const BADGE: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rose: 'bg-rose-50 text-rose-800 border-rose-200',
};

const ICON_BOX: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
};

export function Badge({ tone = 'slate', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${BADGE[tone]} ${className}`}>
      {children}
    </span>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-indigo-600',
  secondary: 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-300 shadow-xs',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border border-transparent',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600',
};

/** Class names for a button or a link that should look like one. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: 'sm' | 'md' = 'md'): string {
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm';
  return `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${pad} ${BUTTON[variant]}`;
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight text-slate-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-slate-500 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`bg-white border border-slate-200 rounded-2xl shadow-xs ${padded ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  Icon,
  tone = 'indigo',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  Icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs h-full flex items-start justify-between gap-3 transition-colors hover:border-indigo-300">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ICON_BOX[tone]}`}>
        <Icon className="w-5 h-5" />
      </span>
    </div>
  );
  return href ? (
    <a href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl">
      {body}
    </a>
  ) : (
    body
  );
}

export function EmptyState({
  Icon,
  title,
  description,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4 gap-3">
      <span className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-900">{title}</p>
        {description && <p className="text-sm text-slate-500 max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ percent, tone = 'indigo' }: { percent: number; tone?: 'indigo' | 'emerald' }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`h-full rounded-full transition-all ${tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/** A row of segments that fills as stages are completed (used for test progress). */
export function StepDots({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${done} of ${total} stages done`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 w-5 rounded-full ${i < done ? 'bg-indigo-600' : 'bg-slate-200'}`} />
      ))}
    </div>
  );
}

export const inputClass =
  'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export const selectClass =
  'px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
