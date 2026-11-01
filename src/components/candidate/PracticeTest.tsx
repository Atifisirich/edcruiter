'use client';

import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import DeviceCheck from './DeviceCheck';
import { countWords } from '@/lib/testRules';

const SAMPLES = [
  { q: 'Which of these is a fruit?', options: ['Chair', 'Mango', 'Pencil', 'Window'], answer: 'Mango' },
  { q: 'What is 6 + 7?', options: ['11', '12', '13', '14'], answer: '13' },
  { q: 'How many days are there in a week?', options: ['5', '6', '7', '8'], answer: '7' },
];

/**
 * A practice run of the real thing with made-up content: multiple-choice
 * questions with a progress count, a lesson-plan box, and the camera and
 * microphone check. Nothing here is scored or saved. It lets a candidate see how
 * the test works before the first stage that counts.
 */
export default function PracticeTest({ onBack }: { onBack: () => void }) {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [text, setText] = useState('');
  const [pasteNote, setPasteNote] = useState(false);
  const answered = Object.keys(picked).length;
  const words = countWords(text);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to my stages
      </button>

      <div className="bg-indigo-600 text-white rounded-3xl p-5 sm:p-6 space-y-1.5">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-200">Practice test</p>
        <h2 className="text-xl sm:text-2xl font-black leading-tight">Try it once. Nothing here counts.</h2>
        <p className="text-sm text-indigo-100">The real subject test works the same way, with more questions. You will see marks for these right away; in the real test you will not.</p>
      </div>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">Part A</p>
            <h3 className="text-base font-black text-slate-900">Choose one answer for each</h3>
          </div>
          <span className={`text-sm font-black ${answered === SAMPLES.length ? 'text-emerald-700' : 'text-slate-700'}`}>{answered} of {SAMPLES.length} done</span>
        </div>
        {SAMPLES.map((s, i) => (
          <fieldset key={s.q} className={`space-y-2 pt-3 ${i > 0 ? 'border-t border-slate-100' : ''}`}>
            <legend className="text-sm font-bold text-slate-900">{i + 1}. {s.q}</legend>
            <div className="space-y-1.5">
              {s.options.map((opt) => (
                <label key={opt} className={`flex items-center gap-3 p-3 rounded-xl border text-sm cursor-pointer ${picked[i] === opt ? 'border-indigo-500 bg-indigo-50 font-semibold text-indigo-900' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <input type="radio" name={`practice-${i}`} checked={picked[i] === opt} onChange={() => setPicked((p) => ({ ...p, [i]: opt }))} className="w-4 h-4 accent-indigo-600" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
            {picked[i] && (
              <p className={`flex items-center gap-1.5 text-xs font-bold ${picked[i] === s.answer ? 'text-emerald-700' : 'text-rose-700'}`}>
                {picked[i] === s.answer ? <><CheckCircle2 className="w-4 h-4" /> Right.</> : <><XCircle className="w-4 h-4" /> The answer is {s.answer}.</>}
              </p>
            )}
          </fieldset>
        ))}
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700">Part B</p>
          <h3 className="text-base font-black text-slate-900">Write in your own words</h3>
          <p className="text-xs text-slate-500 mt-0.5">Practice task: in a few sentences, say how you would start a class on a Monday morning. The real lesson plan needs more words, and the box shows you how many you have.</p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => { e.preventDefault(); setPasteNote(true); }}
          rows={5}
          placeholder="Type here"
          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-600">{words} words</span>
          {pasteNote && <span className="text-amber-800 font-semibold">Pasting is blocked, here and in the real test. Type your own answer.</span>}
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
        <h3 className="text-base font-black text-slate-900">Camera and microphone</h3>
        <p className="text-xs text-slate-500">The timed stages use both. Try them now so there are no surprises later. Nothing is recorded here.</p>
        <DeviceCheck withMic onReady={() => {}} />
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={onBack} className="brand-primary-btn px-8 py-3.5 rounded-2xl font-bold text-sm shadow-xl cursor-pointer">
          I understand. Back to my stages
        </button>
      </div>
    </div>
  );
}
