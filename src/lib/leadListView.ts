/**
 * A lead list as the school sees it: the people with their result and reason,
 * the report (how many passed, how many were set aside and why, what it cost)
 * and the estimate before starting. Server only.
 */

import { db } from './db';
import { estimate, LEAD_STATUS_LABEL, listReport, type LeadRowCall, type ListReport } from './leadLists';
import { pricePerMinuteOf, sarvamEnv, screeningSettingsOf } from './screeningCall';
import { maxConcurrent } from './screeningCallService';
import type { LeadList, LeadStatus, ScreeningCall } from './types';

export interface LeadRowView {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  status: LeadStatus;
  status_label: string;
  reason?: string;
  invited?: boolean;
  /** The latest call: what was said, in two lines. */
  summary?: string;
  called_at?: string;
  call_status?: ScreeningCall['status'];
  calls: number;
  /** What they wrote on the lead form, from the uploaded sheet. */
  answers?: { q: string; a: string }[];
}

export interface LeadListView {
  list: LeadList;
  rows: LeadRowView[];
  report: ListReport;
  estimate: { calls: number; cost_inr: number; hours: number; days: number };
  price_per_min_inr: number;
  window: { start: number; end: number; skip_sundays: boolean };
  mode: 'live' | 'demo';
}

/** The latest call first. */
function callsByCandidate(schoolId: string): Map<string, ScreeningCall[]> {
  const map = new Map<string, ScreeningCall[]>();
  for (const c of db.getScreeningCallsBySchool(schoolId)) {
    const list = map.get(c.candidate_id) ?? [];
    list.push(c);
    map.set(c.candidate_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.started_at.localeCompare(a.started_at));
  return map;
}

export function leadListView(schoolId: string, list: LeadList): LeadListView {
  const school = db.getSchoolById(schoolId);
  const settings = screeningSettingsOf(school);
  const leads = db.getLeadsOfList(schoolId, list.id);
  const calls = callsByCandidate(schoolId);
  const rowCalls = new Map<string, LeadRowCall[]>(leads.map((l) => [l.id, (calls.get(l.id) ?? []).map((c) => ({
    status: c.status, summary: c.summary, price_inr: c.price_inr, duration_sec: c.duration_sec, started_at: c.started_at, mode: c.mode,
  }))]));
  const rows: LeadRowView[] = leads.map((l) => {
    const mine = calls.get(l.id) ?? [];
    const latest = mine.find((c) => c.status !== 'scheduled' && c.status !== 'skipped') ?? mine[0];
    const status = l.lead?.status ?? 'waiting';
    return {
      id: l.id, name: l.name, phone: l.phone, email: l.email && !l.email.endsWith('.local') ? l.email : '', subject: l.applied_subject === 'General' ? '' : l.applied_subject,
      status, status_label: LEAD_STATUS_LABEL[status], reason: l.lead?.reason, invited: l.lead?.invited,
      summary: latest?.summary, called_at: latest?.started_at, call_status: latest?.status, calls: mine.length,
      ...(l.lead?.answers?.length ? { answers: l.lead.answers } : {}),
    };
  });
  const report = listReport(leads, rowCalls, leads.map((l) => l.id));
  const waiting = rows.filter((r) => r.status === 'waiting').length;
  const r = settings.rules;
  return {
    list,
    rows,
    report,
    estimate: estimate(waiting, pricePerMinuteOf(school), { concurrent: maxConcurrent(), windowHours: r.window_end_hour - r.window_start_hour }),
    price_per_min_inr: pricePerMinuteOf(school),
    window: { start: r.window_start_hour, end: r.window_end_hour, skip_sundays: r.skip_sundays },
    mode: sarvamEnv() ? 'live' : 'demo',
  };
}

/** Counts for the lists overview, without every row. */
export function leadListSummary(schoolId: string, list: LeadList, calls = callsByCandidate(schoolId)): { called: number; answered: number; calls_made: number; created_by: string; id: string; name: string; status: LeadList['status']; total: number; good_fit: number; needs_look: number; set_aside: number; waiting: number; progress: number; created_at: string; has_setup: boolean; good_fit_text?: string; note?: string } {
  const leads = db.getLeadsOfList(schoolId, list.id);
  const count = (s: LeadStatus) => leads.filter((l) => l.lead?.status === s).length;
  const good = count('good_fit') + count('moved');
  const final = good + count('needs_look') + count('set_aside');
  // Calls actually placed: a scheduled or skipped one never rang.
  const placed = leads.map((l) => (calls.get(l.id) ?? []).filter((c) => c.status !== 'scheduled' && c.status !== 'skipped'));
  return {
    called: placed.filter((p) => p.length > 0).length,
    answered: placed.filter((p) => p.some((c) => c.status === 'completed')).length,
    calls_made: placed.reduce((n, p) => n + p.length, 0),
    created_by: list.created_by,
    id: list.id, name: list.name, status: list.status, total: leads.length, good_fit: good, needs_look: count('needs_look'),
    set_aside: count('set_aside'), waiting: count('waiting') + count('calling'), progress: leads.length ? Math.round((final / leads.length) * 100) : 0,
    created_at: list.created_at, has_setup: !!list.setup, good_fit_text: list.setup?.good_fit, note: list.note,
  };
}
