'use client';

import React, { useState } from 'react';
import { CheckCircle2, Copy, Send, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { buttonClass, inputClass, selectClass } from './ui';
import { useAdmin } from './adminContext';
import GradePicker from './GradePicker';
import { segmentFromGrades } from '@/lib/grades';

const SUBJECTS = ['Physics', 'Mathematics', 'Biology', 'Chemistry', 'English', 'Computer Science'];

const QUALIFICATIONS = [
  'M.Sc + B.Ed (Post Graduate)',
  'B.Sc + B.Ed (Graduate Teacher)',
  'M.A + B.Ed (Literature / Social)',
  'B.A + B.Ed',
  'Ph.D / Doctorate in Subject',
  'B.Tech + B.Ed (Computer Science)',
  'M.Ed / CTET Paper 2 Qualified',
];

const EXPERIENCE = ['Fresher (0 - 1 Year)', '1 – 2 Years', '3 – 5 Years', '5 – 8 Years', '8+ Years (Senior Faculty / HOD)'];

// Every field starts genuinely blank. A form that opens pre-filled with
// realistic-looking values gets submitted with fabricated details when someone
// clicks through, so each dropdown opens on an explicit "Select…".
const BLANK = {
  name: '',
  email: '',
  phone: '',
  applied_subject: '',
  qualification: '',
  experience_band: '',
  prior_org: '',
  target_branch_id: '',
};

interface Created {
  name: string;
  code: string;
  id: string;
  /** What happened when the school asked for the WhatsApp invite to go out automatically. */
  invite?: { sent: boolean; reason?: string; detail?: string };
}

const INVITE_PROBLEM: Record<string, string> = {
  no_consent: 'It was not sent because you did not confirm permission to contact them.',
  no_phone: 'It was not sent because there is no phone number.',
  not_connected: 'It was not sent because your WhatsApp number is not connected yet.',
  rate_limited: 'It was not sent because WhatsApp’s daily limit for new numbers was reached. Send it tomorrow.',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

export default function AddCandidateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { school, schoolId, refresh, toast } = useAdmin();
  const [form, setForm] = useState(BLANK);
  const [grades, setGrades] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [sending, setSending] = useState(false);
  // The school vouches that it may contact this person; only then can an invite be sent for them.
  const [attested, setAttested] = useState(false);
  const [sendInvite, setSendInvite] = useState(true);
  const whatsappConnected = !!school?.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected';
  const willSend = attested && sendInvite && whatsappConnected;

  if (!isOpen) return null;

  const set = (key: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const close = () => {
    setForm(BLANK);
    setGrades([]);
    setCreated(null);
    setAttested(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast('Please give a name and an email.', 'error');
      return;
    }
    if (grades.length === 0) {
      toast('Choose at least one grade.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          ...form,
          applied_segment: segmentFromGrades(grades),
          applied_grades: grades,
          status: 'in_progress',
          school_attested: attested,
          send_invite: willSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || 'Could not add this candidate.', 'error');
        return;
      }
      if (data.candidate) {
        setCreated({ name: data.candidate.name, code: data.candidate.invite_code || data.candidate.id, id: data.candidate.id, invite: data.invite });
        setForm(BLANK);
        setGrades([]);
        await refresh();
      }
    } catch {
      toast('Could not add this candidate. Check your connection and try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const link = created && typeof window !== 'undefined' ? `${window.location.origin}/candidate/${created.id}` : '';

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(`Code: ${created.code}\nLink: ${link}`);
      toast('Code and link copied.', 'success');
    } catch {
      toast('Could not copy. Select the text and copy it.', 'error');
    }
  };

  const sendOnWhatsApp = async () => {
    if (!created) return;
    setSending(true);
    try {
      const res = await fetch('/api/whatsapp/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, candidate_id: created.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) toast('Invite sent on WhatsApp.', 'success');
      else toast(data.error || 'Could not send the WhatsApp invite.', 'error');
    } finally {
      setSending(false);
    }
  };

  const whatsappReady = !!school?.whatsapp_hiring?.e164;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Add a candidate">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            {created ? 'Candidate added' : 'Add a candidate'}
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {created ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-900">
                {created.invite?.sent ? (
                  <>
                    <strong>{created.name}</strong> is added, and their test invite was sent on WhatsApp.
                  </>
                ) : (
                  <>
                    <strong>{created.name}</strong> is added. Send them this test code or link.
                    {created.invite && !created.invite.sent && (
                      <span className="block mt-1 text-amber-800">
                        {INVITE_PROBLEM[created.invite.reason || ''] || created.invite.detail || 'The WhatsApp invite could not be sent.'}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <dl className="rounded-xl border border-slate-200 divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-slate-500">Test code</dt>
                <dd className="font-mono font-semibold text-slate-900">{created.code}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-slate-500">Link</dt>
                <dd className="font-mono text-xs text-slate-700 truncate max-w-[16rem]">{link}</dd>
              </div>
            </dl>
            {!whatsappReady && (
              <p className="text-sm text-slate-600">
                Want to send it from your school’s number?{' '}
                <Link href="/admin/whatsapp" onClick={close} className="font-semibold text-indigo-600 hover:underline">
                  Connect WhatsApp
                </Link>
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={copy} className={buttonClass('secondary')}>
                <Copy className="w-4 h-4" /> Copy code and link
              </button>
              {whatsappReady && (
                <button type="button" onClick={sendOnWhatsApp} disabled={sending} className={buttonClass('primary')}>
                  <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send on WhatsApp'}
                </button>
              )}
              <button type="button" onClick={() => setCreated(null)} className={buttonClass('secondary')}>
                Add another
              </button>
              <button type="button" onClick={close} className={buttonClass('ghost')}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name" required>
                <input required type="text" placeholder="e.g. Kavita Deshmukh" value={form.name} onChange={set('name')} className={inputClass} />
              </Field>
              <Field label="Email" required>
                <input required type="email" placeholder="kavita@example.com" value={form.email} onChange={set('email')} className={inputClass} />
              </Field>
              <Field label="WhatsApp number" required>
                <input required type="text" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} className={inputClass} />
              </Field>
              <Field label="Subject" required>
                <select required value={form.applied_subject} onChange={set('applied_subject')} className={`${selectClass} w-full`}>
                  <option value="" disabled>Select subject…</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <GradePicker value={grades} onChange={setGrades} label="Grades they would teach" required />
              </div>
              <Field label="Campus" required>
                <select required value={form.target_branch_id} onChange={set('target_branch_id')} className={`${selectClass} w-full`}>
                  <option value="" disabled>{school?.branches?.length ? 'Select campus…' : 'No campuses set up yet'}</option>
                  {(school?.branches || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.location ? ` (${b.location})` : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Qualification">
                <select value={form.qualification} onChange={set('qualification')} className={`${selectClass} w-full`}>
                  <option value="">Not known yet</option>
                  {QUALIFICATIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </Field>
              <Field label="Experience">
                <select value={form.experience_band} onChange={set('experience_band')} className={`${selectClass} w-full`}>
                  <option value="">Not known yet</option>
                  {EXPERIENCE.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Previous school">
                  <input type="text" placeholder="e.g. Oakridge International" value={form.prior_org} onChange={set('prior_org')} className={inputClass} />
                </Field>
              </div>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={attested} onChange={(e) => setAttested(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-700">
                  <strong className="text-slate-900">Our school has permission to contact this person on WhatsApp.</strong>{' '}
                  This is recorded against the candidate.
                </span>
              </label>
              <label className={`flex items-start gap-3 ${attested && whatsappConnected ? 'cursor-pointer' : 'opacity-60'}`}>
                <input
                  type="checkbox"
                  checked={sendInvite && attested && whatsappConnected}
                  disabled={!attested || !whatsappConnected}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  className="mt-1 w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm text-slate-700">
                  <strong className="text-slate-900">Send the test invite on WhatsApp now.</strong>
                  {!whatsappConnected && (
                    <span className="block text-slate-500">
                      Connect your WhatsApp number first to turn this on.{' '}
                      <Link href="/admin/whatsapp" onClick={close} className="font-semibold text-indigo-600 hover:underline">Connect</Link>
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button type="button" onClick={close} className={buttonClass('ghost')}>Cancel</button>
              <button type="submit" disabled={saving} className={buttonClass('primary')}>
                <UserPlus className="w-4 h-4" /> {saving ? (willSend ? 'Adding and sending…' : 'Adding…') : willSend ? 'Add and send invite' : 'Add candidate'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
