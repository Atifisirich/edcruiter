'use client';

import React from 'react';
import { ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Verdict } from '@/lib/reportVerdict';
import { MetricCard, PointList, ScoreBar, VERDICT_STYLE, openSection, type Metric } from './ReportUI';
import { toneFor100 } from '@/lib/reportVerdict';

/**
 * The top of the report, built for a decision in under a minute: one big number,
 * one verdict word, one line on who this is, the next step, then the numbers
 * behind it as colour-coded cards and the three best and worst points.
 */
export default function ReportVerdict({
  score,
  scoreLabel,
  scoreNote,
  verdict,
  bandLabel,
  summary,
  facts,
  metrics,
  strengths,
  concerns,
  areas = [],
  salary = [],
}: {
  score: number | null;
  scoreLabel: string;
  scoreNote?: string;
  verdict: Verdict | null;
  bandLabel?: string;
  summary: string;
  facts: string[];
  metrics: Metric[];
  strengths: string[];
  concerns: string[];
  /** The teaching areas from the profile, shown as a small bar chart. */
  areas?: { key: string; label: string; score: number | null }[];
  /** Last and expected salary, shown right under the scores so both are weighed together. */
  salary?: { label: string; value: string; note?: string }[];
}) {
  const style = verdict ? VERDICT_STYLE[verdict.key] : null;
  return (
    <section className="report-hero bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden" aria-label="Verdict">
      <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:gap-7 sm:items-center">
        <div className={`report-card shrink-0 rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4 sm:flex-col sm:gap-0 sm:text-center sm:min-w-[11.5rem] ${style ? style.ring : 'border-slate-200 bg-slate-50'}`}>
          {score === null ? (
            <p className="text-base font-semibold text-slate-500 sm:mt-2 sm:order-2">Not enough evidence yet</p>
          ) : (
            <p className="leading-none shrink-0 sm:mt-1 sm:order-2">
              <span className={`text-6xl sm:text-7xl font-bold tabular-nums tracking-tight ${style?.number ?? 'text-slate-900'}`}>{score}</span>
              <span className="text-sm font-medium text-slate-400"> /100</span>
            </p>
          )}
          <span className="block sm:contents">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:order-1">{scoreLabel}</span>
            {scoreNote && <span className="block mt-1 sm:mt-2 sm:order-3 text-[11px] text-slate-500 leading-snug sm:max-w-[12rem] sm:mx-auto">{scoreNote}</span>}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {verdict ? (
              <span className={`px-3.5 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase ${style!.pill}`}>{verdict.label}</span>
            ) : (
              <span className="px-3.5 py-1.5 rounded-full text-sm font-bold uppercase bg-slate-100 text-slate-600">Not scored yet</span>
            )}
            {bandLabel && <span className="text-xs text-slate-500">School band: <span className="font-semibold text-slate-700">{bandLabel}</span></span>}
          </div>
          <p className="mt-3 text-base sm:text-xl font-semibold text-slate-900 leading-snug">{summary}</p>
          {verdict && (
            <p className="mt-2.5 flex items-start gap-2 text-sm text-slate-700">
              <ArrowRight className="w-4 h-4 mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
              <span><span className="font-semibold text-slate-900">Suggested next step:</span> {verdict.nextStep}</span>
            </p>
          )}
          {verdict?.heldBack && <p className="mt-1.5 text-xs text-rose-700">{verdict.heldBack}</p>}
          {facts.length > 0 && (
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {facts.map((f) => <span key={f}>{f}</span>)}
            </p>
          )}
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {metrics.map((m) => <MetricCard key={m.key} m={m} />)}
          </div>
          <p className="mt-2.5 text-[11px] text-slate-400 print:hidden">Tap a card to see what is behind it. Green good · amber worth a look · red read before deciding.</p>
        </div>
      )}

      {salary.length > 0 && (
        <dl className="px-5 sm:px-6 py-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {salary.map((s) => (
            <div key={s.label} className="report-card rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</dt>
              <dd className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{s.value}</dd>
              {s.note && <dd className="text-xs text-slate-500">{s.note}</dd>}
            </div>
          ))}
        </dl>
      )}

      {areas.length > 0 && (
        <div className="px-5 sm:px-6 py-5 border-t border-slate-200">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-slate-900">Teaching areas</p>
            <button type="button" onClick={() => openSection('sec-skills')} className="text-xs font-semibold text-indigo-700 hover:underline cursor-pointer print:hidden">Reasons and quotes</button>
          </div>
          <ul className="grid gap-x-10 gap-y-2.5 md:grid-cols-2">
            {areas.map((a) => <ScoreBar key={a.key} label={a.label} score={a.score} tone={toneFor100(a.score)} />)}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-px bg-slate-200 border-t border-slate-200">
        <div className="bg-white p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-3"><CheckCircle2 className="w-4 h-4" /> Top strengths</p>
          <PointList items={strengths} tone="good" empty="Nothing stood out yet." />
        </div>
        <div className="bg-white p-5 sm:p-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-800 mb-3"><AlertTriangle className="w-4 h-4" /> Top concerns</p>
          <PointList items={concerns} tone="concern" empty="No concerns were raised." />
        </div>
      </div>
    </section>
  );
}
