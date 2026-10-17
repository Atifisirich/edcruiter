'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, CheckCircle2, Clock, ExternalLink, Loader2, ThumbsDown, User, Video, XCircle } from 'lucide-react';
import { Candidate, InterviewRound, ScheduledInterview } from '@/lib/types';
import { SLOKA_SCHOOL_ID } from '@/lib/defaultData';

const ROUNDS: { key: InterviewRound; label: string; blurb: string }[] = [
  { key: 'subject_lead', label: 'Subject lead', blurb: 'Department conversation on subject and classroom practice' },
  { key: 'principal', label: 'Principal', blurb: 'School leadership, culture, and safeguarding' },
  { key: 'management', label: 'Management', blurb: 'Fitment, offer, and joining' }
];

type StaffMember = { id: string; name: string; email: string; role: string; department?: string };

function latestDecision(c: Candidate, round: InterviewRound) {
  return [...(c.interview_decisions || [])].reverse().find((d) => d.round === round);
}

function toDatetimeLocalValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LeadershipInterviewsPage() {
  const schoolId =
    (typeof window !== 'undefined' && localStorage.getItem('edcruiter_school_id')) || SLOKA_SCHOOL_ID;

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [interviews, setInterviews] = useState<ScheduledInterview[]>([]);
  const [round, setRound] = useState<InterviewRound>('subject_lead');
  const [view, setView] = useState<'queue' | 'accepted' | 'declined'>('queue');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Scheduling form
  const [assignedUserId, setAssignedUserId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue());
  const [duration, setDuration] = useState(30);
  const [customLink, setCustomLink] = useState('');
  const [schedNotes, setSchedNotes] = useState('');

  // Decision form
  const [reason, setReason] = useState('');

  const load = async () => {
    const [candRes, staffRes, intvRes] = await Promise.all([
      fetch(`/api/candidates?school_id=${schoolId}`),
      fetch(`/api/staff?school_id=${schoolId}`),
      fetch(`/api/interviews?school_id=${schoolId}`),
    ]);
    const candData = await candRes.json();
    const staffData = await staffRes.json();
    const intvData = await intvRes.json();
    setCandidates(candData.candidates || []);
    setStaff(staffData.staff || []);
    setInterviews(intvData.interviews || []);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const roundStaff = useMemo(() => {
    // Any real staff member can be assigned to any round — HR knows who's
    // actually covering a subject or standing in for the principal this
    // week — so this offers everyone rather than guessing from role.
    return staff;
  }, [staff]);

  const interviewFor = (candidateId: string, r: InterviewRound) =>
    interviews.find((i) => i.candidate_id === candidateId && i.round === r && i.status !== 'cancelled');

  const inRound = (c: Candidate) => {
    const d = latestDecision(c, round);
    if (view === 'accepted') return d?.decision === 'accepted';
    if (view === 'declined') return d?.decision === 'rejected';
    return !d && (c.shortlist_status === 'shortlisted' || c.status === 'passed' || c.status === 'in_progress');
  };

  const list = candidates.filter(inRound);
  const selectedInterview = selected ? interviewFor(selected.id, round) : undefined;

  const selectCandidate = (c: Candidate) => {
    setSelected(c);
    setReason('');
    setAssignedUserId('');
    setScheduledAt(toDatetimeLocalValue());
    setDuration(30);
    setCustomLink('');
    setSchedNotes('');
    setError('');
  };

  const schedule = async () => {
    if (!selected) return;
    if (!assignedUserId) {
      setError('Choose who is taking this interview.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: schoolId,
          candidate_id: selected.id,
          round,
          assigned_user_id: assignedUserId,
          scheduled_at: new Date(scheduledAt).toISOString(),
          duration_minutes: duration,
          meeting_link: customLink || undefined,
          notes: schedNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not schedule the interview.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule the interview.');
    } finally {
      setSaving(false);
    }
  };

  const cancelInterview = async (intv: ScheduledInterview) => {
    if (!confirm('Cancel this scheduled interview?')) return;
    setSaving(true);
    try {
      await fetch(`/api/interviews/${intv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!selected || !selectedInterview) return;
    if (!reason.trim()) {
      setError('Write why you are accepting or declining this teacher.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/interviews/${selectedInterview.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record the decision.');
      setReason('');
      await load();
      const refreshed = candidates.find((c) => c.id === selected.id);
      if (refreshed) setSelected(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the decision.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 py-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recruiter workspace
        </Link>

        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Recruiter workspace</p>
          <h1 className="text-2xl font-black mt-1">Leadership interviews</h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            After shortlist, the school meets the teacher: subject lead, then principal, then management. Pick a real
            person and a time here — the candidate and the reviewer are both notified, and the reviewer records their
            own outcome once it happens.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {ROUNDS.map((r) => (
            <button key={r.key} type="button" onClick={() => { setRound(r.key); setSelected(null); }} className={`px-4 py-2 rounded-2xl text-xs font-bold border ${round === r.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">{ROUNDS.find((r) => r.key === round)?.blurb}</p>

        <div className="flex gap-2">
          {(['queue', 'accepted', 'declined'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${view === v ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500'}`}>
              {v === 'queue' ? 'Waiting' : v === 'accepted' ? 'Accepted' : 'Declined'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <ul className="lg:col-span-5 space-y-2">
            {list.length === 0 && <li className="text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl p-6">No teachers in this list.</li>}
            {list.map((c) => {
              const intv = interviewFor(c.id, round);
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => selectCandidate(c)} className={`w-full text-left p-4 rounded-2xl border bg-white ${selected?.id === c.id ? 'border-indigo-300' : 'border-slate-200'}`}>
                    <p className="text-sm font-bold">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.applied_subject} · {c.applied_segment}</p>
                    {intv ? (
                      <p className="text-[11px] text-indigo-700 font-bold mt-1.5 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(intv.scheduled_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {intv.assigned_user_name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 font-bold mt-1.5">Not scheduled yet</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            {!selected ? (
              <p className="text-xs text-slate-500">Select a teacher to schedule or record their {ROUNDS.find(r=>r.key===round)?.label.toLowerCase()} interview.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black"><User className="w-4 h-4" /></div>
                  <div>
                    <p className="font-black">{selected.name}</p>
                    <Link href={`/admin/candidates/${selected.id}`} className="text-[11px] font-bold text-indigo-600">Open full profile</Link>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">Decision history</p>
                  {(selected.interview_decisions || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No interview decision yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(selected.interview_decisions || []).map((d, i) => (
                        <li key={`${d.decided_at}-${i}`} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{d.round_label} · {d.reviewer_name}</span>
                            <span className={`inline-flex items-center gap-1 font-bold ${d.decision === 'accepted' ? 'text-indigo-700' : 'text-rose-700'}`}>
                              {d.decision === 'accepted' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                              {d.decision === 'accepted' ? 'Accepted' : 'Declined'}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-1">{d.reason}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{new Date(d.decided_at).toLocaleString()}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {view === 'queue' && !selectedInterview && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="text-xs font-black text-slate-800 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-600" /> Schedule this interview</p>
                    <label className="block text-xs font-bold">Who is taking it
                      <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <option value="">Select staff member…</option>
                        {roundStaff.map((s) => (
                          <option key={s.id} value={s.id}>{s.name} — {s.role}{s.department ? ` · ${s.department}` : ''}</option>
                        ))}
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-bold">Date & time
                        <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50" />
                      </label>
                      <label className="block text-xs font-bold">Duration (minutes)
                        <input type="number" min={10} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50" />
                      </label>
                    </div>
                    <label className="block text-xs font-bold">Meeting link (optional)
                      <input value={customLink} onChange={(e) => setCustomLink(e.target.value)} placeholder="Paste your own Google Meet link, or leave blank to auto-generate one" className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50" />
                    </label>
                    <label className="block text-xs font-bold">Notes for the reviewer (optional)
                      <textarea value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} rows={2} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50" placeholder="Anything the reviewer should know beforehand" />
                    </label>
                    {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
                    <button type="button" disabled={saving} onClick={schedule} className="w-full brand-primary-btn py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      {saving ? 'Scheduling…' : 'Schedule & notify'}
                    </button>
                  </div>
                )}

                {view === 'queue' && selectedInterview && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs space-y-1.5">
                      <p className="font-black text-indigo-900">Scheduled with {selectedInterview.assigned_user_name}</p>
                      <p className="text-indigo-800 inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(selectedInterview.scheduled_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {' '}· {selectedInterview.duration_minutes} min
                      </p>
                      <a href={selectedInterview.meeting_link} target="_blank" rel="noreferrer" className="text-indigo-700 font-bold underline inline-flex items-center gap-1">
                        <Video className="w-3.5 h-3.5" /> {selectedInterview.meeting_link} <ExternalLink className="w-3 h-3" />
                      </a>
                      {selectedInterview.notes && <p className="text-indigo-700">Note: {selectedInterview.notes}</p>}
                      <button type="button" onClick={() => cancelInterview(selectedInterview)} className="text-rose-600 font-bold inline-flex items-center gap-1 pt-1">
                        <XCircle className="w-3.5 h-3.5" /> Cancel this slot
                      </button>
                    </div>

                    <p className="text-xs font-black text-slate-800">Record the outcome</p>
                    <p className="text-[11px] text-slate-500">
                      This is recorded under your own signed-in account — only {selectedInterview.assigned_user_name} or a school admin can submit it.
                    </p>
                    <label className="block text-xs font-bold">Why (required)
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50" placeholder="Subject gaps, classroom presence, offer terms…" />
                    </label>
                    {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
                    <div className="flex gap-2">
                      <button type="button" disabled={saving} onClick={() => decide('accepted')} className="flex-1 brand-primary-btn py-2.5 rounded-xl text-xs font-bold">Accept at this round</button>
                      <button type="button" disabled={saving} onClick={() => decide('rejected')} className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white">Decline</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
