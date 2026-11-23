'use client';

import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import type { DeliveryCheck, ProctoringEvent } from '@/lib/types';
import { READING_LEVEL_LABEL, readingCheckFor } from '@/lib/readingCheck';

const TONE = {
  low: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  medium: 'bg-amber-50 border-amber-200 text-amber-950',
  high: 'bg-rose-50 border-rose-200 text-rose-950',
  unknown: 'bg-slate-50 border-slate-200 text-slate-700',
} as const;

/** "Was this answer read out?" for one recorded stage. A signal for the reviewer; it never changes a score. */
export default function ReadingCheckPanel({ events, delivery, onSeek }: {
  events: ProctoringEvent[];
  delivery?: DeliveryCheck;
  /** Jump the stage's video to a moment, in seconds. */
  onSeek?: (seconds: number) => void;
}) {
  const check = readingCheckFor(events, delivery);
  return (
    <div className={`p-4 rounded-2xl border space-y-2 ${TONE[check.level]}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
        <BookOpenCheck className="w-3.5 h-3.5" /> Read out or own words?
      </p>
      <p className="text-sm font-bold">{READING_LEVEL_LABEL[check.level]}</p>
      {check.reasons.length > 0 && (
        <ul className="text-xs space-y-0.5">
          {check.reasons.map((r) => <li key={r}>• {r}</li>)}
        </ul>
      )}
      {check.moments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {check.moments.map((m) => {
            const [min, sec] = m.time.split(':').map(Number);
            return (
              <button
                key={`${m.time}-${m.note}`}
                type="button"
                onClick={() => onSeek?.(min * 60 + sec)}
                className="px-2 py-1 rounded-lg bg-white/80 border border-current/20 text-[11px] text-left cursor-pointer"
                title="Play from here"
              >
                <span className="font-mono font-bold">{m.time}</span> {m.note}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] opacity-75">
        A guide to where to look, not proof. Watch the video before deciding. It never changes the score.
      </p>
    </div>
  );
}
