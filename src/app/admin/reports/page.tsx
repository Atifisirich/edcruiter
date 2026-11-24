'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck2, Download, Loader2, MessageSquare, PhoneCall, PiggyBank, Printer, UserPlus, Users, Video,
} from 'lucide-react';
import { useAdmin } from '@/components/admin/adminContext';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, buttonClass, inputClass } from '@/components/admin/ui';
import { isAdmin } from '@/lib/permissions';
import type { ManagementReport, ReportRange } from '@/lib/managementReport';

const RANGES: { key: ReportRange; label: string }[] = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: '90', label: 'Last 90 days' },
  { key: 'all', label: 'All time' },
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const hoursText = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

const TEMPLATE_LABEL: Record<string, string> = {
  assessment_invite: 'Test invitations',
  round_scheduled: 'Interview details',
  application_outcome: 'Application updates',
};

/**
 * What the school's management reads: leads, invites, how far candidates got,
 * interviews and Meet links, how each reviewer did, and the money and time
 * saved. School admin only.
 */
export default function ReportsPage() {
  const { schoolId, school, user, setSchool, toast } = useAdmin();
  const [range, setRange] = useState<ReportRange>('30');
  const [report, setReport] = useState<ManagementReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rate, setRate] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  const load = useCallback(async (r: ReportRange) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports?school_id=${encodeURIComponent(schoolId)}&range=${r}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not build the report.'); return; }
      setReport(data.report);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads when the period changes; state is set after the fetch resolves
    void load(range);
  }, [load, range]);

  if (user && !isAdmin(user.role)) {
    return <PageHeader title="Reports" description="Only the school admin can see this." />;
  }

  const saveRate = async () => {
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 50 || n > 5000) { toast('Enter an hourly cost between ₹50 and ₹5,000.', 'error'); return; }
    setSavingRate(true);
    try {
      const res = await fetch('/api/schools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: school?.id || schoolId, updates: { hr_hourly_cost_inr: n } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.school) throw new Error(data.error || 'Could not save');
      setSchool(data.school);
      setRate('');
      toast('Saved. The saving below uses this hourly cost.', 'success');
      await load(range);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save.', 'error');
    } finally {
      setSavingRate(false);
    }
  };

  const r = report;
  const periodLabel = RANGES.find((x) => x.key === range)?.label.toLowerCase() ?? '';

  return (
    <div className="space-y-6 print:space-y-4">
      <PageHeader
        title="Reports"
        description="What your hiring has done, how far candidates got, and the time and money Edcruiter saved your team."
        actions={
          <button type="button" onClick={() => window.print()} className={`${buttonClass('secondary', 'sm')} print:hidden`}>
            <Printer className="w-4 h-4" /> Print or save as PDF
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="Period">
        {RANGES.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={range === x.key}
            onClick={() => setRange(x.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border cursor-pointer ${range === x.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
      {loading && !r && <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" />}

      {r && (
        <div className={loading ? 'opacity-60 transition-opacity space-y-6' : 'space-y-6'}>
          {/* The saving first: it is the line management reads */}
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><PiggyBank className="w-6 h-6" /></span>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Edcruiter saved your team, {periodLabel}</p>
                  <p className="text-4xl font-extrabold tracking-tight text-emerald-900 tabular-nums mt-0.5">{inr(r.saved.net_inr)}</p>
                  <p className="text-sm text-emerald-900/80 mt-1">
                    about {r.saved.total_hours} hours of staff time ({inr(r.saved.gross_inr)}){r.saved.ai_call_spend_inr > 0 ? `, less ${inr(r.saved.ai_call_spend_inr)} spent on AI calls` : ''}
                  </p>
                </div>
              </div>
              <Badge tone="emerald">An estimate, shown below</Badge>
            </div>

            <details className="mt-4 rounded-2xl bg-white/70 border border-emerald-200 print:open" open>
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-emerald-900">How this is worked out</summary>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3 font-semibold">What was done for you</th>
                      <th className="py-1.5 pr-3 font-semibold text-right">Times</th>
                      <th className="py-1.5 pr-3 font-semibold text-right">Time saved</th>
                      <th className="py-1.5 font-semibold text-right">Worth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {r.saved.lines.map((l) => (
                      <tr key={l.key}>
                        <td className="py-2 pr-3 text-slate-800">{l.label}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{l.count.toLocaleString('en-IN')}</td>
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{hoursText(l.minutes)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold">{inr(l.rupees)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-emerald-200 font-bold text-slate-900">
                      <td className="py-2 pr-3">Total</td>
                      <td />
                      <td className="py-2 pr-3 text-right tabular-nums">{hoursText(r.saved.total_minutes)}</td>
                      <td className="py-2 text-right tabular-nums">{inr(r.saved.gross_inr)}</td>
                    </tr>
                  </tfoot>
                </table>
                <p className="mt-3 text-xs text-slate-600">
                  Each step is counted at a typical time a person would take to do it by hand (for example 8 minutes for a phone screening call, 10 for booking one interview), valued at {inr(r.saved.hourly_cost_inr)} for an hour of HR time.
                  It is an estimate, not an invoice.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2 print:hidden">
                  <label className="text-xs font-semibold text-slate-700">Your cost of one HR hour (₹)
                    <input type="number" min={50} max={5000} value={rate} onChange={(e) => setRate(e.target.value)} placeholder={String(r.saved.hourly_cost_inr)} className={`${inputClass} mt-1 w-36`} />
                  </label>
                  <button type="button" onClick={() => void saveRate()} disabled={savingRate || !rate} className={buttonClass('secondary', 'sm')}>
                    {savingRate ? 'Saving…' : 'Use this'}
                  </button>
                </div>
              </div>
            </details>
          </section>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Leads in" value={r.leads.total} hint={`${r.leads.added_by_school} added by you · ${r.leads.self_registered} registered themselves`} Icon={UserPlus} tone="indigo" />
            <StatCard label="WhatsApp messages sent" value={r.invites.messages.total} hint={`${r.invites.candidates_invited} candidates invited · ${r.invites.messages.delivered} delivered`} Icon={MessageSquare} tone="emerald" />
            <StatCard label="Interviews booked" value={r.interviews.booked} hint={`${r.interviews.held} held · ${r.interviews.upcoming} coming up`} Icon={CalendarCheck2} tone="amber" />
            <StatCard label="Google Meet links made" value={r.interviews.google_meet_links} hint={r.interviews.own_links + r.interviews.free_rooms > 0 ? `${r.interviews.own_links + r.interviews.free_rooms} used another link` : 'every interview'} Icon={Video} tone="indigo" />
          </div>

          <Card>
            <CardHeader title="How far candidates got" description={`Of the ${r.leads.total} who came in ${periodLabel}, how many finished each stage.`} />
            {r.leads.total === 0 ? (
              <EmptyState Icon={Users} title="No candidates in this period" description="Pick a longer period, or add candidates." />
            ) : (
              <ul className="space-y-3">
                {r.funnel.map((f) => (
                  <li key={f.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800">{f.label}</span>
                      <span className="tabular-nums text-slate-600"><strong className="text-slate-900">{f.finished}</strong> finished · {f.percent_of_registered}%</span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={f.percent_of_registered} aria-valuemin={0} aria-valuemax={100} aria-label={f.label}>
                      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${f.percent_of_registered}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Reaching candidates" description="Invitations and AI screening calls." />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-slate-500">WhatsApp delivered</dt><dd className="text-lg font-bold tabular-nums">{r.invites.messages.delivered}</dd></div>
                <div><dt className="text-slate-500">Read by candidates</dt><dd className="text-lg font-bold tabular-nums">{r.invites.messages.read}</dd></div>
                <div><dt className="text-slate-500">Could not be delivered</dt><dd className={`text-lg font-bold tabular-nums ${r.invites.messages.failed ? 'text-rose-700' : ''}`}>{r.invites.messages.failed}</dd></div>
                <div><dt className="text-slate-500">Registered on their own</dt><dd className="text-lg font-bold tabular-nums">{r.leads.self_registered}</dd></div>
              </dl>
              {r.invites.by_template.length > 0 && (
                <ul className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm">
                  {r.invites.by_template.map((t) => (
                    <li key={t.template} className="flex justify-between gap-3"><span className="text-slate-600">{TEMPLATE_LABEL[t.template] ?? t.template}</span><span className="font-semibold tabular-nums">{t.sent}</span></li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><PhoneCall className="w-4 h-4 text-indigo-600" /> AI screening calls</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><dt className="text-slate-500">Calls placed</dt><dd className="font-bold tabular-nums">{r.outreach.calls_placed}</dd></div>
                  <div><dt className="text-slate-500">Answered</dt><dd className="font-bold tabular-nums">{r.outreach.answered}</dd></div>
                  <div><dt className="text-slate-500">Interested</dt><dd className="font-bold tabular-nums">{r.outreach.interested}</dd></div>
                  <div><dt className="text-slate-500">Not reached</dt><dd className="font-bold tabular-nums">{r.outreach.no_answer}</dd></div>
                </dl>
              </div>
            </Card>

            <Card>
              <CardHeader title="Interviews" description="Booked through the app, by round." />
              {r.interviews.booked === 0 ? (
                <p className="text-sm text-slate-500">No interviews were booked in this period.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-3 gap-4 text-sm">
                    <div><dt className="text-slate-500">Booked</dt><dd className="text-lg font-bold tabular-nums">{r.interviews.booked}</dd></div>
                    <div><dt className="text-slate-500">Held</dt><dd className="text-lg font-bold tabular-nums text-emerald-700">{r.interviews.held}</dd></div>
                    <div><dt className="text-slate-500">Cancelled</dt><dd className="text-lg font-bold tabular-nums">{r.interviews.cancelled}</dd></div>
                  </dl>
                  <ul className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm">
                    {r.interviews.by_round.map((x) => (
                      <li key={x.round} className="flex justify-between gap-3">
                        <span className="text-slate-600 capitalize">{x.round.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums"><strong>{x.booked}</strong> booked · {x.held} held</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-xs text-slate-500">
                    {r.interviews.google_meet_links} Google Meet {r.interviews.google_meet_links === 1 ? 'link' : 'links'} made automatically
                    {r.interviews.own_links ? `, ${r.interviews.own_links} own ${r.interviews.own_links === 1 ? 'link' : 'links'} pasted` : ''}
                    {r.interviews.free_rooms ? `, ${r.interviews.free_rooms} free ${r.interviews.free_rooms === 1 ? 'room' : 'rooms'}` : ''}.
                  </p>
                </>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Your reviewers" description="Interviews each person was booked for, how many they attended, and the yes or no they gave." />
            {r.reviewers.length === 0 ? (
              <p className="text-sm text-slate-500">No reviewer has been booked or has decided in this period yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3 font-semibold">Reviewer</th>
                      <th className="py-2 pr-3 font-semibold text-right">Booked</th>
                      <th className="py-2 pr-3 font-semibold text-right">Attended</th>
                      <th className="py-2 pr-3 font-semibold text-right">Yes</th>
                      <th className="py-2 font-semibold text-right">No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.reviewers.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-3"><span className="font-semibold text-slate-900">{p.name}</span> <span className="text-slate-500">· {p.role_name}</span></td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{p.booked}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">{p.attended}<span className="text-slate-400">{p.booked ? ` of ${p.booked}` : ''}</span></td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-700 font-semibold">{p.yes}</td>
                        <td className="py-2.5 text-right tabular-nums text-rose-700 font-semibold">{p.no}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Updating…</p>}
          <p className="text-xs text-slate-400 flex items-center gap-1.5 print:hidden"><Download className="w-3.5 h-3.5" /> Use Print, then choose Save as PDF, to send this report to others.</p>
        </div>
      )}
    </div>
  );
}
