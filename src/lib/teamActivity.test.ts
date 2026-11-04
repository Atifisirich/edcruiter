import { describe, expect, it } from 'vitest';
import { actionLabel, summariseWork } from './teamActivity';
import type { AuditLogEntry } from './types';

const log = (actor_id: string, action: string, timestamp: string): AuditLogEntry => ({
  id: `${actor_id}-${action}-${timestamp}`, school_id: 's1', actor_id, actor_name: actor_id === 'hr' ? 'Priya (HR)' : 'Dr Rao', actor_role: 'HR', action, resource: '', details: '', timestamp,
});

describe('summariseWork', () => {
  const logs = [
    log('hr', 'JOB_POSTED', '2026-11-01T09:00:00Z'),
    log('hr', 'CANDIDATE_ADDED_BY_STAFF', '2026-11-02T09:00:00Z'),
    log('hr', 'WHATSAPP_INVITE', '2026-11-02T10:00:00Z'),
    log('hr', 'DECISION_SHORTLIST', '2026-11-03T10:00:00Z'),
    log('hr', 'JOB_POSTED', '2026-09-01T09:00:00Z'),
    log('hod', 'DECISION_ROUND_PASS', '2026-11-03T12:00:00Z'),
    log('hod', 'INTERVIEW_DECISION_RECORDED', '2026-11-03T13:00:00Z'),
    log('system', 'STAGE_SCORED', '2026-11-03T13:00:00Z'),
  ];

  it('counts each person’s work in the period, busiest first, and leaves out the system', () => {
    const people = summariseWork(logs, '2026-10-05T00:00:00Z');
    expect(people.map((p) => p.actorId)).toEqual(['hr', 'hod']);
    expect(people[0].counts).toMatchObject({ vacancies: 1, candidates: 1, invites: 1, shortlist: 1, reviews: 0 });
    expect(people[1].counts.reviews).toBe(2);
    expect(people[0].lastActive).toBe('2026-11-03T10:00:00Z');
  });

  it('counts everything when there is no period', () => {
    expect(summariseWork(logs, null)[0].counts.vacancies).toBe(2);
  });

  it('names actions in plain words', () => {
    expect(actionLabel('DECISION_ROUND_PASS')).toBe('Said yes in a round');
    expect(actionLabel('SOMETHING_NEW')).toBe('Something new');
  });
});
