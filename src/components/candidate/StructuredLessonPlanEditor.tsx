'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Clock, Target, BookOpen, AlertCircle, Edit3 } from 'lucide-react';
import { resolveSubjectPacket } from '@/lib/questionBank';
import { MIN_LESSON_WORDS } from '@/lib/testRules';
import type { TypingRaw } from '@/lib/answerBehaviour';

interface StructuredLessonPlanEditorProps {
  subject: string;
  segment: string;
  questionPrompt?: string;
  rubricHint?: string;
  initialValue?: string;
  onChange: (compiledText: string) => void;
  /** Filled in as the candidate types, so how the plan was written can be reviewed. */
  typingRef?: React.MutableRefObject<TypingRaw>;
}

export default function StructuredLessonPlanEditor({
  subject,
  segment,
  questionPrompt,
  rubricHint,
  initialValue = '',
  onChange,
  typingRef
}: StructuredLessonPlanEditorProps) {
  const subjectPacket = resolveSubjectPacket(subject, segment);
  const activePrompt = questionPrompt || subjectPacket.theoryPrompt.question_text || `Design a comprehensive 35-minute Lesson Plan for ${subject} (${segment}).`;
  const activeHint = rubricHint || subjectPacket.theoryPrompt.rubric_hint || 'Include Learning Objectives, 35-Minute Chronological Pacing, Misconception Diagnosis, and Formative Assessment.';

  // Freeform text response state - initialized clean with no sample text
  const [lessonPlanText, setLessonPlanText] = useState<string>(initialValue);

  const lastKeyAt = React.useRef(0);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const stats = typingRef?.current;
    if (!stats || e.ctrlKey || e.metaKey || e.altKey) return;
    const isDelete = e.key === 'Backspace' || e.key === 'Delete';
    // Printable keys, plus the "Process" key an IME sends while composing.
    if (!isDelete && e.key.length !== 1 && e.key !== 'Process') return;
    const now = Date.now();
    if (lastKeyAt.current) {
      const gap = now - lastKeyAt.current;
      if (gap < 8000) stats.active_seconds += gap / 1000;
      if (gap >= 4000) stats.pauses_over_4s += 1;
    }
    lastKeyAt.current = now;
    if (isDelete) stats.deletions += 1;
    else stats.chars_typed += 1;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLessonPlanText(val);
    onChange(val);
  };

  const wordCount = lessonPlanText.trim() ? lessonPlanText.trim().split(/\s+/).length : 0;
  const minWords = MIN_LESSON_WORDS;
  const metMinimum = wordCount >= minWords;

  return (
    <div className="space-y-4 font-sans text-xs">
      
      {/* Lesson Plan Prompt & Guidelines Card */}
      <div className="bg-indigo-50/70 p-5 rounded-2xl border border-indigo-200 space-y-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              Part B · Lesson plan · {subject} ({segment})
            </span>
            <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
              {activePrompt}
            </h3>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-indigo-100 text-[11.5px] text-slate-600 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 font-bold">What the school looks for: </strong>
            {activeHint}
          </span>
        </div>
      </div>

      {/* Free-Form Response Writing Area */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span>Write your lesson plan</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span className={metMinimum ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
              {wordCount} of {minWords} words needed
            </span>
          </div>
        </div>

        <textarea
          rows={16}
          value={lessonPlanText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Write your lesson plan for ${subject} here.

A good plan covers:
1. The topic and what students will be able to do by the end
2. How you will use the 35 minutes (start, teach, practise, wrap up)
3. Mistakes students often make, and how you will fix them
4. How you will help weaker and stronger students
5. A quick check at the end to see who understood`}
          className="w-full p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 text-sm leading-relaxed focus:bg-white focus:border-indigo-600 focus:outline-none transition-colors font-sans placeholder:text-slate-500"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Write in your own words. You can use numbers and bullet points.</span>
          {metMinimum ? (
            <span className="text-emerald-700 font-bold">✓ Long enough</span>
          ) : (
            <span className="text-amber-700 font-bold">{minWords - wordCount} more word{minWords - wordCount === 1 ? '' : 's'} needed</span>
          )}
        </div>
      </div>

    </div>
  );
}
