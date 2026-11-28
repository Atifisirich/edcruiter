'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, buttonClass, inputClass } from '@/components/admin/ui';
import { isHiringTeam } from '@/lib/permissions';
import { fillTemplate, OFFER_TAGS, STANDARD_LETTER, STARTER_TEMPLATE, tagsIn } from '@/lib/offerTemplates';
import type { OfferLetterDetails, OfferLetterTemplate } from '@/lib/types';

/** Made-up figures, only to show how a letter reads. Never sent. */
const SAMPLE: OfferLetterDetails = {
  candidate_id: '', candidate_name: 'Asha Reddy', candidate_email: '', candidate_phone: '', school_id: '', school_name: 'Your school',
  designation: 'Primary teacher', subject: 'English', grade_segment: 'Grades 1 to 5', branch_name: 'Main campus', branch_location: '',
  annual_ctc: '₹4,20,000', monthly_salary: '₹35,000', probation_period: '', notice_period: '', joining_date: '1 June 2027',
  reporting_authority: 'The Principal', issue_date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
};

type Draft = { id?: string; name: string; body: string };

/**
 * The school's own offer letters. Each is plain text with tags such as
 * {candidate_name} and {monthly_salary}, filled in for each teacher when HR
 * prepares an offer. The standard Edcruiter letter is always there too.
 */
export default function OfferLettersPage() {
  const { schoolId, user, toast } = useAdmin();
  const [templates, setTemplates] = useState<OfferLetterTemplate[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/offer-templates?school_id=${encodeURIComponent(schoolId)}`).catch(() => null);
    const d = r?.ok ? await r.json().catch(() => ({})) : {};
    setTemplates(d.templates ?? []);
  }, [schoolId]);
  useEffect(() => {
    if (!schoolId) return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [schoolId, load]);

  if (user && !isHiringTeam(user.role)) return <PageHeader title="Offer letters" description="Only HR and the school admin can see this." />;

  const save = async (next: { id?: string; name: string; body: string }[], done: string) => {
    setSaving(true);
    try {
      const r = await fetch('/api/offer-templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ school_id: schoolId, templates: next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast(d.error || 'That could not be saved. Try again.', 'error'); return false; }
      setTemplates(d.templates);
      toast(done, 'success');
      return true;
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft || !templates) return;
    const list = draft.id ? templates.map((t) => (t.id === draft.id ? { ...t, name: draft.name, body: draft.body } : t)) : [...templates, { name: draft.name, body: draft.body }];
    if (await save(list, `“${draft.name.trim()}” saved.`)) { setDraft(null); setPreview(false); }
  };

  const remove = async (t: OfferLetterTemplate) => {
    if (!templates || !window.confirm(`Delete the letter “${t.name}”? Letters already sent with it are kept.`)) return;
    await save(templates.filter((x) => x.id !== t.id), `“${t.name}” deleted.`);
  };

  const insertTag = (tag: string) => {
    if (!draft) return;
    const el = box.current;
    const at = el ? el.selectionStart : draft.body.length;
    const end = el ? el.selectionEnd : at;
    const body = `${draft.body.slice(0, at)}{${tag}}${draft.body.slice(end)}`;
    setDraft({ ...draft, body });
    requestAnimationFrame(() => { el?.focus(); const p = at + tag.length + 2; el?.setSelectionRange(p, p); });
  };

  const unknown = draft ? tagsIn(draft.body).unknown : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Offer letters"
        description="Keep your school's own offer letters here. When HR prepares an offer, they choose one, and the teacher's name, salary, campus and joining date are filled in."
        actions={!draft && <button type="button" onClick={() => { setDraft({ name: '', body: STARTER_TEMPLATE }); setPreview(false); }} className={buttonClass('primary')}><Plus className="w-4 h-4" /> Add a letter</button>}
      />

      {draft && (
        <Card>
          <CardHeader title={draft.id ? 'Edit letter' : 'New letter'} description="Write the letter as you want it. Click a tag to put it where your cursor is." />
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700">Name
              <input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Primary teacher letter" className={`${inputClass} mt-1`} />
            </label>
            <div className="flex flex-wrap gap-1.5" aria-label="Tags">
              {OFFER_TAGS.map((t) => (
                <button key={t.tag} type="button" onClick={() => insertTag(t.tag)} className="px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-800 hover:border-indigo-400 cursor-pointer">+ {t.label}</button>
              ))}
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setPreview(false)} className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${!preview ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Write</button>
              <button type="button" onClick={() => setPreview(true)} className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer ${preview ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Preview with sample details</button>
            </div>
            {preview ? (
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-800 min-h-[16rem]">{fillTemplate(draft.body, SAMPLE).text}</div>
            ) : (
              <textarea ref={box} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={16} aria-label="Letter" className={`${inputClass} font-mono !text-[13px] leading-relaxed`} />
            )}
            {unknown.length > 0 && <p role="alert" className="text-sm text-rose-700">{`{${unknown[0]}}`} is not a tag we can fill. Use the tag buttons above.</p>}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => { setDraft(null); setPreview(false); }} className={buttonClass('secondary')}>Cancel</button>
              <button type="button" disabled={saving || draft.name.trim().length < 2 || draft.body.trim().length < 20 || unknown.length > 0} onClick={() => void saveDraft()} className={buttonClass('primary')}>{saving ? 'Saving…' : 'Save letter'}</button>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false}>
        <ul className="divide-y divide-slate-100">
          <li className="flex items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{STANDARD_LETTER}</p>
                <p className="text-xs text-slate-500">Appointment letter with a salary table. Always available.</p>
              </div>
            </div>
            <Badge tone="slate">Built in</Badge>
          </li>
          {templates?.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">Changed {new Date(t.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{t.updated_by ? ` by ${t.updated_by}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => { setDraft({ id: t.id, name: t.name, body: t.body }); setPreview(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={buttonClass('secondary', 'sm')}><Pencil className="w-4 h-4" /> Edit</button>
                <button type="button" onClick={() => void remove(t)} aria-label={`Delete ${t.name}`} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
        </ul>
        {templates && templates.length === 0 && !draft && (
          <div className="border-t border-slate-100 p-5">
            <EmptyState Icon={FileText} title="No letters of your own yet" description="Add one to use your school's wording. Until then, offers use the standard letter." />
          </div>
        )}
      </Card>
    </div>
  );
}
