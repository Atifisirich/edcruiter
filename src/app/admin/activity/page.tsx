'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, PageHeader, selectClass } from '@/components/admin/ui';
import type { AuditLogEntry } from '@/lib/types';
import { actionLabel, summariseWork, WORK_LABEL, type WorkKind } from '@/lib/teamActivity';
import { isAdmin } from '@/lib/permissions';

type Member = { id: string; name: string; role_name: string; last_login_at: string | null };

const PERIODS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
] as const;

const KINDS = Object.keys(WORK_LABEL) as WorkKind[];

function when(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * For management: what each person on the team has done — vacancies, candidates,
 * invites, interviews, shortlist decisions, review yes/no and offers — and a feed
 * of every action, newest first. School admin only.
 */
export default function TeamActivityPage() {
  const { schoolId, user } = useAdmin();
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('30');
  const [person, setPerson] = useState('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [logRes, teamRes] = await Promise.all([
          fetch(`/api/audit-logs?school_id=${schoolId}`),
          fetch(`/api/team?school_id=${schoolId}`),
        ]);
        const logData = await logRes.json();
        const teamData = await teamRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!logRes.ok) {
          setError(logData.error || 'Could not load the activity.');
          setLogs([]);
          return;
        }
        setLogs(logData.auditLogs || []);
        setMembers(teamData.members || []);
      } catch {
        if (!cancelled) setError('Could not reach the server. Check your connection and refresh.');
      }
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  // Worked out once per load and period. The page is client-only, so "now" is the viewer's clock.
  const since = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days;
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  }, [period]);

  const people = useMemo(() => {
    const work = summariseWork(logs ?? [], since);
    // Everyone on the team appears, including people who have done nothing yet.
    const seen = new Set(work.map((w) => w.actorId));
    const idle = members.filter((m) => !seen.has(m.id)).map((m) => ({
      actorId: m.id, name: m.name, counts: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<WorkKind, number>, total: 0, lastActive: null,
    }));
    return [...work, ...idle];
  }, [logs, since, members]);

  const roleOf = (id: string) => members.find((m) => m.id === id)?.role_name;
  const lastLogin = (id: string) => members.find((m) => m.id === id)?.last_login_at ?? null;

  const feed = useMemo(
    () => (logs ?? [])
      .filter((l) => (person === 'all' || l.actor_id === person) && (!since || l.timestamp >= since))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 150),
    [logs, person, since]
  );

  if (user && !isAdmin(user.role)) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Team activity" description="Only the school admin can see the team’s activity." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team activity"
        description="What each person on your team has done: vacancies, candidates, invites, interviews, shortlist decisions, review yes/no and offers."
      />

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border ${period === p.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      <Card>
        <CardHeader title="By person" description="Counts for the period above. Click a name to see only their actions below." />
        {!logs ? (
          <div className="h-32 rounded-xl bg-slate-100 animate-pulse" />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[46rem]">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="py-2 px-1 font-semibold">Person</th>
                  {KINDS.map((k) => <th key={k} className="py-2 px-1 font-semibold text-right">{WORK_LABEL[k]}</th>)}
                  <th className="py-2 px-1 font-semibold text-right">Last active</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.actorId} className={`border-b border-slate-100 ${person === p.actorId ? 'bg-indigo-50/60' : ''}`}>
                    <td className="py-2.5 px-1">
                      <button type="button" onClick={() => setPerson(person === p.actorId ? 'all' : p.actorId)} className="text-left cursor-pointer">
                        <span className="block font-semibold text-slate-900 hover:text-indigo-700">{p.name}</span>
                        {roleOf(p.actorId) && <span className="block text-xs text-slate-500">{roleOf(p.actorId)}</span>}
                      </button>
                    </td>
                    {KINDS.map((k) => (
                      <td key={k} className={`py-2.5 px-1 text-right tabular-nums ${p.counts[k] ? 'text-slate-900 font-semibold' : 'text-slate-300'}`}>{p.counts[k]}</td>
                    ))}
                    <td className="py-2.5 px-1 text-right text-xs text-slate-500 whitespace-nowrap">{when(p.lastActive ?? lastLogin(p.actorId))}</td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr><td colSpan={KINDS.length + 2} className="py-6 text-center text-slate-500">No activity yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Every action"
          description="Newest first, with the reviewer’s own words for each yes or no."
          action={
            <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Show actions by" className={selectClass}>
              <option value="all">Everyone</option>
              {people.map((p) => <option key={p.actorId} value={p.actorId}>{p.name}</option>)}
            </select>
          }
        />
        {feed.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing in this period.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {feed.map((l) => (
              <li key={l.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                <span className="text-xs text-slate-500 sm:w-32 shrink-0 tabular-nums">{when(l.timestamp)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">
                    <strong>{l.actor_name}</strong> · {actionLabel(l.action)}
                    {l.action === 'CANDIDATE_DELETED' && <Badge tone="rose" className="ml-2">Deleted</Badge>}
                  </p>
                  <p className="text-xs text-slate-500 break-words">{l.resource}{l.details ? ` — ${l.details}` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
