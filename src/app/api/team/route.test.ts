import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_ROLES } from '@/lib/roles';

let members: Record<string, unknown>[] = [];
let school: Record<string, unknown> = {};
const createUser = vi.fn((u: Record<string, unknown>) => ({ ...u }));
const updateUser = vi.fn((id: string, patch: Record<string, unknown>) => ({ ...members.find((m) => m.id === id), ...patch }));

vi.mock('@/lib/db', () => ({
  db: {
    getUsersBySchool: () => members,
    getSchoolById: () => school,
    getUserByEmail: () => undefined,
    createUser: (u: Record<string, unknown>) => createUser(u),
    updateUser: (id: string, patch: Record<string, unknown>) => updateUser(id, patch),
  },
}));
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    requireSchoolAccess: async () => ({ schoolId: 's1', user: { id: 'u_admin', name: 'Anita' }, role: 'SCHOOL_ADMIN', isSuperAdmin: false }),
    auditAsStaff: () => undefined,
  };
});
vi.mock('@/lib/rateLimit', () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock('@/lib/emailClient', () => ({ emailIsConfigured: () => true }));
vi.mock('@/lib/accountEmails', () => ({ sendSetPasswordEmail: async () => ({ ok: true }) }));

import { GET, PATCH, POST } from './route';

const person = (id: string, role: string, extra: Record<string, unknown> = {}) => ({ id, name: id, email: `${id}@x.in`, role, ...extra });
const req = (method: string, body?: object) => new NextRequest('http://localhost/api/team?school_id=s1', { method, body: body ? JSON.stringify(body) : undefined });

beforeEach(() => {
  vi.clearAllMocks();
  members = [person('u_admin', 'SCHOOL_ADMIN')];
  school = { id: 's1', name: 'Green Valley', billing: { plan: 'starter' } };
});

describe('team members and the plan', () => {
  it('lists the school\'s roles and the plan\'s team limit', async () => {
    const body = await (await GET(req('GET'))).json();
    expect(body.max).toBe(5);
    expect(body.roles).toEqual(DEFAULT_ROLES);
    expect(body.members[0]).toMatchObject({ role_name: 'School admin', role_id: 'SCHOOL_ADMIN' });
  });

  it('adds someone in one of the school\'s own roles, and stores the access level behind it', async () => {
    school = { ...school, roles: [...DEFAULT_ROLES, { id: 'role_sci', name: 'Science HOD', level: 'REPORTING_MANAGER' }] };
    const res = await POST(req('POST', { name: 'Ravi Kumar', email: 'ravi@school.in', role_id: 'role_sci' }));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'REPORTING_MANAGER', role_id: 'role_sci' }));
    expect((await res.json()).member).toMatchObject({ role_name: 'Science HOD' });
  });

  it('refuses a role the school does not have', async () => {
    const res = await POST(req('POST', { name: 'Ravi Kumar', email: 'ravi@school.in', role_id: 'nope' }));
    expect(res.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('stops adding people once the plan\'s limit is reached', async () => {
    members = Array.from({ length: 5 }, (_, i) => person(`u${i}`, i === 0 ? 'SCHOOL_ADMIN' : 'REPORTING_MANAGER'));
    const res = await POST(req('POST', { name: 'Sixth Person', email: 'sixth@school.in', role_id: 'REPORTING_MANAGER' }));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toMatch(/Starter plan includes up to 5 team members/);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('allows more people on a bigger plan', async () => {
    school = { ...school, billing: { plan: 'growth' } };
    members = Array.from({ length: 8 }, (_, i) => person(`u${i}`, i === 0 ? 'SCHOOL_ADMIN' : 'REPORTING_MANAGER'));
    const res = await POST(req('POST', { name: 'Ninth Person', email: 'ninth@school.in', role_id: 'REPORTING_MANAGER' }));
    expect(res.status).toBe(201);
  });

  it('still accepts a plain access level from older callers', async () => {
    const res = await POST(req('POST', { name: 'Ravi Kumar', email: 'ravi@school.in', role: 'INSTITUTE_HEAD' }));
    expect(res.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'INSTITUTE_HEAD' }));
  });

  it('moves a person to another role name', async () => {
    members = [person('u_admin', 'SCHOOL_ADMIN'), person('u_ravi', 'REPORTING_MANAGER')];
    const res = await PATCH(req('PATCH', { id: 'u_ravi', role_id: 'INSTITUTE_HEAD' }));
    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith('u_ravi', { role: 'INSTITUTE_HEAD', role_id: 'INSTITUTE_HEAD' });
  });

  it('keeps the last admin an admin', async () => {
    const res = await PATCH(req('PATCH', { id: 'u_admin', role_id: 'REPORTING_MANAGER' }));
    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
