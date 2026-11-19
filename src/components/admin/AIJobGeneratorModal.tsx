'use client';

import React, { useEffect, useState } from 'react';
import {
  Sparkles, X, Check, Copy, Share2, Video, BookOpen, ShieldCheck,
  Building2, MessageSquare, ArrowRight, CheckCircle2, FileText, Send,
  HelpCircle, Eye, ExternalLink
} from 'lucide-react';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import GradePicker from '@/components/admin/GradePicker';
import InterviewModePicker from '@/components/admin/InterviewModePicker';
import type { InterviewMode } from '@/lib/types';
import { CURRICULA, VACANCY_SUBJECTS, curriculumLabel } from '@/lib/subjects';

interface AIJobGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: (newJob: any) => void;
}

type SchoolBranch = { id: string; name: string; code?: string; location?: string };

export default function AIJobGeneratorModal({ isOpen, onClose, onJobCreated }: AIJobGeneratorModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'result'>('form');
  const [resultSubTab, setResultSubTab] = useState<'jd' | 'rubric' | 'whatsapp'>('jd');
  const [copiedText, setCopiedText] = useState(false);
  const [branches, setBranches] = useState<SchoolBranch[]>([]);

  // Form State — branch_id is what actually gets saved on the posting and
  // later used to route applicants to the right campus; branch (the name)
  // is derived from it for the generated job description's copy.
  const [formData, setFormData] = useState({
    title: '',
    subject: 'Physics',
    segment: 'Senior Secondary (Grades 11-12)',
    branch_id: '',
    experience: '3 – 6 Years Exp',
    salary_range: '₹7.8 LPA – ₹9.5 LPA'
  });

  const [generatedJob, setGeneratedJob] = useState<any>(null);
  const [grades, setGrades] = useState<string[]>([]);
  const [gradeError, setGradeError] = useState(false);
  // Each board is its own tick box; a vacancy can follow more than one.
  const [boards, setBoards] = useState<string[]>([]);
  const [boardError, setBoardError] = useState(false);
  const [interviewMode, setInterviewMode] = useState<InterviewMode>('five_stage');

  useEffect(() => {
    if (!isOpen) return;
    // This dropdown used to be hardcoded to three specific campus names
    // that only exist for the seeded demo school — any other school could
    // never post a job for their own actual branches. Now it's fetched
    // from the school's own setup.
    const schoolId = (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;
    fetch(`/api/schools?school_id=${schoolId}`)
      .then((r) => r.json())
      .then((d) => {
        const list: SchoolBranch[] = d.school?.branches || [];
        setBranches(list);
        if (list.length === 1) {
          setFormData((prev) => ({ ...prev, branch_id: list[0].id }));
        }
      })
      .catch(() => setBranches([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grades.length === 0) {
      setGradeError(true);
      return;
    }
    if (boards.length === 0) {
      setBoardError(true);
      return;
    }
    if (!formData.branch_id) return;
    setLoading(true);
    try {
      const selectedBranch = branches.find((b) => b.id === formData.branch_id);
      const res = await fetch('/api/generate-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Saved in the list's own order, whatever order they were ticked in.
          board: curriculumLabel(CURRICULA.filter((b) => boards.includes(b))),
          grades,
          interview_mode: interviewMode,
          branch: selectedBranch?.name || '',
          target_branch_id: formData.branch_id
        })
      });
      const data = await res.json();
      if (data.success && data.job) {
        setGeneratedJob(data.job);
        setActiveTab('result');
        if (onJobCreated) onJobCreated(data.job);
      }
    } catch (err) {
      console.error('Job generation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">New vacancy</h3>
              <p className="text-xs text-slate-500">Tell us about the role. We write the job description and set up how applicants are assessed.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {activeTab === 'form' ? (
            <form onSubmit={handleGenerate} className="space-y-5">

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">1</span> The role</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Job title *</span>
                    <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Senior PGT Physics Faculty" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Subject *</span>
                    <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                      {VACANCY_SUBJECTS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </label>
                </div>
                <div>
                  <GradePicker value={grades} onChange={(g) => { setGrades(g); setGradeError(false); }} label="Grades this vacancy is for" required />
                  {gradeError && <p className="mt-1.5 text-xs font-semibold text-rose-600">Choose at least one grade.</p>}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">2</span> Curriculum and campus</h4>
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700">Curriculum / board * <span className="font-normal text-slate-500">(tick every one that applies)</span></span>
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Curriculum / board">
                    {CURRICULA.map((b) => {
                      const on = boards.includes(b);
                      return (
                        <label key={b} className={'inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none transition-colors ' + (on ? 'bg-indigo-50 border-indigo-400 text-indigo-800 font-semibold' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400')}>
                          <input type="checkbox" checked={on} onChange={() => { setBoardError(false); setBoards((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b])); }} className="accent-indigo-600" />
                          {b}
                        </label>
                      );
                    })}
                  </div>
                  {boardError && <p className="text-xs font-semibold text-rose-600">Tick at least one curriculum.</p>}
                </div>
                <label className="block space-y-1.5 sm:max-w-sm">
                  <span className="text-xs font-bold text-slate-700">Campus *</span>
                  <select required value={formData.branch_id} onChange={e => setFormData({ ...formData, branch_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                    <option value="" disabled>{branches.length ? 'Select campus…' : 'Loading your campuses…'}</option>
                    {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                  {!branches.length && <span className="block text-[11px] text-slate-500">No campuses on file yet. Add one under School Setup first.</span>}
                </label>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">3</span> Experience and pay</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Experience</span>
                    <input type="text" value={formData.experience} onChange={e => setFormData({ ...formData, experience: e.target.value })} placeholder="e.g. 3 – 6 years" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Salary</span>
                    <input type="text" value={formData.salary_range} onChange={e => setFormData({ ...formData, salary_range: e.target.value })} placeholder="e.g. ₹7.8 LPA – ₹9.5 LPA" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <h4 className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">4</span> How applicants are assessed</h4>
                <InterviewModePicker value={interviewMode} onChange={setInterviewMode} legend="Pick one. You can change it later." />
              </section>

              <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-slate-500 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{interviewMode === 'ai' ? 'We write the job description, set up the AI interview and make a WhatsApp invite.' : interviewMode === 'both' ? 'We write the job description and the test, add the AI interview and make a WhatsApp invite.' : 'We write the job description and the test, and make a WhatsApp invite.'}</span>
                </span>
                <button type="submit" disabled={loading} className="brand-primary-btn px-6 py-3 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-60">
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Writing your vacancy…' : 'Create vacancy'}</span>
                </button>
              </div>

            </form>
          ) : (
            /* Results View */
            <div className="space-y-5">
              
              {/* Top Sub-Tab Switcher */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setResultSubTab('jd')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      resultSubTab === 'jd'
                        ? 'brand-primary-btn text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>1. Job Description & Criteria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultSubTab('rubric')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      resultSubTab === 'rubric'
                        ? 'brand-primary-btn text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>2. AI Test & Video Rubric</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultSubTab('whatsapp')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      resultSubTab === 'whatsapp'
                        ? 'brand-primary-btn text-white shadow-xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>3. WhatsApp Campaign Link</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className="text-zinc-500 hover:text-indigo-600 font-bold underline cursor-pointer"
                >
                  ← Edit Criteria
                </button>
              </div>

              {/* Sub-Tab 1: Job Description */}
              {resultSubTab === 'jd' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-900">{generatedJob?.title}</h4>
                        <p className="text-[11px] text-zinc-500">{generatedJob?.branch} • {generatedJob?.board} • {generatedJob?.salary_range}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(JSON.stringify(generatedJob, null, 2))}
                        className="px-3 py-1.5 rounded-xl secondary-nav-btn flex items-center gap-1.5 font-bold cursor-pointer"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied!' : 'Copy JD'}</span>
                      </button>
                    </div>

                    <p className="text-zinc-700 leading-relaxed">{generatedJob?.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                      <strong className="text-zinc-900 block font-bold">Key Responsibilities:</strong>
                      <ul className="space-y-1.5 text-zinc-600">
                        {generatedJob?.responsibilities.map((r: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2">
                      <strong className="text-zinc-900 block font-bold">Mandatory Qualifications:</strong>
                      <ul className="space-y-1.5 text-zinc-600">
                        {generatedJob?.requirements.map((req: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: AI Assessment Rubric */}
              {resultSubTab === 'rubric' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 block">
                        Auto-Generated 5-Stage Test Configuration
                      </span>
                      <strong className="text-zinc-900 text-xs">
                        Topic: {generatedJob?.ai_assessment_rubric.stage_2_lesson_plan_topic}
                      </strong>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white text-indigo-600 border border-indigo-200">
                      5 Stages Configured
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                    <strong className="text-zinc-900 font-bold block flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-indigo-500" />
                      Stage 3: 5-Minute Micro-Teaching Video Prompt
                    </strong>
                    <p className="p-3 bg-slate-50 rounded-xl text-zinc-700 font-mono text-[11px] leading-relaxed">
                      &ldquo;{generatedJob?.ai_assessment_rubric.stage_3_micro_teaching_prompt}&rdquo;
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                    <strong className="text-zinc-900 font-bold block">
                      Sample Diagnostic MCQs Generated by AI:
                    </strong>
                    <div className="space-y-3">
                      {generatedJob?.ai_assessment_rubric.stage_1_mcqs.map((mcq: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                          <span className="font-bold text-zinc-900">{idx + 1}. {mcq.question}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                            {mcq.options.map((opt: string, optIdx: number) => (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg border ${
                                  optIdx === mcq.correct_answer
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                    : 'bg-white border-slate-200 text-zinc-600'
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}. {opt} {optIdx === mcq.correct_answer && '✓ (Key)'}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: WhatsApp Campaign Link */}
              {resultSubTab === 'whatsapp' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        Candidate WhatsApp Invitation Template
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedJob?.whatsapp_invite_template)}
                        className="px-3 py-1.5 rounded-xl brand-primary-btn text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedText ? 'Copied Message!' : 'Copy WhatsApp Message'}</span>
                      </button>
                    </div>

                    <pre className="p-4 rounded-xl bg-white border border-slate-300 font-mono text-[11px] text-zinc-800 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {generatedJob?.whatsapp_invite_template}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <strong className="text-emerald-900 block font-bold">
                        Live Proctored Test URL Ready
                      </strong>
                      <span className="text-zinc-500 text-[11px] font-mono">
                        https://edcruiter.ai{generatedJob?.shareable_candidate_link}
                      </span>
                    </div>

                    <a
                      href={generatedJob?.shareable_candidate_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl secondary-nav-btn font-bold flex items-center gap-1.5"
                    >
                      <span>Preview Test</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Action Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl secondary-nav-btn font-bold cursor-pointer"
                >
                  Done
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedJob?.whatsapp_invite_template)}
                    className="px-4 py-2.5 rounded-xl secondary-nav-btn font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copy Invite</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="brand-primary-btn px-6 py-2.5 rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Publish Vacancy to Admin Studio</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
