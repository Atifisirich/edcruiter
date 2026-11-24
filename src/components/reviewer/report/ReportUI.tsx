'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { toPoints, type Point } from '@/lib/reportPoints';
import type { MetricTone, VerdictKey } from '@/lib/reportVerdict';

/** One colour language for the whole report: green good, amber watch, red concern, grey no data. */
export const TONE: Record<MetricTone, { card: string; number: string; dot: string; chip: string; label: string }> = {
  good: { card: 'bg-emerald-50 border-emerald-200', number: 'text-emerald-700', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', label: 'Good' },
  watch: { card: 'bg-amber-50 border-amber-200', number: 'text-amber-700', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-900 border-amber-200', label: 'Watch' },
  concern: { card: 'bg-rose-50 border-rose-200', number: 'text-rose-700', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800 border-rose-200', label: 'Concern' },
  none: { card: 'bg-white border-slate-200', number: 'text-slate-400', dot: 'bg-slate-300', chip: 'bg-slate-50 text-slate-600 border-slate-200', label: 'No data' },
};

export const VERDICT_STYLE: Record<VerdictKey, { pill: string; number: string; ring: string }> = {
  strong: { pill: 'bg-emerald-600 text-white', number: 'text-emerald-700', ring: 'border-emerald-200 bg-emerald-50' },
  good: { pill: 'bg-indigo-600 text-white', number: 'text-indigo-700', ring: 'border-indigo-200 bg-indigo-50' },
  mixed: { pill: 'bg-amber-500 text-white', number: 'text-amber-700', ring: 'border-amber-200 bg-amber-50' },
  weak: { pill: 'bg-rose-600 text-white', number: 'text-rose-700', ring: 'border-rose-200 bg-rose-50' },
};

/** Opens a report section (and its parent section) and scrolls to it. */
export function openSection(id: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  let node: HTMLElement | null = el;
  while (node) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export interface Metric {
  key: string;
  label: string;
  value: string;
  unit?: string;
  tone: MetricTone;
  caption?: string;
  /** The section that explains this number. */
  target?: string;
}

export function MetricCard({ m }: { m: Metric }) {
  const t = TONE[m.tone];
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">{m.label}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} aria-hidden="true" />
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <span className={`text-3xl sm:text-[2rem] font-bold leading-none tabular-nums ${t.number}`}>{m.value}</span>
        {m.unit && <span className="text-xs font-medium text-slate-400">{m.unit}</span>}
      </span>
      {m.caption && <span className="mt-1.5 block text-xs text-slate-600 leading-snug line-clamp-2">{m.caption}</span>}
      {m.target && (
        <span className="mt-auto pt-2.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 group-hover/card:gap-1.5 transition-all print:hidden">
          See details <ChevronRight className="w-3.5 h-3.5" />
        </span>
      )}
      <span className="sr-only">{t.label}</span>
    </>
  );
  const cls = `report-card flex flex-col text-left rounded-2xl border p-4 min-h-[7.5rem] ${t.card}`;
  if (!m.target) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={() => openSection(m.target!)} className={`${cls} group/card cursor-pointer transition hover:shadow-md hover:border-indigo-300 hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-indigo-500`}>
      {body}
    </button>
  );
}

/** A click-to-open card. Content stays mounted while closed, so panels inside keep loading. */
export function ReportSection({
  id,
  icon,
  title,
  hint,
  badge,
  badgeTone = 'none',
  preview,
  defaultOpen = false,
  children,
}: {
  id: string;
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  badge?: string;
  badgeTone?: MetricTone;
  /** The few numbers that matter, shown while the section is closed so most readers never need to open it. */
  preview?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="report-section group/sec scroll-mt-20 bg-white border border-slate-200 rounded-2xl shadow-sm">
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 sm:px-5 py-4 rounded-2xl hover:bg-slate-50/70">
        <span className="flex items-center gap-3">
          {icon && <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">{icon}</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
            {hint && <span className="block text-xs text-slate-500 truncate">{hint}</span>}
          </span>
          {badge && <span className={`shrink-0 px-2.5 py-1 rounded-full border text-xs font-semibold tabular-nums ${TONE[badgeTone].chip}`}>{badge}</span>}
          <span className="hidden sm:inline text-xs font-semibold text-indigo-600 print:hidden"><span className="group-open/sec:hidden">Open</span><span className="hidden group-open/sec:inline">Close</span></span>
          <OpenCue rotate="group-open/sec:rotate-180" />
        </span>
        {preview && <span className="mt-3 flex flex-wrap gap-1.5 sm:pl-12 group-open/sec:hidden print:hidden">{preview}</span>}
      </summary>
      <div className="px-3 sm:px-5 pb-5 pt-4 space-y-4 border-t border-slate-100">{children}</div>
    </details>
  );
}

/** A small coloured chip for section previews: a label and, if given, its number. */
export function MiniChip({ tone = 'none', label, value }: { tone?: MetricTone; label: string; value?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-lg border text-xs ${TONE[tone].chip}`}>
      <span className="truncate">{label}</span>
      {value && <span className="font-bold tabular-nums shrink-0">{value}</span>}
    </span>
  );
}

/** One row of a compact bar chart: label, bar, number. */
export function ScoreBar({ label, score, max = 100, tone }: { label: string; score: number | null; max?: number; tone: MetricTone }) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <li className="flex items-center gap-3 min-w-0">
      <span className="w-28 sm:w-44 shrink-0 text-sm leading-tight text-slate-700 break-words" title={label}>{label}</span>
      <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <span className={`block h-full rounded-full ${TONE[tone].dot}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`w-9 text-right text-sm font-bold tabular-nums ${TONE[tone].number}`}>{score ?? '—'}</span>
    </li>
  );
}

/** A short list with coloured bullets, for strengths and concerns. */
export function PointList({ items, tone, empty }: { items: string[]; tone: MetricTone; empty: string }) {
  if (!items.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s} className="flex gap-2.5 text-sm text-slate-800 leading-snug">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TONE[tone].dot}`} aria-hidden="true" />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

/** A small label above a block of detail. */
export function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">{children}</p>;
}

/** The sign that a card opens: a chevron in a soft circle, turned when open. Pass the open-state class of the card's named group. */
export function OpenCue({ rotate, size = 'md' }: { rotate: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`shrink-0 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center print:hidden ${size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'}`} aria-hidden="true">
      <ChevronDown className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform ${rotate}`} />
    </span>
  );
}

const POINT_ICON: Record<Point['tone'], React.ReactNode> = {
  good: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  watch: <AlertCircle className="w-4 h-4 text-amber-500" />,
  concern: <AlertCircle className="w-4 h-4 text-rose-500" />,
  none: <span className="block w-1.5 h-1.5 m-[5px] rounded-full bg-slate-400" />,
};

/** A paragraph from the AI as short points: a tick for a good sign, an alert for something to watch. */
export function Points({ text, points, className = '' }: { text?: string | null; points?: Point[]; className?: string }) {
  const list = points ?? toPoints(text);
  if (!list.length) return null;
  return (
    <ul className={`space-y-1.5 ${className}`}>
      {list.map((p, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
          <span className="mt-[3px] shrink-0">{POINT_ICON[p.tone]}</span>
          <span>{p.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Score out of 10 to a word, for the result next to each skill. */
function resultWord(score: number, max: number): { word: string; tone: MetricTone } {
  const pct = (score / max) * 100;
  return pct >= 80 ? { word: 'Strong', tone: 'good' } : pct >= 50 ? { word: 'Fair', tone: 'watch' } : { word: 'Weak', tone: 'concern' };
}

/**
 * One assessed skill: its name as a clear heading, what it is measured against,
 * the result as a word and a number, and the AI's reasoning as points.
 */
export function SkillBlock({ name, score, max = 10, measures, text }: { name: string; score: number; max?: number; measures?: string; text?: string }) {
  const r = resultWord(score, max);
  const t = TONE[r.tone];
  return (
    <div className={`report-card rounded-xl border bg-white overflow-hidden border-l-4 ${r.tone === 'good' ? 'border-l-emerald-500' : r.tone === 'watch' ? 'border-l-amber-400' : 'border-l-rose-500'} border-slate-200`}>
      <div className="px-4 pt-3.5 pb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tested</p>
          <h4 className="text-base font-bold text-slate-900 capitalize leading-snug">{name}</h4>
          {measures && <p className="text-xs text-slate-500 mt-0.5">{measures}</p>}
        </div>
        <div className={`shrink-0 text-center rounded-xl border px-3 py-1.5 ${t.chip}`}>
          <p className="text-xl font-bold leading-none tabular-nums">{score}<span className="text-xs font-medium opacity-60">/{max}</span></p>
          <p className="text-[11px] font-semibold mt-0.5">{r.word}</p>
        </div>
      </div>
      <div className="mx-4 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${t.dot}`} style={{ width: `${Math.max(0, Math.min(100, (score / max) * 100))}%` }} />
      </div>
      {text && <Points text={text} className="px-4 pt-3 pb-4" />}
      {!text && <div className="pb-3" />}
    </div>
  );
}
