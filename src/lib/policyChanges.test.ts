import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HRPolicyDocument } from './types';

let policies: HRPolicyDocument[] = [];
const updateSchool = vi.fn();
const addHRPolicy = vi.fn((p: HRPolicyDocument) => { policies.push(p); return p; });
const updateHRPolicy = vi.fn((_s: string, id: string, u: Partial<HRPolicyDocument>) => { const p = policies.find((x) => x.id === id); if (p) Object.assign(p, u); return p; });
const deleteHRPolicy = vi.fn((_s: string, id: string) => { policies = policies.filter((p) => p.id !== id); return true; });
vi.mock('./db', () => ({
  db: {
    getHRPoliciesBySchool: () => policies,
    updateSchool: (...a: unknown[]) => updateSchool(...a),
    addHRPolicy: (p: HRPolicyDocument) => addHRPolicy(p),
    updateHRPolicy: (...a: [string, string, Partial<HRPolicyDocument>]) => updateHRPolicy(...a),
    deleteHRPolicy: (...a: [string, string]) => deleteHRPolicy(...a),
  },
}));

import { STRUCTURED_POLICY_TITLE, applyChange, cleanProposal, summarise } from './policyChanges';
import { HR_POLICY_FIELD_DEFS } from './hrPolicyTemplate';

const doc = (over: Partial<HRPolicyDocument> = {}): HRPolicyDocument => ({ id: 'p1', school_id: 's1', title: 'Dress code', content: 'Neat dress.', category: 'general', required: true, uploaded_at: 'x', ...over });

beforeEach(() => { vi.clearAllMocks(); policies = []; });

describe('checking what HR proposes', () => {
  it('accepts a new policy and tidies it', () => {
    expect(cleanProposal('document_create', { title: '  Dress code ', content: ' Neat. ', required: false, school_id: 'other', hacked: 1 }))
      .toEqual({ ok: true, kind: 'document_create', payload: { title: 'Dress code', content: 'Neat.', required: false } });
  });
  it('refuses a policy with no title or text', () => {
    expect(cleanProposal('document_create', { title: '', content: 'x' })).toMatchObject({ ok: false });
    expect(cleanProposal('document_create', { title: 'x', content: '  ' })).toMatchObject({ ok: false });
  });
  it('needs something to change, and a policy to change it on', () => {
    expect(cleanProposal('document_update', { id: 'p1' })).toMatchObject({ ok: false });
    expect(cleanProposal('document_update', { title: 'x' })).toMatchObject({ ok: false });
    expect(cleanProposal('document_update', { id: 'p1', required: false })).toEqual({ ok: true, kind: 'document_update', payload: { id: 'p1', required: false } });
    expect(cleanProposal('document_delete', {})).toMatchObject({ ok: false });
  });
  it('refuses a structured policy with required answers missing, and keeps only known fields', () => {
    expect(cleanProposal('structured', { answers: {} })).toMatchObject({ ok: false });
    const answers: Record<string, string | number | boolean> = { extra: 'drop me' };
    for (const f of HR_POLICY_FIELD_DEFS.filter((d) => d.required)) answers[f.id] = f.type === 'number' ? 5 : f.type === 'boolean' ? true : f.type === 'select' ? (f.options?.[0] ?? 'x') : 'text';
    const r = cleanProposal('structured', { answers });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.payload.answers as object)).not.toContain('extra');
  });
  it('does not know other kinds of change', () => {
    expect(cleanProposal('policy_video', {})).toMatchObject({ ok: false });
  });
});

describe('the line shown to the admin', () => {
  it('says what the change is, using the policy\'s current name', () => {
    expect(summarise('document_update', { id: 'p1' }, { title: 'Dress code' })).toBe('Change the policy: Dress code');
    expect(summarise('document_delete', { id: 'p1' }, { title: 'Dress code' })).toBe('Remove the policy: Dress code');
    expect(summarise('document_create', { title: 'Leave' })).toBe('Add the policy: Leave');
  });
});

describe('making an approved change', () => {
  it('adds, edits and removes a policy', () => {
    expect(applyChange('s1', { kind: 'document_create', payload: { title: 'Leave', content: 'Ten days.', required: true } })).toEqual({ ok: true });
    expect(policies).toHaveLength(1);
    const id = policies[0].id;
    expect(applyChange('s1', { kind: 'document_update', payload: { id, content: 'Twelve days.' } })).toEqual({ ok: true });
    expect(policies[0].content).toBe('Twelve days.');
    expect(applyChange('s1', { kind: 'document_delete', payload: { id } })).toEqual({ ok: true });
    expect(policies).toHaveLength(0);
  });
  it('changes nothing when the policy has been removed since it was proposed', () => {
    expect(applyChange('s1', { kind: 'document_update', payload: { id: 'gone', title: 'x' } })).toEqual({ ok: false, error: 'That policy no longer exists.' });
    expect(updateHRPolicy).not.toHaveBeenCalled();
  });
  it('updates the structured policy in place rather than adding a second', () => {
    policies = [doc({ id: 'st', title: STRUCTURED_POLICY_TITLE, content: 'old' })];
    applyChange('s1', { kind: 'structured', payload: { answers: {} } });
    expect(updateSchool).toHaveBeenCalledWith('s1', { hr_policy_answers: {} });
    expect(updateHRPolicy).toHaveBeenCalled();
    expect(addHRPolicy).not.toHaveBeenCalled();
  });
  it('adds the structured policy the first time', () => {
    applyChange('s1', { kind: 'structured', payload: { answers: {} } });
    expect(addHRPolicy).toHaveBeenCalled();
    expect(policies[0].title).toBe(STRUCTURED_POLICY_TITLE);
  });
});
