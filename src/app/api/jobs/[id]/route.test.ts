import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Job = Record<string, unknown>;
let jobs: Job[] = [];
const updateJob = vi.fn((id: string, patch: Job) => {
  const j = jobs.find((x) => x.id === id);
  if (!j) return undefined;
  Object.assign(j, patch);
  return j;
});
const deleteJob = vi.fn((id: string) => {
  const before = jobs.length;
  jobs = jobs.filter((x) => x.id !== id);
  return jobs.length < before;
});
vi.mock('@/lib/db', () => ({
  db: {
    getJobById: (id: string) => jobs.find((j) => j.id === id),
    updateJob: (id: string, patch: Job) => updateJob(id, patch),
    deleteJob: (id: string) => deleteJob(id),
    isSchoolActive: () => true,
    getSchoolById: () => ({ id: 's1', branches: [{ id: 'br_b', name: 'Gachibowli', location: 'Hyderabad' }] }),
  },
}));

let role = 'HR';
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    auditAsStaff: () => undefined,
    requireSchoolAccess: async (schoolId: string, opts?: { anyOf?: string[] }) => {
      if (opts?.anyOf && !opts.anyOf.includes(role)) throw new actual.AuthError('Not allowed.', 403);
      return { role, schoolId, user: { id: 'u1', name: 'Staff' } };
    },
  };
});

import { DELETE, GET, PATCH } from './route';

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patch = (id: string, body: object) =>
  PATCH(new NextRequest(`http://localhost/api/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), ctx(id));
const del = (id: string) => DELETE(new NextRequest(`http://localhost/api/jobs/${id}`, { method: 'DELETE' }), ctx(id));

beforeEach(() => {
  vi.clearAllMocks();
  role = 'HR';
  jobs = [{ id: 'job_1', school_id: 's1', title: 'Physics Faculty', subject: 'Physics', segment: 'Secondary', branch: 'Manneguda', status: 'active' }];
});

describe('editing a vacancy', () => {
  it('lets HR and the school admin change it', async () => {
    for (const r of ['HR', 'SCHOOL_ADMIN']) {
      role = r;
      const res = await patch('job_1', { title: ' Senior Physics Faculty ', salary_range: '8 LPA', grades: ['9', '10'] });
      expect(res.status).toBe(200);
      expect((await res.json()).job.title).toBe('Senior Physics Faculty');
    }
    expect(jobs[0].grades).toEqual(['9', '10']);
  });

  it('keeps the owner and id out of reach, and ignores fields it does not know', async () => {
    await patch('job_1', { id: 'job_x', school_id: 's2', hacked: true, title: 'New' });
    const patchArg = updateJob.mock.calls[0][1];
    expect(patchArg).toEqual({ title: 'New' });
  });

  it('moves the vacancy to another campus using the school\'s own list only', async () => {
    await patch('job_1', { target_branch_id: 'br_b' });
    expect(jobs[0]).toMatchObject({ target_branch_id: 'br_b', branch: 'Gachibowli' });
    await patch('job_1', { target_branch_id: 'not_a_branch' });
    expect(jobs[0].target_branch_id).toBe('br_b');
  });

  it('closes and reopens a vacancy', async () => {
    await patch('job_1', { status: 'closed' });
    expect(jobs[0].status).toBe('closed');
    await patch('job_1', { status: 'bogus' });
    expect(jobs[0].status).toBe('closed');
  });

  it('refuses an empty title and an empty grade list', async () => {
    expect((await patch('job_1', { title: '   ' })).status).toBe(400);
    expect((await patch('job_1', { grades: [] })).status).toBe(400);
    expect(updateJob).not.toHaveBeenCalled();
  });

  it('is not open to reviewers, and says so when the vacancy is missing', async () => {
    role = 'REPORTING_MANAGER';
    expect((await patch('job_1', { title: 'x' })).status).toBe(403);
    role = 'HR';
    expect((await patch('nope', { title: 'x' })).status).toBe(404);
  });
});

describe('deleting a vacancy', () => {
  it('lets HR delete one', async () => {
    expect((await del('job_1')).status).toBe(200);
    expect(jobs).toHaveLength(0);
  });
  it('lets the school admin delete one', async () => {
    role = 'SCHOOL_ADMIN';
    expect((await del('job_1')).status).toBe(200);
  });
  it('is not open to reviewers', async () => {
    role = 'INSTITUTE_HEAD';
    expect((await del('job_1')).status).toBe(403);
    expect(jobs).toHaveLength(1);
  });
  it('reports a missing vacancy', async () => {
    expect((await del('nope')).status).toBe(404);
  });
});

describe('the public vacancy page', () => {
  it('does not show a closed vacancy', async () => {
    jobs[0].status = 'closed';
    const res = await GET(new NextRequest('http://localhost/api/jobs/job_1'), ctx('job_1'));
    expect(res.status).toBe(404);
  });
});
