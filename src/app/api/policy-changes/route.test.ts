import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { HRPolicyDocument, PolicyChangeRequest } from '@/lib/types';

let school: { id: string; name: string; hr_can_edit_policies?: boolean };
let requests: PolicyChangeRequest[] = [];
let policies: HRPolicyDocument[] = [];
const addHRPolicy = vi.fn((p: HRPolicyDocument) => { policies.push(p); return p; });
vi.mock('@/lib/db', () => ({
  db: {
    getSchoolById: () => school,
    updateSchool: (_id: string, u: Record<string, unknown>) => { Object.assign(school, u); return school; },
    getPolicyChanges: () => requests,
    getPolicyChange: (id: string) => requests.find((r) => r.id === id),
    addPolicyChange: (r: PolicyChangeRequest) => { requests.unshift(r); return r; },
    updatePolicyChange: (id: string, patch: Partial<PolicyChangeRequest>) => { const r = requests.find((x) => x.id === id); if (r) Object.assign(r, patch); return r; },
    getHRPoliciesBySchool: () => policies,
    addHRPolicy: (p: HRPolicyDocument) => addHRPolicy(p),
    updateHRPolicy: (_s: string, id: string, u: Partial<HRPolicyDocument>) => { const p = policies.find((x) => x.id === id); if (p) Object.assign(p, u); return p; },
    deleteHRPolicy: (_s: string, id: string) => { policies = policies.filter((p) => p.id !== id); return true; },
  },
}));

let role = 'HR';
let userId = 'u_hr';
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const ctx = () => ({ role, schoolId: 's1', isSuperAdmin: false, user: { id: userId, name: role === 'HR' ? 'Priya' : 'Admin' } });
  return { ...actual, requireStaff: async () => ctx(), requireSchoolAccess: async () => ctx(), assertSchoolActive: () => undefined, auditAsStaff: () => undefined };
});

import { GET, POST } from './route';

const post = (body: object) => POST(new NextRequest('http://localhost/api/policy-changes', { method: 'POST', body: JSON.stringify({ school_id: 's1', ...body }) }));
const get = () => GET(new NextRequest('http://localhost/api/policy-changes?school_id=s1'));
const newPolicy = { action: 'propose', kind: 'document_create', payload: { title: 'Dress code', content: 'Neat dress.' } };

beforeEach(() => {
  vi.clearAllMocks();
  school = { id: 's1', name: 'Green Valley' };
  requests = [];
  policies = [];
  role = 'HR';
  userId = 'u_hr';
});

describe('who may switch HR editing on', () => {
  it('only the school admin', async () => {
    role = 'HR';
    expect((await post({ action: 'set_access', enabled: true })).status).toBe(403);
    role = 'SCHOOL_ADMIN';
    expect((await post({ action: 'set_access', enabled: true })).status).toBe(200);
    expect(school.hr_can_edit_policies).toBe(true);
    await post({ action: 'set_access', enabled: false });
    expect(school.hr_can_edit_policies).toBe(false);
  });
});

describe('HR proposing a change', () => {
  it('is refused while the admin has not allowed it', async () => {
    const res = await post(newPolicy);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/not allowed/);
    expect(requests).toHaveLength(0);
  });
  it('waits for approval and changes nothing yet, once allowed', async () => {
    school.hr_can_edit_policies = true;
    const res = await post(newPolicy);
    expect(res.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: 'pending', summary: 'Add the policy: Dress code' });
    expect(policies).toHaveLength(0);
  });
  it('is not for reviewers', async () => {
    school.hr_can_edit_policies = true;
    role = 'REPORTING_MANAGER';
    expect((await post(newPolicy)).status).toBe(403);
  });
  it('keeps the before text of a policy being edited, and refuses one that is gone', async () => {
    school.hr_can_edit_policies = true;
    policies = [{ id: 'p1', school_id: 's1', title: 'Leave', content: 'Ten days.', category: 'general', required: true, uploaded_at: 'x' }];
    await post({ action: 'propose', kind: 'document_update', payload: { id: 'p1', content: 'Twelve days.' } });
    expect(requests[0].before).toEqual({ title: 'Leave', content: 'Ten days.', required: true });
    expect((await post({ action: 'propose', kind: 'document_update', payload: { id: 'nope', content: 'x' } })).status).toBe(404);
  });
  it('rejects a badly formed proposal', async () => {
    school.hr_can_edit_policies = true;
    expect((await post({ action: 'propose', kind: 'document_create', payload: { title: '' } })).status).toBe(400);
  });
});

describe('the admin deciding', () => {
  beforeEach(async () => {
    school.hr_can_edit_policies = true;
    await post(newPolicy);
    role = 'SCHOOL_ADMIN';
    userId = 'u_admin';
  });
  it('applies the change only when approved', async () => {
    expect(policies).toHaveLength(0);
    const res = await post({ action: 'decide', id: requests[0].id, decision: 'approve', note: 'Good.' });
    expect(res.status).toBe(200);
    expect(policies).toHaveLength(1);
    expect(requests[0]).toMatchObject({ status: 'approved', note: 'Good.', decided_by: { id: 'u_admin' } });
  });
  it('changes nothing when rejected, and tells HR why', async () => {
    await post({ action: 'decide', id: requests[0].id, decision: 'reject', note: 'Too vague.' });
    expect(policies).toHaveLength(0);
    expect(requests[0]).toMatchObject({ status: 'rejected', note: 'Too vague.' });
  });
  it('cannot decide the same request twice', async () => {
    await post({ action: 'decide', id: requests[0].id, decision: 'approve' });
    expect((await post({ action: 'decide', id: requests[0].id, decision: 'reject' })).status).toBe(409);
  });
  it('is not open to HR', async () => {
    role = 'HR';
    userId = 'u_hr';
    expect((await post({ action: 'decide', id: requests[0].id, decision: 'approve' })).status).toBe(403);
    expect(policies).toHaveLength(0);
  });
});

describe('what each person sees', () => {
  it('HR sees only their own requests, the admin sees all', async () => {
    school.hr_can_edit_policies = true;
    await post(newPolicy);
    requests.push({ ...requests[0], id: 'other', requested_by: { id: 'u_other_hr', name: 'Someone' } });
    const mine = await (await get()).json();
    expect(mine.requests.map((r: PolicyChangeRequest) => r.id)).not.toContain('other');
    expect(mine).toMatchObject({ is_hr: true, can_review: false, hr_can_edit: true });
    role = 'SCHOOL_ADMIN';
    const all = await (await get()).json();
    expect(all.requests).toHaveLength(2);
    expect(all.can_review).toBe(true);
  });
  it('HR can withdraw their own pending request, and no one else\'s', async () => {
    school.hr_can_edit_policies = true;
    await post(newPolicy);
    const id = requests[0].id;
    userId = 'u_other_hr';
    expect((await post({ action: 'withdraw', id })).status).toBe(404);
    userId = 'u_hr';
    expect((await post({ action: 'withdraw', id })).status).toBe(200);
    expect(requests[0].status).toBe('withdrawn');
  });
});
