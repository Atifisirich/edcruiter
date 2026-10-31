'use client';

import React, { useEffect, useState } from 'react';
import {
  Sparkles, X, Check, Copy, Share2, Video, BookOpen, ShieldCheck,
  Building2, MessageSquare, ArrowRight, CheckCircle2, FileText, Send,
  HelpCircle, Eye, ExternalLink
} from 'lucide-react';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import GradePicker from '@/components/admin/GradePicker';

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
    board: 'CBSE & Cambridge IGCSE',
    branch_id: '',
    experience: '3 – 6 Years Exp',
    salary_range: '₹7.8 LPA – ₹9.5 LPA'
  });

  const [generatedJob, setGeneratedJob] = useState<any>(null);
  const [grades, setGrades] = useState<string[]>([]);
  const [gradeError, setGradeError] = useState(false);

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
    if (!formData.branch_id) return;
    setLoading(true);
    try {
      const selectedBranch = branches.find((b) => b.id === formData.branch_id);
      const res = await fetch('/api/generate-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          grades,
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
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-all">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                  AI Vacancy Generator
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 uppercase">
                  Recruiter
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Generate board-calibrated JDs, qualification rubrics, custom MCQs, and WhatsApp candidate invite links.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {activeTab === 'form' ? (
            <form onSubmit={handleGenerate} className="space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Position / Role Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Senior PGT Physics Faculty"
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Academic Subject *
                  </label>
                  <select
                    value={formData.subject}
                    onChange={e => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white font-bold focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Biology">Biology</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="English">English Literature & Pedagogy</option>
                    <option value="Computer Science">Computer Science & AI</option>
                    <option value="Social Studies">Social Studies & History</option>
                    <option value="Primary Homeroom">Primary Homeroom Lead</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <GradePicker value={grades} onChange={(g) => { setGrades(g); setGradeError(false); }} label="Grades this vacancy is for" required />
                  {gradeError && <p className="mt-1 text-sm text-rose-600">Choose at least one grade.</p>}
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Curriculum / Board Alignment *
                  </label>
                  <select
                    value={formData.board}
                    onChange={e => setFormData({ ...formData, board: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="CBSE & Cambridge IGCSE">CBSE & Cambridge IGCSE</option>
                    <option value="CBSE Board (Central)">CBSE Board (Central)</option>
                    <option value="Cambridge IGCSE & A-Levels">Cambridge IGCSE & A-Levels</option>
                    <option value="IB World School (PYP/MYP/DP)">IB World School (PYP/MYP/DP)</option>
                    <option value="ICSE / ISC Board">ICSE / ISC Board</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Target Branch / Campus *
                  </label>
                  <select
                    required
                    value={formData.branch_id}
                    onChange={e => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>{branches.length ? 'Select campus…' : 'Loading your campuses…'}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {!branches.length && (
                    <p className="text-[10.5px] text-zinc-400 mt-1">
                      No branches on file yet — add one under School Setup first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-bold mb-1.5">
                    Experience & Salary Band *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.experience}
                      onChange={e => setFormData({ ...formData, experience: e.target.value })}
                      placeholder="e.g. 3 – 6 Years"
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={formData.salary_range}
                      onChange={e => setFormData({ ...formData, salary_range: e.target.value })}
                      placeholder="e.g. ₹7.8 - ₹9.5 LPA"
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-800 text-zinc-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Includes automatic 5-stage test generation & WhatsApp invite link</span>
                </span>

                <button
                  type="submit"
                  disabled={loading}
                  className="brand-primary-btn px-6 py-3 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'AI Generating Role & Test Suite...' : 'Generate with AI →'}</span>
                </button>
              </div>

            </form>
          ) : (
            /* Results View */
            <div className="space-y-5">
              
              {/* Top Sub-Tab Switcher */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setResultSubTab('jd')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      resultSubTab === 'jd'
                        ? 'brand-primary-btn text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{generatedJob?.title}</h4>
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

                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{generatedJob?.summary}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                      <strong className="text-zinc-900 dark:text-white block font-bold">Key Responsibilities:</strong>
                      <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-300">
                        {generatedJob?.responsibilities.map((r: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                      <strong className="text-zinc-900 dark:text-white block font-bold">Mandatory Qualifications:</strong>
                      <ul className="space-y-1.5 text-zinc-600 dark:text-zinc-300">
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
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 block">
                        Auto-Generated 5-Stage Test Configuration
                      </span>
                      <strong className="text-zinc-900 dark:text-white text-xs">
                        Topic: {generatedJob?.ai_assessment_rubric.stage_2_lesson_plan_topic}
                      </strong>
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                      5 Stages Configured
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                    <strong className="text-zinc-900 dark:text-white font-bold block flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-indigo-500" />
                      Stage 3: 5-Minute Micro-Teaching Video Prompt
                    </strong>
                    <p className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-mono text-[11px] leading-relaxed">
                      &ldquo;{generatedJob?.ai_assessment_rubric.stage_3_micro_teaching_prompt}&rdquo;
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                    <strong className="text-zinc-900 dark:text-white font-bold block">
                      Sample Diagnostic MCQs Generated by AI:
                    </strong>
                    <div className="space-y-3">
                      {generatedJob?.ai_assessment_rubric.stage_1_mcqs.map((mcq: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700 space-y-1.5">
                          <span className="font-bold text-zinc-900 dark:text-white">{idx + 1}. {mcq.question}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                            {mcq.options.map((opt: string, optIdx: number) => (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg border ${
                                  optIdx === mcq.correct_answer
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300 font-bold'
                                    : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
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
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
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

                    <pre className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-slate-300 dark:border-zinc-800 font-mono text-[11px] text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                      {generatedJob?.whatsapp_invite_template}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-between">
                    <div>
                      <strong className="text-emerald-900 dark:text-emerald-300 block font-bold">
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
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
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
