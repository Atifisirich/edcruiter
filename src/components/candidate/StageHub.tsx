'use client';

import React from 'react';
import { ArrowRight, Camera, Check, Clock, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { STAGE_GUIDE, STAGE_ORDER } from '@/lib/candidateStageGuide';
import ApplicationIdCard from './ApplicationIdCard';

/**
 * The candidate's home page for the test: the five stages as a list, with the
 * next one ready to begin. Each stage is taken on its own, whenever the
 * candidate is ready, so this is where they land after every stage and every time
 * they come back with their link.
 */
export default function StageHub({
  doneKeys,
  candidateName,
  schoolName,
  applicationId,
  testReady,
  notice,
  onStart,
  onPractice,
}: {
  doneKeys: string[];
  candidateName: string;
  schoolName: string;
  applicationId?: string;
  testReady: boolean;
  /** A line shown above the list, such as "Stage 2 saved". */
  notice?: string;
  onStart: (key: (typeof STAGE_ORDER)[number]) => void;
  onPractice: () => void;
}) {
  const nextIndex = STAGE_ORDER.findIndex((k) => !doneKeys.includes(k));
  const first = doneKeys.length === 0;
  const firstName = (candidateName || '').trim().split(/\s+/)[0];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {notice && (
        <p role="status" className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm font-bold text-emerald-900">
          <Check className="w-5 h-5 shrink-0 text-emerald-600" /> {notice}
        </p>
      )}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">{schoolName || 'Your application'}</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
            {first ? `Welcome${firstName ? `, ${firstName}` : ''}` : `${doneKeys.length} of 5 stages done${firstName ? `, ${firstName}` : ''}`}
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            {first
              ? 'There are five short stages. Take them one at a time, whenever you are ready. Each is saved the moment you finish it.'
              : 'Carry on with the next stage whenever you are ready. Everything you finished is saved.'}
          </p>
        </div>

        {first && (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>About <strong>60 to 75 minutes</strong> in all. You can do a stage today and the next one tomorrow.</span></li>
            <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>Use a <strong>laptop or desktop</strong> with a camera and microphone, in a quiet room with good light.</span></li>
            <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>Stages 2 to 5 are watched: fullscreen, camera on, no copying, no other people. We take your photo now and check it is you each time.</span></li>
            <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>Finish a stage in one sitting. If you leave half way, you get <strong>different questions</strong> next time and the school sees you restarted.</span></li>
            <li className="flex gap-2.5"><span className="text-indigo-600 font-black">•</span><span>People at the school make every decision. AI only helps them review.</span></li>
          </ul>
        )}
      </section>

      {first && (
        <section className="rounded-3xl border-2 border-dashed border-indigo-200 bg-indigo-50/60 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-black text-slate-900"><Sparkles className="w-4 h-4 text-indigo-600" /> Try a practice test first</p>
            <p className="text-xs text-slate-600 max-w-md">Three sample questions, a sample lesson-plan box and a camera and microphone check. About 3 minutes. Not scored, and nothing is saved.</p>
          </div>
          <button type="button" onClick={onPractice} className="px-5 py-2.5 rounded-xl bg-white border border-indigo-300 text-indigo-800 text-sm font-bold hover:bg-indigo-50 cursor-pointer inline-flex items-center gap-2">
            <PlayCircle className="w-4 h-4" /> Start the practice
          </button>
        </section>
      )}

      <ol className="space-y-3">
        {STAGE_ORDER.map((key, i) => {
          const guide = STAGE_GUIDE[key];
          const done = doneKeys.includes(key);
          const isNext = i === nextIndex;
          return (
            <li
              key={key}
              className={`rounded-3xl border p-4 sm:p-5 flex flex-wrap items-center gap-4 ${
                isNext ? 'bg-white border-indigo-300 shadow-md ring-2 ring-indigo-100' : done ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white/60 border-slate-200'
              }`}
            >
              <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black ${done ? 'bg-emerald-600 text-white' : isNext ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {done ? <Check className="w-5 h-5" /> : isNext ? i + 1 : <Lock className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stage {i + 1}</p>
                <h3 className={`text-base font-black ${isNext || done ? 'text-slate-900' : 'text-slate-500'}`}>{guide.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{guide.summary}</p>
                <p className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {guide.time}</span>
                  {guide.camera && <span className="inline-flex items-center gap-1 text-indigo-700"><Camera className="w-3 h-3" /> Camera on</span>}
                </p>
              </div>
              <div className="shrink-0">
                {done ? (
                  <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">Done</span>
                ) : isNext ? (
                  <button
                    type="button"
                    onClick={() => onStart(key)}
                    disabled={!testReady && i > 0}
                    className="brand-primary-btn px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {i === 0 ? 'Start' : 'Begin'} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-xs font-bold text-slate-400">After stage {i}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!first && nextIndex >= 0 && (
        <p className="text-xs text-slate-500 text-center">Not ready for the next stage? Close this page. Come back with your link whenever you like.</p>
      )}

      {applicationId && <ApplicationIdCard code={applicationId} />}

      {!first && (
        <p className="text-center">
          <button type="button" onClick={onPractice} className="text-xs font-bold text-indigo-700 cursor-pointer hover:underline">Try the practice test again</button>
        </p>
      )}
    </div>
  );
}
