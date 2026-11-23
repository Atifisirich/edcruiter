'use client';

import React, { useEffect, useState } from 'react';
import { Download, Info, Loader2, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import {
  GROUP_LABEL, GROUP_NOTE, observationLabel, recommendationFor, scoreLabel, scoreTone, stars,
  type FactorGroup, type ProfileFactor, type ScoreTone, type TeachingProfile,
} from '@/lib/teachingProfile';
import { bandBadgeClass, type ShortlistBand } from '@/lib/shortlistBands';
import { summariseFactors } from '@/lib/reportVerdict';

export interface ProfileResponse {
  profile: TeachingProfile | null;
  generating: boolean;
  shortlist_bands: ShortlistBand[] | null;
  settings: { delivery: boolean; appearance: boolean };
}

const TONE_BADGE: Record<ScoreTone | 'none', string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-900 border-amber-200',
  red: 'bg-rose-50 text-rose-800 border-rose-200',
  none: 'bg-slate-100 text-slate-500 border-slate-200',
};
const TONE_BAR: Record<ScoreTone, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-rose-500',
};

function Stars({ score }: { score: number }) {
  const value = stars(score);
  return (
    <span className="text-amber-400 text-xs tracking-tight" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (i + 1 <= value ? '★' : i + 0.5 === value ? '⯨' : '☆')).join('')}
    </span>
  );
}

function FactorRow({ f, mode }: { f: ProfileFactor; mode: 'number' | 'band' }) {
  const noData = f.score === null || f.confidence === 'none';
  const tone = noData ? 'none' : scoreTone(f.score as number);
  return (
    <li className="py-3.5 grid grid-cols-1 sm:grid-cols-[13rem_1fr] gap-x-5 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2 sm:block">
          <p className="text-sm font-semibold text-slate-900">{f.label}</p>
          <span className={`sm:hidden shrink-0 px-2.5 py-0.5 rounded-lg border text-sm font-bold tabular-nums ${TONE_BADGE[tone]}`}>
            {mode === 'band' ? observationLabel(f) : noData ? 'No data' : f.score}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-snug mt-0.5">{f.definition}</p>
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="hidden sm:flex items-center gap-3">
          <span className={`shrink-0 min-w-[2.75rem] text-center px-2.5 py-0.5 rounded-lg border text-sm font-bold tabular-nums ${TONE_BADGE[tone]}`}>
            {mode === 'band' ? observationLabel(f) : noData ? 'No data' : f.score}
          </span>
          {mode === 'number' && !noData && (
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden max-w-[14rem]">
              <div className={`h-full rounded-full ${TONE_BAR[tone as ScoreTone]}`} style={{ width: `${f.score}%` }} />
            </div>
          )}
          {mode === 'number' && !noData && <Stars score={f.score as number} />}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{f.reason}</p>
        {f.quote && <p className="text-xs italic text-slate-500 border-l-2 border-indigo-200 pl-2.5">&ldquo;{f.quote}&rdquo;</p>}
        {f.confidence === 'low' && (
          <p className="text-xs text-slate-400 italic">No matching quote was found in their answer, so this is for information only and is not counted in the overall score.</p>
        )}
      </div>
    </li>
  );
}

/**
 * One group of factors. Closed, it already says how the group went: its average,
 * a small bar per factor, and the best and weakest factor. Open, every reason and quote.
 */
function Group({ profile, group, mode, defaultOpen = true }: { profile: TeachingProfile; group: FactorGroup; mode: 'number' | 'band'; defaultOpen?: boolean }) {
  const rows = profile.factors.filter((f) => f.group === group);
  if (!rows.length) return null;
  const sum = summariseFactors(rows);
  const avgTone = sum.average === null ? 'none' : scoreTone(sum.average);
  const bands = mode === 'band'
    ? Object.entries(rows.reduce<Record<string, number>>((m, f) => { const l = observationLabel(f); m[l] = (m[l] || 0) + 1; return m; }, {}))
    : [];
  return (
    <details open={defaultOpen} className="group/fg rounded-2xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 flex items-center gap-3 sm:gap-4 rounded-2xl hover:bg-slate-50/70">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{GROUP_LABEL[group]}</span>
            <span className="text-xs text-slate-400">{rows.length} {rows.length === 1 ? 'factor' : 'factors'}</span>
          </span>
          {mode === 'number' && sum.best && (!sum.weakest || sum.weakest.score === sum.best.score) ? (
            <span className="mt-1 block text-xs text-slate-600">{sum.scored > 1 ? `All ${sum.scored} factors at ${sum.best.score}` : `${sum.best.label} ${sum.best.score}`}</span>
          ) : mode === 'number' && sum.best ? (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
              <span><span className="text-emerald-700 font-semibold">▲ Best</span> {sum.best.label} <span className="font-semibold tabular-nums">{sum.best.score}</span></span>
              {sum.weakest && <span><span className="text-rose-700 font-semibold">▼ Lowest</span> {sum.weakest.label} <span className="font-semibold tabular-nums">{sum.weakest.score}</span></span>}
            </span>
          ) : mode === 'band' ? (
            <span className="mt-1 block text-xs text-slate-600">{bands.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(' · ')}</span>
          ) : (
            <span className="mt-1 block text-xs text-slate-500">{GROUP_NOTE[group]}</span>
          )}
        </span>
        {mode === 'number' && sum.scored > 0 && (
          <span className="hidden sm:flex items-end gap-1 h-8" aria-hidden="true">
            {rows.map((f) => {
              const has = typeof f.score === 'number' && f.confidence !== 'none';
              return (
                <span key={f.key} title={`${f.label}: ${has ? f.score : 'no data'}`} className="relative w-1.5 h-full rounded-full bg-slate-100 overflow-hidden">
                  {has && <span className={`absolute bottom-0 inset-x-0 rounded-full ${TONE_BAR[scoreTone(f.score as number)]}`} style={{ height: `${Math.max(6, f.score as number)}%` }} />}
                </span>
              );
            })}
          </span>
        )}
        {mode === 'number' && (
          <span className={`shrink-0 min-w-[3.5rem] text-center rounded-xl border px-2.5 py-1 ${TONE_BADGE[avgTone]}`}>
            <span className="block text-lg font-bold leading-none tabular-nums">{sum.average ?? '—'}</span>
            <span className="block text-[10px] font-medium opacity-70 mt-0.5">average</span>
          </span>
        )}
        <span className="text-slate-400 text-xs transition-transform group-open/fg:rotate-180 print:hidden" aria-hidden="true">▼</span>
      </summary>
      <p className="px-4 -mt-1 pb-1 text-xs text-slate-500">{GROUP_NOTE[group]}</p>
      <ul className="px-4 pb-2 divide-y divide-slate-100">
        {rows.map((f) => <FactorRow key={f.key} f={f} mode={mode} />)}
      </ul>
    </details>
  );
}

export default function TeachingProfilePanel({
  candidateId,
  scoredStagesDone,
  onData,
  hideOverall = false,
  embedded = false,
}: {
  candidateId: string;
  scoredStagesDone: boolean;
  /** Told whenever the profile loads or changes, so the page's headline number can follow it. */
  onData?: (data: ProfileResponse | null) => void;
  /** The overall number is shown above already. */
  hideOverall?: boolean;
  /** Inside the report's own section: no card, no title, and the summary, strengths and concerns are left to the verdict above. */
  embedded?: boolean;
}) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/candidates/${candidateId}/profile`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body.error || 'Could not load the teaching profile.');
          return;
        }
        setLoadError('');
        setData(body);
        onData?.(body);
      } catch {
        if (!cancelled) setLoadError('Could not load the teaching profile.');
      }
    })();
    return () => { cancelled = true; };
  }, [candidateId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const generating = data?.generating ?? false;
  useEffect(() => {
    if (!generating) return;
    const timer = setTimeout(() => setReloadKey((k) => k + 1), 4000);
    return () => clearTimeout(timer);
  }, [generating, reloadKey]);

  const startProfile = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/profile`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(body.error || 'Could not start the profile.');
      } else {
        setLoadError('');
        setData((d) => (d ? { ...d, generating: true } : d));
        setReloadKey((k) => k + 1);
      }
    } finally {
      setStarting(false);
    }
  };

  const profile = data?.profile ?? null;
  const rec = profile ? recommendationFor(profile.overall.score, data?.shortlist_bands) : null;
  const overall = profile?.overall.score ?? null;

  return (
    <section className={embedded ? 'space-y-4' : 'bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4'} style={{ WebkitTextSizeAdjust: '100%', textSizeAdjust: '100%' }}>
      <div className={`flex flex-wrap items-start gap-3 ${embedded ? 'justify-end print:hidden' : 'justify-between'}`}>
        <div className={embedded ? 'hidden' : ''}>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" /> Teaching profile
          </h2>
          <p className="text-xs text-slate-500">Six teaching areas, more factors, CV review and communication, each with a reason.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile && profile.status !== 'failed' && (
            <a
              href={`/api/candidates/${candidateId}/report`}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download PDF report
            </a>
          )}
          {(profile || scoredStagesDone) && (
            <button
              type="button"
              onClick={startProfile}
              disabled={starting || generating}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              {profile ? 'Refresh' : 'Write profile now'}
            </button>
          )}
        </div>
      </div>

      {loadError && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{loadError}</p>}

      {!data && !loadError && (
        <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      )}

      {data && generating && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Writing the profile. This usually takes under a minute, a little longer when there is a video to watch.
        </div>
      )}

      {data && !profile && !generating && (
        <p className="text-xs text-slate-500">
          {scoredStagesDone
            ? 'The profile has not been written yet.'
            : 'The profile is written automatically once the candidate finishes the written test, the teaching demo and the classroom scenario.'}
        </p>
      )}

      {profile?.status === 'failed' && !generating && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>The profile could not be written{profile.error ? `: ${profile.error}` : '.'} Use Refresh to try again.</span>
        </div>
      )}

      {profile && profile.status !== 'failed' && (
        <div className="space-y-4">
          <div className={`flex flex-wrap items-center gap-5 rounded-2xl bg-slate-50 border border-slate-200 p-4 ${hideOverall ? 'hidden' : ''}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall suitability</p>
              <p className="text-4xl font-black text-slate-900 font-mono leading-none mt-1">
                {overall === null ? <span className="text-base font-bold text-slate-500">Not enough evidence</span> : <>{overall}<span className="text-sm font-medium text-slate-400"> / 100</span></>}
              </p>
            </div>
            {rec && (
              <span className={`px-3 py-1 rounded-full border text-xs font-bold ${bandBadgeClass(rec.tone)}`}>{rec.label}</span>
            )}
            {overall !== null && <span className="text-xs text-slate-500">{scoreLabel(overall)} overall</span>}
          </div>

          {profile.overall.capped_reason && !embedded && (
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{profile.overall.capped_reason}</p>
          )}
          {profile.status === 'partial' && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              The video could not be analysed automatically, so the delivery notes are missing. A person should watch it.
            </p>
          )}

          {profile.summary && !embedded && <p className="text-sm text-slate-800 leading-relaxed">{profile.summary}</p>}

          {!embedded && (profile.strengths.length > 0 || profile.improvements.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.strengths.length > 0 && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-xs font-black text-emerald-900 mb-1.5">Strengths</p>
                  <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">{profile.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
              {profile.improvements.length > 0 && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-xs font-black text-amber-900 mb-1.5">Areas to improve</p>
                  <ul className="space-y-1 text-xs text-slate-700 list-disc list-inside">{profile.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          <Group profile={profile} group="area" mode="number" defaultOpen={!embedded} />
          <Group profile={profile} group="extra" mode="number" defaultOpen={false} />
          <Group profile={profile} group="attitude" mode="number" defaultOpen={false} />
          <Group profile={profile} group="resume" mode="number" defaultOpen={false} />
          <Group profile={profile} group="communication" mode="number" defaultOpen={false} />

          {profile.relevancy.length > 0 && (
            <details className="group/rel rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden px-4 py-3.5 flex items-center gap-3 sm:gap-4 rounded-2xl hover:bg-slate-50/70">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900">Response relevancy</span>
                    <span className="text-xs text-slate-400">{profile.relevancy.length} {profile.relevancy.length === 1 ? 'answer' : 'answers'}</span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">How directly each response answers the question that was asked.</span>
                </span>
                {(() => {
                  const sc = profile.relevancy.map((r) => r.score).filter((n): n is number => typeof n === 'number');
                  const avg = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null;
                  return (
                    <span className={`shrink-0 min-w-[3.5rem] text-center rounded-xl border px-2.5 py-1 ${TONE_BADGE[avg === null ? 'none' : scoreTone(avg)]}`}>
                      <span className="block text-lg font-bold leading-none tabular-nums">{avg ?? '—'}</span>
                      <span className="block text-[10px] font-medium opacity-70 mt-0.5">average</span>
                    </span>
                  );
                })()}
                <span className="text-slate-400 text-xs transition-transform group-open/rel:rotate-180 print:hidden" aria-hidden="true">▼</span>
              </summary>
              <ul className="px-4 pb-3 divide-y divide-slate-100">
                {profile.relevancy.map((r) => {
                  const tone = r.score === null ? 'none' : scoreTone(r.score);
                  return (
                    <li key={r.id} className="py-2.5 flex items-start justify-between gap-3">
                      <p className="text-xs text-slate-700 min-w-0">{r.question}</p>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-lg border text-[11px] font-black ${TONE_BADGE[tone]}`}>{r.score === null ? 'No data' : r.score}</span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          <Group profile={profile} group="delivery" mode="band" defaultOpen={false} />
          <Group profile={profile} group="appearance" mode="band" defaultOpen={false} />

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject test</p>
              <p className="font-bold text-slate-900 mt-0.5">{profile.measured.mcq_total ? `${profile.measured.mcq_correct} / ${profile.measured.mcq_total}` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lesson plan</p>
              <p className="font-bold text-slate-900 mt-0.5">{profile.measured.lesson_words !== null ? `${profile.measured.lesson_words} words` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Test integrity</p>
              <p className="font-bold text-slate-900 mt-0.5">{profile.measured.integrity_score !== null ? `${profile.measured.integrity_score} / 100` : '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Flags</p>
              <p className="font-bold text-slate-900 mt-0.5">{profile.measured.integrity_flags}</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              AI-assisted. Every score has a reason, and quotes are checked against the candidate&apos;s own words. Video impressions are indicative
              and never count toward the overall score. The school makes the hiring decision.
              {' '}Written {new Date(profile.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
