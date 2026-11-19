'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import GradePicker from '@/components/admin/GradePicker';
import InterviewModePicker from '@/components/admin/InterviewModePicker';
import { inputClass, selectClass, buttonClass } from '@/components/admin/ui';
import { cleanGrades, gradesFromSegment } from '@/lib/grades';
import { CURRICULA, VACANCY_SUBJECTS, curriculumLabel, followsBoard } from '@/lib/subjects';
import type { InterviewMode, PublicVacancy, Branch } from '@/lib/types';

const toLines = (list?: string[]) => (list ?? []).join('\n');
const fromLines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

/**
 * Change a vacancy that is already posted. Everything a school can set when it
 * posts one can be changed here, plus whether it is open or closed. People who
 * already applied are not affected.
 */
export default function EditVacancyModal({
  job,
  branches,
  onClose,
  onSaved,
}: {
  job: PublicVacancy;
  branches: Branch[];
  onClose: () => void;
  onSaved: (job: PublicVacancy) => void;
}) {
  const [title, setTitle] = useState(job.title);
  const [subject, setSubject] = useState(job.subject);
  const [grades, setGrades] = useState<string[]>(() => cleanGrades(job.grades?.length ? job.grades : gradesFromSegment(job.segment)));
  const [boards, setBoards] = useState<string[]>(() => CURRICULA.filter((b) => followsBoard(job.board, b)));
  const [branchId, setBranchId] = useState(job.target_branch_id || branches.find((b) => b.name === job.branch)?.id || '');
  const [experience, setExperience] = useState(job.experience_required || '');
  const [salary, setSalary] = useState(job.salary_range || '');
  const [description, setDescription] = useState(job.description || '');
  const [responsibilities, setResponsibilities] = useState(toLines(job.responsibilities));
  const [requirements, setRequirements] = useState(toLines(job.requirements));
  const [open, setOpen] = useState(job.status !== 'closed');
  const [urgent, setUrgent] = useState(Boolean(job.is_urgent));
  const [mode, setMode] = useState<InterviewMode>(job.interview_mode ?? 'five_stage');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const subjects = useMemo(
    () => ((VACANCY_SUBJECTS as readonly string[]).includes(job.subject) ? [...VACANCY_SUBJECTS] : [job.subject, ...VACANCY_SUBJECTS]),
    [job.subject]
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give the vacancy a title.');
    if (grades.length === 0) return setError('Choose at least one grade.');
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          subject,
          grades,
          // Keeps the board text a school typed before the tick boxes existed, unless they tick something.
          board: boards.length ? curriculumLabel(CURRICULA.filter((b) => boards.includes(b))) : job.board,
          ...(branchId ? { target_branch_id: branchId } : {}),
          experience_required: experience,
          salary_range: salary,
          description,
          responsibilities: fromLines(responsibilities),
          requirements: fromLines(requirements),
          is_urgent: urgent,
          interview_mode: mode,
          status: open ? 'active' : 'closed',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job) {
        setError(data.error || 'Could not save the changes. Try again.');
        return;
      }
      onSaved(data.job);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Edit vacancy">
      <form onSubmit={save} className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Edit vacancy</h2>
            <p className="text-xs text-slate-500">Changes show on the job page straight away. People who already applied are not affected.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Job title *">
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Subject *">
              <select className={`${selectClass} w-full`} value={subject} onChange={(e) => setSubject(e.target.value)}>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <GradePicker value={grades} onChange={setGrades} label="Grades this vacancy is for" required />

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Curriculum / board <span className="font-normal text-slate-500">(tick every one that applies)</span></span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Curriculum / board">
              {CURRICULA.map((b) => {
                const on = boards.includes(b);
                return (
                  <label key={b} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none ${on ? 'bg-indigo-50 border-indigo-400 text-indigo-800' : 'bg-white border-slate-300 text-slate-700'}`}>
                    <input type="checkbox" className="accent-indigo-600" checked={on} onChange={() => setBoards((p) => (p.includes(b) ? p.filter((x) => x !== b) : [...p, b]))} />
                    {b}
                  </label>
                );
              })}
            </div>
            {boards.length === 0 && job.board && <p className="text-[11px] text-slate-500">Currently shown as &quot;{job.board}&quot;. Tick a board to replace it.</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Campus">
              <select className={`${selectClass} w-full`} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {!branchId && <option value="">{job.branch || 'Not set'}</option>}
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
            <Field label="Experience">
              <input className={inputClass} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 3 to 6 years" />
            </Field>
            <Field label="Salary">
              <input className={inputClass} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. 7.8 to 9.5 LPA" />
            </Field>
          </div>

          <Field label="About the job">
            <textarea className={`${inputClass} min-h-[96px]`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Responsibilities" hint="One per line.">
              <textarea className={`${inputClass} min-h-[120px]`} value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} />
            </Field>
            <Field label="Requirements" hint="One per line.">
              <textarea className={`${inputClass} min-h-[120px]`} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
            </Field>
          </div>

          <InterviewModePicker value={mode} onChange={setMode} />

          <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-600" checked={open} onChange={(e) => setOpen(e.target.checked)} />
              <span><strong className="text-slate-900">Open for applications.</strong> <span className="text-slate-600">Untick to close it: it leaves the public job board, and nobody new can apply.</span></span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-indigo-600" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              <span><strong className="text-slate-900">Mark as urgent.</strong> <span className="text-slate-600">Shows an urgent tag on the job board.</span></span>
            </label>
          </div>

          {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onClose} className={buttonClass('secondary')}>Cancel</button>
          <button type="submit" disabled={saving} className={buttonClass('primary')}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
