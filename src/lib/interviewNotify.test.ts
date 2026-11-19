import { describe, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ db: {} }));
import { roundAudience } from './interviewNotify';
import type { ReviewRound, User } from './types';

const u = (id: string, role: User['role'], role_id?: string, email = `${id}@school.in`): User => ({ id, school_id: 's', name: id, email, role, role_id });
const round: ReviewRound = { id: 'principal', name: 'Principal', role_ids: ['INSTITUTE_HEAD'] };

describe('roundAudience', () => {
  const users = [
    u('admin', 'SCHOOL_ADMIN'), u('hr', 'HR'), u('p1', 'INSTITUTE_HEAD', 'INSTITUTE_HEAD'), u('p2', 'INSTITUTE_HEAD', 'INSTITUTE_HEAD'),
    u('hod', 'REPORTING_MANAGER', 'REPORTING_MANAGER'), u('noemail', 'INSTITUTE_HEAD', 'INSTITUTE_HEAD', 'x@seed.local'),
  ];

  it('tells the interviewer, the rest of the round and HR, each once, and never whoever acted', () => {
    const a = roundAudience(users, round, { assignedId: 'p1', skipId: 'hr' });
    expect(a.assigned?.id).toBe('p1');
    expect(a.team.map((x) => x.id)).toEqual(['p2']);
    // HR acted, so the admin is told instead.
    expect(a.hr.map((x) => x.id)).toEqual(['admin']);
  });

  it('tells HR rather than the admin when HR did not act', () => {
    expect(roundAudience(users, round, { assignedId: 'p2', skipId: 'admin' }).hr.map((x) => x.id)).toEqual(['hr']);
  });
});
