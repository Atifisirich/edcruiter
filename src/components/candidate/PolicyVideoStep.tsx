'use client';

import React, { useRef } from 'react';
import { CheckCircle2, Film, Lock, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { PolicyQuestion } from '@/lib/types';
import { MAX_REASON_CHARS } from '@/lib/policyVideo';

export type PolicyAnswerDraft = { agreed?: boolean; reason: string };

/**
 * Stage 5, candidate side: the school's policy video, which must play to the
 * end (no skipping ahead), then a "Do you agree…?" question for each policy.
 * A "don't agree" is allowed, with an optional reason; the school sees it.
 */
export default function PolicyVideoStep({
  schoolId,
  video,
  questions,
  watched,
  onWatched,
  answers,
  onAnswer,
}: {
  schoolId: string;
  video: { id: string; title: string } | null;
  questions: PolicyQuestion[];
  watched: boolean;
  onWatched: () => void;
  answers: Record<string, PolicyAnswerDraft>;
  onAnswer: (questionId: string, answer: PolicyAnswerDraft) => void;
}) {
  // The furthest point played so far. Seeking back is fine; seeking past it is undone.
  const furthest = useRef(0);
  const ref = useRef<HTMLVideoElement>(null);
  const open = !video || watched;
  const answered = questions.filter((q) => typeof answers[q.id]?.agreed === 'boolean').length;

  return (
    <div className="space-y-5">
      {video && (
        <div className="space-y-2">
          <h4 className="font-black text-slate-900 flex items-center gap-2 text-sm">
            <Film className="w-4 h-4 text-indigo-600" /> {video.title}
          </h4>
          <video
            ref={ref}
            src={`/api/policy-video/stream?school_id=${encodeURIComponent(schoolId)}&v=${video.id}`}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            preload="metadata"
            className="w-full max-h-[60vh] rounded-2xl bg-black border border-slate-200"
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              if (t > furthest.current && t - furthest.current < 2) furthest.current = t;
            }}
            onSeeking={(e) => {
              const el = e.currentTarget;
              if (!watched && el.currentTime > furthest.current + 1) el.currentTime = furthest.current;
            }}
            onRateChange={(e) => { if (e.currentTarget.playbackRate > 1) e.currentTarget.playbackRate = 1; }}
            onEnded={() => onWatched()}
          />
          <p className={`text-xs flex items-center gap-1.5 ${watched ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
            {watched ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
            {watched
              ? 'Watched. Now answer the questions below.'
              : 'Watch the whole video. You cannot skip ahead. The questions open when it ends.'}
          </p>
        </div>
      )}

      {open && questions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="font-black text-slate-900 text-sm">Do you agree?</h4>
            <span className="text-xs text-slate-500">{answered} of {questions.length} answered</span>
          </div>
          <p className="text-xs text-slate-500">Answer honestly. Saying you don&apos;t agree will not stop your application; the school will see your answer and reason.</p>
          <ol className="space-y-2.5">
            {questions.map((q, i) => {
              const a = answers[q.id] ?? { reason: '' };
              return (
                <li key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <p className="text-sm font-semibold text-slate-900">{i + 1}. {q.text}</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Answer to question ${i + 1}`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={a.agreed === true}
                      onClick={() => onAnswer(q.id, { agreed: true, reason: '' })}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                        a.agreed === true ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" /> I agree
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={a.agreed === false}
                      onClick={() => onAnswer(q.id, { agreed: false, reason: a.reason })}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                        a.agreed === false ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-rose-400'
                      }`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" /> I don&apos;t agree
                    </button>
                  </div>
                  {a.agreed === false && (
                    <label className="block text-xs text-slate-600">
                      Why not? (optional)
                      <textarea
                        value={a.reason}
                        onChange={(e) => onAnswer(q.id, { agreed: false, reason: e.target.value })}
                        maxLength={MAX_REASON_CHARS}
                        rows={2}
                        className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
