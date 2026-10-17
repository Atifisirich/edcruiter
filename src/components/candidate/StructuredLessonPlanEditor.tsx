'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Sparkles, Clock, Target, BookOpen, AlertCircle, Edit3 } from 'lucide-react';
import { resolveSubjectPacket } from '@/lib/questionBank';

interface StructuredLessonPlanEditorProps {
  subject: string;
  segment: string;
  questionPrompt?: string;
  rubricHint?: string;
  initialValue?: string;
  onChange: (compiledText: string) => void;
}

export default function StructuredLessonPlanEditor({
  subject,
  segment,
  questionPrompt,
  rubricHint,
  initialValue = '',
  onChange
}: StructuredLessonPlanEditorProps) {
  const subjectPacket = resolveSubjectPacket(subject, segment);
  const activePrompt = questionPrompt || subjectPacket.theoryPrompt.question_text || `Design a comprehensive 35-minute Lesson Plan for ${subject} (${segment}).`;
  const activeHint = rubricHint || subjectPacket.theoryPrompt.rubric_hint || 'Include Learning Objectives, 35-Minute Chronological Pacing, Misconception Diagnosis, and Formative Assessment.';

  // Freeform text response state - initialized clean with no sample text
  const [lessonPlanText, setLessonPlanText] = useState<string>(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLessonPlanText(val);
    onChange(val);
  };

  const wordCount = lessonPlanText.trim() ? lessonPlanText.trim().split(/\s+/).length : 0;
  const charCount = lessonPlanText.length;

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
              Lesson Plan &amp; Pedagogy Task • {subject} ({segment})
            </span>
            <h3 className="font-extrabold text-sm text-slate-900 leading-snug">
              {activePrompt}
            </h3>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-indigo-100 text-[11.5px] text-slate-600 leading-relaxed flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-900 font-bold">Evaluation Criteria: </strong>
            {activeHint}
          </span>
        </div>
      </div>

      {/* Free-Form Response Writing Area */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <Edit3 className="w-4 h-4 text-indigo-600" />
            <span>Your Lesson Plan Response</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{charCount} characters</span>
          </div>
        </div>

        <textarea
          rows={14}
          value={lessonPlanText}
          onChange={handleChange}
          placeholder={`Write your complete lesson plan here for ${subject}...

Structure your response with:
1. Topic & Learning Objectives (SMART)
2. 35-Minute Lesson Pacing (Hook, Direct Instruction, Guided Practice, Wrap-up)
3. Addressing Common Student Misconceptions
4. Differentiated Instruction for Diverse Learners
5. Exit Ticket / Formative Assessment Questions`}
          className="w-full p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 text-xs leading-relaxed focus:bg-white focus:border-indigo-600 focus:outline-none transition-colors font-sans placeholder:text-slate-500"
        />

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>* Type your response in free-form. Formatting with bullet points and numbers is supported.</span>
          {wordCount >= 50 && (
            <span className="text-emerald-600 font-bold">✓ Ready for submission</span>
          )}
        </div>
      </div>

    </div>
  );
}
