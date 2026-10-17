'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, CheckCircle2, Pencil, Trash2, X, ShieldCheck, Info } from 'lucide-react';
import { HRPolicyDocument } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';
import {
  HR_POLICY_FIELD_DEFS,
  HrPolicyAnswers,
  formatHrAnswersAsPolicyText,
  missingRequiredHrFields,
} from '@/lib/hrPolicyTemplate';

const SECTIONS = Array.from(new Set(HR_POLICY_FIELD_DEFS.map((f) => f.section)));
const STRUCTURED_POLICY_TITLE = 'Faculty HR policy (structured)';

export default function SchoolPoliciesPage() {
  const [policies, setPolicies] = useState<HRPolicyDocument[]>([]);
  const [answers, setAnswers] = useState<HrPolicyAnswers>({});
  const [extraTitle, setExtraTitle] = useState('');
  const [extraContent, setExtraContent] = useState('');
  const [extraRequired, setExtraRequired] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const preview = useMemo(() => formatHrAnswersAsPolicyText(answers), [answers]);
  const missing = useMemo(() => missingRequiredHrFields(answers), [answers]);

  const load = async () => {
    const schoolId = localStorage.getItem('edcruiter_school_id') || SLOKA_SCHOOL_ID;
    const [polRes, schRes] = await Promise.all([
      fetch(`/api/hr-policies?school_id=${schoolId}`),
      fetch(`/api/schools?school_id=${schoolId}`),
    ]);
    const polData = await polRes.json();
    const schData = await schRes.json();
    setPolicies(polData.policies || []);
    if (schData.school?.hr_policy_answers) {
      setAnswers(schData.school.hr_policy_answers);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const setField = (id: string, value: string | number | boolean) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const saveStructured = async () => {
    if (missing.length) {
      setMessage(`Please fill required fields: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const schoolId = localStorage.getItem('edcruiter_school_id') || SLOKA_SCHOOL_ID;
      const content = formatHrAnswersAsPolicyText(answers);
      await fetch('/api/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          updates: { hr_policy_answers: answers },
        }),
      });
      // Updates the existing structured pack in place rather than creating a
      // new one on every save — this used to POST unconditionally, so
      // clicking "save" more than once left duplicate "Faculty HR policy
      // (structured)" entries in the list.
      const existingStructured = policies.find((p) => p.title === STRUCTURED_POLICY_TITLE);
      const res = await fetch('/api/hr-policies', {
        method: existingStructured ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          ...(existingStructured ? { id: existingStructured.id } : {}),
          title: STRUCTURED_POLICY_TITLE,
          content,
          generate: false,
          category: 'general',
          required: true,
        }),
      });
      const data = await res.json();
      if (data.policy) {
        setMessage('HR policy saved. Teachers will see this pack in stage 5.');
        load();
      } else {
        setMessage(data.error || 'Could not save policy');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetExtraForm = () => {
    setExtraTitle('');
    setExtraContent('');
    setExtraRequired(true);
    setEditingId(null);
  };

  const startEditingPolicy = (p: HRPolicyDocument) => {
    setEditingId(p.id);
    setExtraTitle(p.title);
    setExtraContent(p.content);
    setExtraRequired(p.required !== false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveExtra = async () => {
    if (!extraTitle.trim() || !extraContent.trim()) return;
    setSaving(true);
    try {
      const schoolId = localStorage.getItem('edcruiter_school_id') || SLOKA_SCHOOL_ID;
      if (editingId) {
        await fetch('/api/hr-policies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            id: editingId,
            title: extraTitle,
            content: extraContent,
            required: extraRequired,
          }),
        });
      } else {
        await fetch('/api/hr-policies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            school_id: schoolId,
            title: extraTitle,
            content: extraContent,
            generate: false,
            category: 'general',
            required: extraRequired,
          }),
        });
      }
      resetExtraForm();
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleRequired = async (p: HRPolicyDocument) => {
    const schoolId = localStorage.getItem('edcruiter_school_id') || SLOKA_SCHOOL_ID;
    await fetch('/api/hr-policies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: schoolId, id: p.id, required: !(p.required !== false) }),
    });
    load();
  };

  const deletePolicy = async (p: HRPolicyDocument) => {
    if (!confirm(`Remove "${p.title}"? Candidates will no longer see or need to acknowledge it.`)) return;
    const schoolId = localStorage.getItem('edcruiter_school_id') || SLOKA_SCHOOL_ID;
    await fetch(`/api/hr-policies?id=${encodeURIComponent(p.id)}&school_id=${encodeURIComponent(schoolId)}`, {
      method: 'DELETE',
    });
    if (editingId === p.id) resetExtraForm();
    load();
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recruiter workspace
        </Link>
        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Recruiter workspace</p>
          <h1 className="text-2xl font-black">Faculty HR policy</h1>
          <p className="text-sm text-slate-600">
            Fill the bare-minimum school fields (leaves, PF, accommodation, notice, safeguarding). The formatted policy is what teachers confirm in stage 5. You can still add extra free-text policies below.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {SECTIONS.map((section) => (
              <div key={section} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                <h2 className="text-sm font-black text-slate-900">{section}</h2>
                {HR_POLICY_FIELD_DEFS.filter((f) => f.section === section).map((field) => (
                  <label key={field.id} className="block text-xs font-bold text-slate-700">
                    {field.label}
                    {field.required ? ' *' : ''}
                    {field.type === 'boolean' ? (
                      <select
                        className="mt-1.5 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                        value={answers[field.id] === true ? 'yes' : answers[field.id] === false ? 'no' : ''}
                        onChange={(e) => setField(field.id, e.target.value === 'yes')}
                      >
                        <option value="">Select</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : field.type === 'select' ? (
                      <select
                        className="mt-1.5 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                        value={String(answers[field.id] ?? '')}
                        onChange={(e) => setField(field.id, e.target.value)}
                      >
                        <option value="">Select</option>
                        {(field.options || []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        className="mt-1.5 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm"
                        value={answers[field.id] === undefined || answers[field.id] === '' ? '' : String(answers[field.id])}
                        onChange={(e) =>
                          setField(
                            field.id,
                            field.type === 'number'
                              ? (e.target.value === '' ? '' : Number(e.target.value))
                              : e.target.value
                          )
                        }
                        placeholder={field.help || field.unit || ''}
                      />
                    )}
                  </label>
                ))}
              </div>
            ))}

            <button
              type="button"
              disabled={saving}
              onClick={saveStructured}
              className="brand-primary-btn w-full py-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save structured HR policy for teachers
            </button>
            {message && <p className="text-xs font-semibold text-slate-700">{message}</p>}
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-2">
              <h2 className="text-sm font-black text-slate-900">Teacher-facing preview</h2>
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-700 leading-relaxed min-h-[200px]">
                {preview || 'Fill the form to preview the policy pack.'}
              </pre>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900">
                  {editingId ? 'Edit policy' : 'Add a custom policy'}
                </h2>
                {editingId && (
                  <button type="button" onClick={resetExtraForm} className="text-[11px] font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
                    <X className="w-3.5 h-3.5" /> Cancel edit
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 -mt-1">
                Anything beyond the fixed fields on the left — a dress code, a leave-approval process, a campus-specific
                rule. You control exactly what exists here: add as many as you need, edit or remove any of them anytime.
              </p>
              <input
                value={extraTitle}
                onChange={(e) => setExtraTitle(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-bold"
                placeholder="Title"
              />
              <textarea
                value={extraContent}
                onChange={(e) => setExtraContent(e.target.value)}
                rows={5}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs"
                placeholder="Additional free-text policy"
              />
              <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 bg-slate-50 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={extraRequired}
                  onChange={(e) => setExtraRequired(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  <strong className="text-slate-800 block">Mandatory acknowledgment</strong>
                  <span className="text-slate-500">
                    Candidates must confirm they've read this before completing stage 5. Turn this off for policies
                    that are informational only.
                  </span>
                </span>
              </label>
              <button
                type="button"
                disabled={saving || !extraTitle.trim() || !extraContent.trim()}
                onClick={saveExtra}
                className="w-full py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {editingId ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingId ? 'Save changes' : 'Add policy'}
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-wide">
                  Custom policies ({policies.filter((p) => p.title !== STRUCTURED_POLICY_TITLE).length})
                </h2>
              </div>
              {policies.filter((p) => p.title !== STRUCTURED_POLICY_TITLE).length === 0 && (
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                  No custom policies yet. The structured fields on the left already cover the essentials — add one
                  here only if you need something beyond that.
                </div>
              )}
              {policies.filter((p) => p.title !== STRUCTURED_POLICY_TITLE).map((p) => {
                const isRequired = p.required !== false;
                return (
                  <article key={p.id} className="bg-white border border-slate-200 rounded-3xl p-5 text-xs shadow-sm space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-black text-sm text-slate-900">{p.title}</h2>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wide ${
                              isRequired ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {isRequired ? 'Mandatory' : 'Optional'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {p.updated_at ? `Updated ${new Date(p.updated_at).toLocaleDateString()}` : `Added ${new Date(p.uploaded_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleRequired(p)}
                          title={isRequired ? 'Make optional' : 'Make mandatory'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditingPolicy(p)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePolicy(p)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">{p.content}</pre>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
