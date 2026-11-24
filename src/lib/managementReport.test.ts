import { describe, expect, it } from 'vitest';
import { buildReport, DEFAULT_HR_HOURLY_INR, SAVED_MINUTES, type ReportInput } from './managementReport';
import type { Candidate, ScheduledInterview } from './types';

const NOW = new Date('2026-11-24T10:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const cand = (id: string, over: Partial<Candidate> = {}) => ({ id, created_at: daysAgo(2), ...over } as Candidate);
const intv = (id: string, over: Partial<ScheduledInterview> = {}) =>
  ({ id, round: 'principal', status: 'scheduled', scheduled_at: daysAgo(-3), created_at: daysAgo(1), assigned_user_id: 'u1', ...over } as ScheduledInterview);

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  candidates: [], stageResults: [], interviews: [], whatsapp: [], calls: [], origin: {}, reviewers: [], since: null, now: NOW, ...over,
});

describe('management report', () => {
  it('splits leads into added by the school and registered on their own', () => {
    const r = buildReport(base({ candidates: [cand('a'), cand('b'), cand('c')], origin: { a: 'school', b: 'school', c: 'self' } }));
    expect(r.leads).toEqual({ total: 3, added_by_school: 2, self_registered: 1 });
  });

  it('counts only what happened inside the period', () => {
    const since = new Date(NOW.getTime() - 7 * 86_400_000);
    const r = buildReport(base({ since, candidates: [cand('new'), cand('old', { created_at: daysAgo(40) })] }));
    expect(r.leads.total).toBe(1);
  });

  it('shows how many finished each stage, once per candidate', () => {
    const r = buildReport(base({
      candidates: [cand('a'), cand('b')],
      stageResults: [
        { candidate_id: 'a', stage_key: 'identity_verification' }, { candidate_id: 'b', stage_key: 'identity_verification' },
        { candidate_id: 'a', stage_key: 'written_theory' }, { candidate_id: 'a', stage_key: 'written_theory' },
      ],
    }));
    expect(r.funnel[0]).toMatchObject({ finished: 2, percent_of_registered: 100 });
    expect(r.funnel[1]).toMatchObject({ finished: 1, percent_of_registered: 50 });
    expect(r.funnel[2].finished).toBe(0);
  });

  it('counts Meet links, held and cancelled interviews and the reviewer who attended', () => {
    const r = buildReport(base({
      interviews: [
        intv('1', { meeting_provider: 'google_meet', status: 'completed' }),
        intv('2', { meeting_provider: 'google_meet' }),
        intv('3', { meeting_provider: 'pasted', status: 'cancelled' }),
        intv('4', { meeting_provider: 'jitsi', assigned_user_id: 'u2' }),
      ],
      reviewers: [{ id: 'u1', name: 'Asha', role_name: 'Principal' }, { id: 'u2', name: 'Ravi', role_name: 'Coordinator' }],
    }));
    expect(r.interviews).toMatchObject({ booked: 4, google_meet_links: 2, own_links: 1, free_rooms: 1, held: 1, cancelled: 1 });
    expect(r.reviewers.find((p) => p.id === 'u1')).toMatchObject({ booked: 3, attended: 1 });
    expect(r.reviewers.find((p) => p.id === 'u2')).toMatchObject({ booked: 1, attended: 0 });
  });

  it('counts WhatsApp messages that actually went out, not blocked or queued ones', () => {
    const r = buildReport(base({
      whatsapp: [
        { template_name: 'assessment_invite', status: 'read', created_at: daysAgo(1) },
        { template_name: 'assessment_invite', status: 'delivered', created_at: daysAgo(1) },
        { template_name: 'round_scheduled', status: 'failed', created_at: daysAgo(1) },
        { template_name: 'assessment_invite', status: 'skipped_no_consent', created_at: daysAgo(1) },
      ],
    }));
    expect(r.invites.messages).toEqual({ total: 3, delivered: 2, read: 1, failed: 1 });
  });

  it('values the saving from the minutes each step replaces, and takes AI call spend off', () => {
    const r = buildReport(base({
      calls: [{ status: 'completed', mode: 'live', started_at: daysAgo(1), price_inr: 36, interest: 'interested', recommendation: 'proceed' }],
    }));
    const line = r.saved.lines.find((l) => l.key === 'screening_call')!;
    expect(line).toMatchObject({ count: 1, minutes: SAVED_MINUTES.screening_call });
    expect(r.saved.gross_inr).toBe(Math.round((SAVED_MINUTES.screening_call / 60) * DEFAULT_HR_HOURLY_INR));
    expect(r.saved.ai_call_spend_inr).toBe(36);
    expect(r.saved.net_inr).toBe(Math.max(0, r.saved.gross_inr - 36));
  });

  it("uses the school's own hourly cost, and never counts demo calls", () => {
    const r = buildReport(base({
      hourlyCostInr: 600,
      calls: [
        { status: 'completed', mode: 'demo', started_at: daysAgo(1) },
        { status: 'completed', mode: 'live', started_at: daysAgo(1) },
      ],
    }));
    expect(r.outreach.calls_placed).toBe(1);
    expect(r.saved.hourly_cost_inr).toBe(600);
    expect(r.saved.lines.find((l) => l.key === 'screening_call')!.rupees).toBe(Math.round((SAVED_MINUTES.screening_call / 60) * 600));
  });

  it('is all zeros, not an error, for a school with nothing yet', () => {
    const r = buildReport(base());
    expect(r.leads.total).toBe(0);
    expect(r.funnel.every((f) => f.finished === 0 && f.percent_of_registered === 0)).toBe(true);
    expect(r.saved.net_inr).toBe(0);
  });
});
