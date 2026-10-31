'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { STAGE_GUIDE, STAGE_ORDER } from '@/lib/candidateStageGuide';

/**
 * Where the candidate is in the five stages. On a phone it is one line and a
 * bar; from tablet width up it is five numbered steps. Finished stages can be
 * reopened to look back; later ones cannot be jumped to.
 */
export default function StageProgress({
  activeKey,
  completedKeys,
  onSelect,
}: {
  activeKey: string;
  completedKeys: string[];
  onSelect: (key: (typeof STAGE_ORDER)[number]) => void;
}) {
  const activeIndex = Math.max(0, STAGE_ORDER.indexOf(activeKey as (typeof STAGE_ORDER)[number]));
  const done = STAGE_ORDER.filter((k) => completedKeys.includes(k)).length;
  const active = STAGE_GUIDE[STAGE_ORDER[activeIndex]];

  return (
    <nav aria-label="Your progress" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5">
      {/* Phone: one line and a bar */}
      <div className="sm:hidden space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-black text-slate-900">
            Stage {activeIndex + 1} of {STAGE_ORDER.length}
            <span className="font-semibold text-slate-500"> · {active.short}</span>
          </p>
          <span className="text-[11px] font-bold text-slate-500 shrink-0">{done} done</span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {STAGE_ORDER.map((k, i) => (
            <span
              key={k}
              className={`h-1.5 flex-1 rounded-full ${
                completedKeys.includes(k) ? 'bg-indigo-600' : i === activeIndex ? 'bg-indigo-300' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Tablet and up: five steps */}
      <ol className="hidden sm:grid grid-cols-5 gap-2">
        {STAGE_ORDER.map((key, i) => {
          const guide = STAGE_GUIDE[key];
          const isDone = completedKeys.includes(key);
          const isActive = key === activeKey;
          const canOpen = isDone || isActive;
          return (
            <li key={key} className="relative">
              {i < STAGE_ORDER.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-4 left-[calc(50%+20px)] right-[calc(-50%+20px)] h-0.5 ${isDone ? 'bg-indigo-600' : 'bg-slate-200'}`}
                />
              )}
              <button
                type="button"
                disabled={!canOpen}
                aria-current={isActive ? 'step' : undefined}
                onClick={() => canOpen && onSelect(key)}
                className={`relative w-full flex flex-col items-center gap-1.5 text-center ${canOpen ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors ${
                    isDone
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : isActive
                      ? 'bg-white border-indigo-600 text-indigo-700 ring-4 ring-indigo-100'
                      : 'bg-white border-slate-300 text-slate-400'
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`text-xs font-bold leading-tight ${isActive ? 'text-slate-900' : isDone ? 'text-indigo-700' : 'text-slate-400'}`}>
                  {guide.short}
                </span>
                <span className={`text-[11px] ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>{guide.time}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
