'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MailWarning, Send, Trash2, UserPlus } from 'lucide-react';
import { ROLE_HELP, ROLE_LABEL, TEAM_ROLES } from '@/lib/team';

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'invited' | 'active';
  last_login_at: string | null;
  is_you: boolean;
};

function schoolQuery() {
  try {
    const id = localStorage.getItem('edcruiter_school_id');
    return id ? `?school_id=${encodeURIComponent(id)}` : '';
  } catch {
    return '';
  }
}

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [max, setMax] = useState(25);
  const [emailReady, setEmailReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'REPORTING_MANAGER' });

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/team${schoolQuery()}`);
        if (cancelled) return;
        if (res.status === 403 || res.status === 401) {
          setForbidden(true);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load your team.');
        if (cancelled) return;
        setMembers(data.members);
        setMax(data.max);
        setEmailReady(Boolean(data.emailReady));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your team.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const call = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const data = await call('POST', `/api/team${schoolQuery()}`, form);
      setNotice(
        data.emailSent
          ? `${form.name} was added and we emailed them a link to choose a password. They can also sign in with Google using ${form.email}.`
          : `${form.name} was added, but we could not email them. They can sign in with Google using ${form.email}, or choose "Forgot password" on the log in page.${data.devLink ? ` (Development link: ${data.devLink})` : ''}`
      );
      setForm({ name: '', email: '', role: form.role });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that person.');
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (m: Member, role: string) => {
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      await call('PATCH', `/api/team${schoolQuery()}`, { id: m.id, role });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that role.');
    } finally {
      setBusyId(null);
    }
  };

  const resend = async (m: Member) => {
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      const data = await call('PATCH', `/api/team${schoolQuery()}`, { id: m.id, resend: true });
      setNotice(data.emailSent ? `We emailed ${m.email} again.` : `We could not email ${m.email}. They can sign in with Google using that address.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name} from your team? They will lose access straight away.`)) return;
    setBusyId(m.id);
    setError(null);
    setNotice(null);
    try {
      await call('DELETE', `/api/team${schoolQuery()}${schoolQuery() ? '&' : '?'}id=${encodeURIComponent(m.id)}`);
      setNotice(`${m.name} was removed.`);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that person.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-indigo-600 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Recruiter workspace
        </Link>

        <header className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-2">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Recruiter workspace</p>
          <h1 className="text-2xl font-black">Your team</h1>
          <p className="text-sm text-slate-600">
            Add the principals, HR staff and reviewers who work with you. Everyone you add signs in to the same school, with the access their role allows.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : forbidden ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-sm text-slate-700">
            Only a school admin can manage the team. Ask your admin to add or change people.
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            {notice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-start gap-2.5 break-words">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{notice}</span>
              </div>
            )}
            {!emailReady && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                <MailWarning className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Email is not set up on this server yet, so invitations cannot be emailed. People you add can still sign in with Google using the email you enter.</span>
              </div>
            )}

            <form onSubmit={add} className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <UserPlus className="w-4 h-4" /> Add a team member
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  Name
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1.5 w-full min-h-12 p-3 rounded-xl bg-slate-50 border border-slate-300 text-base sm:text-sm" placeholder="e.g. Dr. Anita Rao" />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Email
                  <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1.5 w-full min-h-12 p-3 rounded-xl bg-slate-50 border border-slate-300 text-base sm:text-sm" placeholder="name@yourschool.edu" />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Role
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="mt-1.5 w-full min-h-12 p-3 rounded-xl bg-slate-50 border border-slate-300 text-base sm:text-sm">
                    {TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[11px] text-slate-500">{ROLE_HELP[form.role]}</p>
              <button type="submit" disabled={adding || members.length >= max}
                className="w-full sm:w-auto min-h-12 justify-center brand-primary-btn px-5 py-3 rounded-xl font-bold text-sm sm:text-xs shadow-xl inline-flex items-center gap-2 cursor-pointer disabled:opacity-50">
                {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Send className="w-4 h-4" /> Add and send invitation</>}
              </button>
              {members.length >= max ? <p className="text-[11px] text-amber-700">Your team is full ({max} people).</p> : null}
            </form>

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 text-sm font-black text-slate-900">
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </div>
              <ul className="divide-y divide-slate-100">
                {members.map((m) => (
                  <li key={m.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {m.name} {m.is_you ? <span className="text-[11px] font-semibold text-slate-400">(you)</span> : null}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{m.email}</p>
                    </div>
                    <span className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-bold ${m.status === 'invited' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {m.status === 'invited' ? 'Invited, not signed in yet' : 'Active'}
                    </span>
                    <select
                      value={m.role}
                      disabled={busyId === m.id}
                      onChange={(e) => changeRole(m, e.target.value)}
                      className="w-full sm:w-auto min-h-11 p-2 rounded-xl bg-slate-50 border border-slate-300 text-base sm:text-xs font-semibold"
                      aria-label={`Role for ${m.name}`}
                    >
                      {TEAM_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                      {m.status === 'invited' && (
                        <button type="button" onClick={() => resend(m)} disabled={busyId === m.id}
                          className="min-h-11 sm:min-h-0 px-1 text-xs sm:text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer disabled:opacity-50">
                          Resend email
                        </button>
                      )}
                      {!m.is_you && (
                        <button type="button" onClick={() => remove(m)} disabled={busyId === m.id} aria-label={`Remove ${m.name}`}
                          className="p-3 sm:p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
