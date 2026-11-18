'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, PageHeader, selectClass } from '@/components/admin/ui';
import type { AuditLogEntry } from '@/lib/types';
import {
  actionLabel, candidateActionLabel, candidateKind, CANDIDATE_LABEL, isCandidateAction,
  summariseWork, WORK_LABEL, type CandidateKind, type WorkKind,
} from '@/lib/teamActivity';
import { isAdmin } from '@/lib/permissions';

type Member = { id: string; name: string; role_name: string; last_login_at: string | null };
type Tab = 'team' | 'candidates';

const PERIODS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
] as const;

const KINDS = Object.keys(WORK_LABEL) as WorkKind[];
const CANDIDATE_KINDS = Object.keys(CANDIDATE_LABEL) as CandidateKind[];
const PAGE = 40;

function when(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "5 minutes ago", "Yesterday", "3 Mar" — easier to read than a timestamp. */
function ago(iso: string | null): string {
  if (!iso) return 'Never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function groupByDay<T extends { timestamp: string }>(items: T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayHeading(item.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}

function Tile({ value, label, hint }: { value: number | string; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function Feed({ items, empty, render }: {
  items: AuditLogEntry[];
  empty: string;
  render: (l: AuditLogEntry) => React.ReactNode;
}) {
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [items]);
  if (items.length === 0) return <p className="text-sm text-slate-500 py-6 text-center">{empty}</p>;
  const groups = groupByDay(items.slice(0, shown));
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">{g.day}</h3>
          <ul className="divide-y divide-slate-100">
            {g.items.map((l) => (
              <li key={l.id} className="py-2.5 flex items-start gap-3">
                <span className="text-xs text-slate-400 w-16 shrink-0 pt-0.5 tabular-nums">{timeOnly(l.timestamp)}</span>
                <div className="min-w-0 flex-1">{render(l)}</div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {items.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="w-full py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Show more ({items.length - shown} older)
        </button>
      )}
    </div>
  );
}

/**
 * For management: what the team has done, and separately what candidates have
 * done themselves. School admin only.
 */
export default function TeamActivityPage() {
  const { schoolId, user } = useAdmin();
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('team');
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('30');
  const [person, setPerson] = useState('all');
  const [search, setSearch] = useState('');

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

  // Worked out once per period. The page is client-only, so "now" is the viewer's clock.
  const since = useMemo(() => {
    const days = PERIODS.find((p) => p.key === period)?.days;
    return days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
  }, [period]);

  // Two separate streams: entries written by someone on the team, and entries
  // written by candidates themselves (logged under the candidate's own id).
  const staffIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const teamLogs = useMemo(() => (logs ?? []).filter((l) => staffIds.has(l.actor_id)), [logs, staffIds]);
  const candidateLogs = useMemo(
    () => (logs ?? []).filter((l) => !staffIds.has(l.actor_id) && isCandidateAction(l.action)),
    [logs, staffIds]
  );

  const people = useMemo(() => {
    const work = summariseWork(teamLogs, since);
    // Everyone on the team appears, including people who have done nothing yet.
    const seen = new Set(work.map((w) => w.actorId));
    const idle = members.filter((m) => !seen.has(m.id)).map((m) => ({
      actorId: m.id, name: m.name, counts: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<WorkKind, number>, total: 0, lastActive: null as string | null,
    }));
    return [...work, ...idle];
  }, [teamLogs, since, members]);

  const roleOf = (id: string) => members.find((m) => m.id === id)?.role_name;
  const lastLogin = (id: string) => members.find((m) => m.id === id)?.last_login_at ?? null;

  const teamFeed = useMemo(
    () => teamLogs
      .filter((l) => (person === 'all' || l.actor_id === person) && (!since || l.timestamp >= since))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [teamLogs, person, since]
  );

  const candFeed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidateLogs
      .filter((l) => (!since || l.timestamp >= since) && (!q || l.actor_name.toLowerCase().includes(q)))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [candidateLogs, since, search]);

  const candStats = useMemo(() => {
    const inPeriod = candidateLogs.filter((l) => !since || l.timestamp >= since);
    const count = (kind: CandidateKind, exclude?: string) =>
      inPeriod.filter((l) => candidateKind(l.action) === kind && l.action !== exclude).length;
    return {
      registered: count('registered'),
      // A finished test is logged twice (finished, then scored); count it once.
      tests: count('tests', 'STAGE_SCORED'),
      optout: count('optout'),
      active: new Set(inPeriod.map((l) => l.actor_id)).size,
    };
  }, [candidateLogs, since]);

  if (user && !isAdmin(user.role)) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Activity" description="Only the school admin can see this." />
      </div>
    );
  }

  const teamTotal = people.reduce((n, p) => n + p.total, 0);
  const activePeople = people.filter((p) => p.total > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="See what your team has done, and what candidates have done on their own, in two separate lists."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="inline-flex rounded-xl bg-slate-100 p-1">
          {([['team', 'Team activity'], ['candidates', 'Candidate activity']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
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
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      {!logs ? (
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
      ) : tab === 'team' ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Tile value={teamTotal} label="Hiring actions" hint="Vacancies, invites, interviews, decisions…" />
            <Tile value={activePeople} label="People who were active" hint={`out of ${members.length} on the team`} />
            <Tile value={teamFeed.length} label="Entries in the list below" />
          </div>

          <Card>
            <CardHeader title="Who did what" description="Tap a person to see only their actions below. Tap again to show everyone." />
            {people.length === 0 ? (
              <p className="text-sm text-slate-500">No team members yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {people.map((p) => {
                  const chips = KINDS.filter((k) => p.counts[k] > 0);
                  const selected = person === p.actorId;
                  return (
                    <button
                      key={p.actorId}
                      type="button"
                      onClick={() => setPerson(selected ? 'all' : p.actorId)}
                      className={`text-left rounded-2xl border p-4 cursor-pointer ${selected ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                          {roleOf(p.actorId) && <p className="text-xs text-slate-500">{roleOf(p.actorId)}</p>}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap">Last seen {ago(p.lastActive ?? lastLogin(p.actorId))}</span>
                      </div>
                      {chips.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-400">Nothing done in this period</p>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {chips.map((k) => (
                            <span key={k} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                              <strong className="tabular-nums">{p.counts[k]}</strong> {WORK_LABEL[k].toLowerCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Everything the team did"
              description="Newest first. Review yes / no answers include the reviewer’s own words."
              action={
                <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Show actions by" className={selectClass}>
                  <option value="all">Everyone</option>
                  {people.map((p) => <option key={p.actorId} value={p.actorId}>{p.name}</option>)}
                </select>
              }
            />
            <Feed
              items={teamFeed}
              empty="Nothing happened in this period."
              render={(l) => (
                <>
                  <p className="text-sm text-slate-900">
                    <strong>{l.actor_name}</strong> {actionLabel(l.action).toLowerCase()}
                    {l.action === 'CANDIDATE_DELETED' && <Badge tone="rose" className="ml-2">Deleted</Badge>}
                  </p>
                  {(l.resource || l.details) && (
                    <p className="text-xs text-slate-500 break-words">{[l.resource, l.details].filter(Boolean).join(' — ')}</p>
                  )}
                </>
              )}
            />
          </Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile value={candStats.active} label="Candidates active" />
            <Tile value={candStats.registered} label={CANDIDATE_LABEL.registered} hint="New sign-ups" />
            <Tile value={candStats.tests} label={CANDIDATE_LABEL.tests} hint="Tests finished" />
            <Tile value={candStats.optout} label={CANDIDATE_LABEL.optout} hint="Opted out of messages" />
          </div>

          <Card>
            <CardHeader
              title="What candidates did"
              description="Sign-ups, finished tests and opt-outs, newest first. These are done by candidates, not by your team."
              action={
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name"
                  aria-label="Search candidates by name"
                  className={selectClass}
                />
              }
            />
            <Feed
              items={candFeed}
              empty={search ? 'No candidate matches that name.' : 'No candidate activity in this period.'}
              render={(l) => (
                <>
                  <p className="text-sm text-slate-900">
                    <strong>{l.actor_name}</strong> · {candidateActionLabel(l.action)}
                    {l.action === 'WHATSAPP_OPT_OUT' && <Badge tone="amber" className="ml-2">Opted out</Badge>}
                  </p>
                  {(l.resource || l.details) && (
                    <p className="text-xs text-slate-500 break-words">{[l.resource, l.details].filter(Boolean).join(' — ')}</p>
                  )}
                </>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
}
