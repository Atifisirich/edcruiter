import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Cand = { id: string; school_id: string; name: string; email: string };
let candidates: Cand[] = [];
const audit = vi.fn();
let access: { schoolId: string; role: string } | Error = { schoolId: 's1', role: 'SCHOOL_ADMIN' };
const accessCalls: unknown[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    getCandidateById: (schoolId: string, id: string) => candidates.find((c) => c.school_id === schoolId && c.id === id),
    deleteCandidate: (schoolId: string, id: string) => {
      const before = candidates.length;
      candidates = candidates.filter((c) => !(c.school_id === schoolId && c.id === id));
      return candidates.length !== before;
    },
  },
}));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    requireSchoolAccess: async (...args: unknown[]) => {
      accessCalls.push(args);
      if (access instanceof Error) throw access;
      return { ...access, user: { id: 'u1', name: 'Anita' }, isSuperAdmin: access.role === 'SUPER_ADMIN' };
    },
    auditAsStaff: (...args: unknown[]) => audit(...args),
  };
});

import { POST } from './route';
import { AuthError } from '@/lib/auth';

const req = (body: object) => new NextRequest('http://localhost/api/candidates/delete', { method: 'POST', body: JSON.stringify(body) });
const cand = (id: string, school_id = 's1'): Cand => ({ id, school_id, name: `Name ${id}`, email: `${id}@x.in` });

beforeEach(() => {
  vi.clearAllMocks();
  accessCalls.length = 0;
  access = { schoolId: 's1', role: 'SCHOOL_ADMIN' };
  candidates = [cand('a'), cand('b'), cand('keep'), cand('other', 's2')];
});

describe('deleting candidates', () => {
  it('asks for hiring-team access (the school admin and HR)', async () => {
    await POST(req({ school_id: 's1', candidate_ids: ['a'] }));
    expect(accessCalls[0]).toEqual(['s1', { anyOf: ['SCHOOL_ADMIN', 'HR'] }]);
  });

  it('deletes only the ticked candidates and logs each one by name', async () => {
    const res = await POST(req({ school_id: 's1', candidate_ids: ['a', 'b', 'a'] }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toEqual(['a', 'b']);
    expect(candidates.map((c) => c.id)).toEqual(['keep', 'other']);
    expect(audit).toHaveBeenCalledTimes(2);
    expect(audit.mock.calls[0][2]).toMatchObject({ action: 'CANDIDATE_DELETED', resource: 'Candidate: Name a' });
  });

  it("never deletes another school's candidate", async () => {
    const body = await (await POST(req({ school_id: 's1', candidate_ids: ['other'] }))).json();
    expect(body.deleted).toEqual([]);
    expect(body.not_found).toEqual(['other']);
    expect(candidates.some((c) => c.id === 'other')).toBe(true);
  });

  it('refuses an empty list', async () => {
    const res = await POST(req({ school_id: 's1', candidate_ids: [] }));
    expect(res.status).toBe(400);
  });

  it('refuses a reviewer, deleting nothing', async () => {
    access = new AuthError('Your role does not have access to this resource.', 403);
    const res = await POST(req({ school_id: 's1', candidate_ids: ['a'] }));
    expect(res.status).toBe(403);
    expect(candidates).toHaveLength(4);
  });
});
