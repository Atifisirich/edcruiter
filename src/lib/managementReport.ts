/**
 * The numbers the school's management reads: what came in, what was sent, how
 * far candidates got, which interviews were booked and held, how each reviewer
 * did, and what all of it saved. Pure: the caller passes the records in.
 *
 * "Saved" is an estimate, and says how it was worked out. Each automated step
 * replaces some minutes of a person's time (see SAVED_MINUTES), valued at an
 * hourly cost the school can change (hr_hourly_cost_inr).
 */

import type {
  Candidate, ScheduledInterview, ScreeningCall, StageResult, WhatsAppMessageLog,
} from './types';

export type ReportRange = '7' | '30' | '90' | 'all';

export const RANGE_DAYS: Record<ReportRange, number | null> = { '7': 7, '30': 30, '90': 90, all: null };

/** What an HR person's hour costs the school, in rupees, until the school sets its own. */
export const DEFAULT_HR_HOURLY_INR = 300;

/**
 * Minutes of a person's time each automated step replaces. Round numbers on
 * purpose: they are an honest estimate, not a measurement.
 */
export const SAVED_MINUTES = {
  cv_read: 5, // reading and noting down one CV
  screening_call: 8, // a phone screening call placed and written up by hand
  whatsapp_invite: 3, // writing and sending one invite or update by hand
  interview_booked: 10, // finding a slot, messaging both sides, making and sharing a link
  stage_marked: 15, // marking one finished stage (test, lesson plan, demo video, scenario)
  report_written: 20, // writing up one candidate's profile
} as const;

export type SavedKey = keyof typeof SAVED_MINUTES;

export const SAVED_LABEL: Record<SavedKey, string> = {
  cv_read: 'CVs read by AI',
  screening_call: 'AI screening calls answered',
  whatsapp_invite: 'WhatsApp messages sent for you',
  interview_booked: 'Interviews booked with links and notices',
  stage_marked: 'Stages marked by AI',
  report_written: 'Candidate reports written',
};

/** The five steps of the candidate's online assessment, in order. */
export const FUNNEL_STAGES: { key: string; label: string }[] = [
  { key: 'identity_verification', label: 'Stage 1 · Profile and CV' },
  { key: 'written_theory', label: 'Stage 2 · Subject test' },
  { key: 'micro_teaching_demo', label: 'Stage 3 · Teaching demo' },
  { key: 'situational_scenario', label: 'Stage 4 · Classroom scenario' },
  { key: 'hr_policy_briefing', label: 'Stage 5 · School policies' },
];

const SCORED_STAGES = new Set(['written_theory', 'micro_teaching_demo', 'situational_scenario']);

export interface ReportInput {
  candidates: Candidate[];
  stageResults: Pick<StageResult, 'candidate_id' | 'stage_key'>[];
  interviews: ScheduledInterview[];
  whatsapp: Pick<WhatsAppMessageLog, 'template_name' | 'status' | 'created_at'>[];
  calls: Pick<ScreeningCall, 'status' | 'mode' | 'started_at' | 'price_inr' | 'interest' | 'recommendation'>[];
  /** How each candidate came in: 'school' (added or imported by the school) or 'self' (applied on their own). */
  origin: Record<string, 'school' | 'self'>;
  /** Names of the people who review, by user id, for the reviewer table. */
  reviewers: { id: string; name: string; role_name: string }[];
  /** Counted only when it falls on or after this time. Null counts everything. */
  since: Date | null;
  hourlyCostInr?: number;
  /** Subscription or other fixed cost to set against the saving, in rupees. Optional. */
  now?: Date;
}

export interface ManagementReport {
  range_days: number | null;
  leads: { total: number; added_by_school: number; self_registered: number };
  invites: {
    candidates_invited: number;
    messages: { total: number; delivered: number; read: number; failed: number };
    by_template: { template: string; sent: number }[];
  };
  outreach: { calls_placed: number; answered: number; interested: number; recommended: number; no_answer: number };
  funnel: { key: string; label: string; finished: number; percent_of_registered: number }[];
  interviews: {
    booked: number;
    google_meet_links: number;
    own_links: number;
    free_rooms: number;
    held: number;
    cancelled: number;
    upcoming: number;
    by_round: { round: string; booked: number; held: number }[];
  };
  reviewers: {
    id: string;
    name: string;
    role_name: string;
    booked: number;
    attended: number;
    yes: number;
    no: number;
  }[];
  saved: {
    hourly_cost_inr: number;
    lines: { key: SavedKey; label: string; count: number; minutes: number; rupees: number }[];
    total_minutes: number;
    total_hours: number;
    gross_inr: number;
    /** What AI calls were charged to the school, taken off the saving. */
    ai_call_spend_inr: number;
    net_inr: number;
  };
}

const after = (iso: string | undefined, since: Date | null): boolean => {
  if (!iso) return false;
  if (!since) return true;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t >= since.getTime();
};

export function buildReport(input: ReportInput): ManagementReport {
  const { since } = input;
  const now = input.now ?? new Date();
  const hourly = input.hourlyCostInr && input.hourlyCostInr > 0 ? input.hourlyCostInr : DEFAULT_HR_HOURLY_INR;

  // --- Leads: who came in, and how ---
  const inRange = input.candidates.filter((c) => after(c.created_at, since));
  const added = inRange.filter((c) => input.origin[c.id] === 'school').length;
  const leads = { total: inRange.length, added_by_school: added, self_registered: inRange.length - added };

  // --- Invites: WhatsApp, to candidates ---
  const invited = input.candidates.filter((c) => after(c.whatsapp_invite_sent_at, since)).length;
  const logs = input.whatsapp.filter((m) => after(m.created_at, since) && m.status !== 'skipped_no_consent' && m.status !== 'queued');
  const byTemplate = new Map<string, number>();
  for (const m of logs) byTemplate.set(m.template_name, (byTemplate.get(m.template_name) ?? 0) + 1);
  const invites = {
    candidates_invited: invited,
    messages: {
      total: logs.length,
      delivered: logs.filter((m) => m.status === 'delivered' || m.status === 'read').length,
      read: logs.filter((m) => m.status === 'read').length,
      failed: logs.filter((m) => m.status === 'failed').length,
    },
    by_template: [...byTemplate.entries()].map(([template, sent]) => ({ template, sent })).sort((a, b) => b.sent - a.sent),
  };

  // --- Outreach: the AI screening calls (demo calls are not real outreach) ---
  const calls = input.calls.filter((c) => c.mode === 'live' && after(c.started_at, since));
  const answered = calls.filter((c) => c.status === 'completed');
  const outreach = {
    calls_placed: calls.length,
    answered: answered.length,
    interested: answered.filter((c) => c.interest === 'interested').length,
    recommended: answered.filter((c) => c.recommendation === 'proceed').length,
    no_answer: calls.filter((c) => c.status === 'no_answer' || c.status === 'busy').length,
  };

  // --- Funnel: how many finished each stage, of those who registered in the period ---
  const registeredIds = new Set(inRange.map((c) => c.id));
  const finishedBy = new Map<string, Set<string>>();
  for (const r of input.stageResults) {
    if (!registeredIds.has(r.candidate_id)) continue;
    if (!finishedBy.has(r.stage_key)) finishedBy.set(r.stage_key, new Set());
    finishedBy.get(r.stage_key)!.add(r.candidate_id);
  }
  const funnel = FUNNEL_STAGES.map((s) => {
    const finished = finishedBy.get(s.key)?.size ?? 0;
    return { key: s.key, label: s.label, finished, percent_of_registered: registeredIds.size ? Math.round((finished / registeredIds.size) * 100) : 0 };
  });

  // --- Interviews ---
  const booked = input.interviews.filter((i) => after(i.created_at, since));
  const held = booked.filter((i) => i.status === 'completed');
  const rounds = new Map<string, { booked: number; held: number }>();
  for (const i of booked) {
    const r = rounds.get(i.round) ?? { booked: 0, held: 0 };
    r.booked += 1;
    if (i.status === 'completed') r.held += 1;
    rounds.set(i.round, r);
  }
  const interviews = {
    booked: booked.length,
    google_meet_links: booked.filter((i) => i.meeting_provider === 'google_meet').length,
    own_links: booked.filter((i) => i.meeting_provider === 'pasted').length,
    free_rooms: booked.filter((i) => !i.meeting_provider || i.meeting_provider === 'jitsi').length,
    held: held.length,
    cancelled: booked.filter((i) => i.status === 'cancelled').length,
    upcoming: input.interviews.filter((i) => i.status === 'scheduled' && new Date(i.scheduled_at).getTime() >= now.getTime()).length,
    by_round: [...rounds.entries()].map(([round, v]) => ({ round, ...v })),
  };

  // --- Reviewers: who was booked, who attended, what they decided ---
  const decisions = new Map<string, { yes: number; no: number }>();
  for (const c of input.candidates) {
    for (const d of c.interview_decisions ?? []) {
      if (!after(d.decided_at, since)) continue;
      const v = decisions.get(d.reviewer_id) ?? { yes: 0, no: 0 };
      if (d.decision === 'accepted') v.yes += 1; else v.no += 1;
      decisions.set(d.reviewer_id, v);
    }
  }
  const reviewers = input.reviewers.map((r) => {
    const mine = booked.filter((i) => i.assigned_user_id === r.id);
    const d = decisions.get(r.id) ?? { yes: 0, no: 0 };
    return { id: r.id, name: r.name, role_name: r.role_name, booked: mine.length, attended: mine.filter((i) => i.status === 'completed').length, yes: d.yes, no: d.no };
  }).filter((r) => r.booked > 0 || r.yes + r.no > 0);

  // --- What it saved ---
  const finishedScored = input.stageResults.filter((r) => SCORED_STAGES.has(r.stage_key) && registeredIds.has(r.candidate_id)).length;
  const reports = inRange.filter((c) => (c.total_ai_score ?? 0) > 0).length;
  const counts: Record<SavedKey, number> = {
    cv_read: inRange.filter((c) => !!c.resume_analysis).length,
    screening_call: outreach.answered,
    whatsapp_invite: invites.messages.total,
    interview_booked: interviews.booked - interviews.cancelled,
    stage_marked: finishedScored,
    report_written: reports,
  };
  const lines = (Object.keys(SAVED_MINUTES) as SavedKey[]).map((key) => {
    const minutes = counts[key] * SAVED_MINUTES[key];
    return { key, label: SAVED_LABEL[key], count: counts[key], minutes, rupees: Math.round((minutes / 60) * hourly) };
  });
  const totalMinutes = lines.reduce((n, l) => n + l.minutes, 0);
  const gross = lines.reduce((n, l) => n + l.rupees, 0);
  const aiSpend = Math.round(answered.reduce((n, c) => n + (c.price_inr ?? 0), 0));

  return {
    range_days: since ? Math.round((now.getTime() - since.getTime()) / 86_400_000) : null,
    leads,
    invites,
    outreach,
    funnel,
    interviews,
    reviewers,
    saved: {
      hourly_cost_inr: hourly,
      lines,
      total_minutes: totalMinutes,
      total_hours: Math.round((totalMinutes / 60) * 10) / 10,
      gross_inr: gross,
      ai_call_spend_inr: aiSpend,
      net_inr: Math.max(0, gross - aiSpend),
    },
  };
}
