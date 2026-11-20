/**
 * HR may be allowed by the school admin to propose changes to the school
 * policies. A proposal is checked here, kept as a pending request, and only
 * applied when the admin approves it. Nothing HR sends changes what candidates
 * see until then.
 */

import { db } from './db';
import {
  HR_POLICY_FIELD_DEFS, formatHrAnswersAsPolicyText, missingRequiredHrFields, type HrPolicyAnswers,
} from './hrPolicyTemplate';
import type { HRPolicyDocument, PolicyChangeKind, PolicyChangeRequest } from './types';

export const STRUCTURED_POLICY_TITLE = 'Faculty HR policy (structured)';
export const MAX_PENDING_PER_PERSON = 20;

export type Proposal =
  | { ok: true; kind: PolicyChangeKind; payload: Record<string, unknown> }
  | { ok: false; error: string };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

/** Checks what HR sent. Only the fields below are kept, whatever else the request carried. */
export function cleanProposal(kind: unknown, payload: unknown): Proposal {
  const p = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;

  if (kind === 'structured') {
    const raw = (p.answers && typeof p.answers === 'object' ? p.answers : {}) as Record<string, unknown>;
    const answers: HrPolicyAnswers = {};
    for (const def of HR_POLICY_FIELD_DEFS) {
      const v = raw[def.id];
      if (typeof v === 'boolean') answers[def.id] = v;
      else if (typeof v === 'number' && Number.isFinite(v)) answers[def.id] = v;
      else if (typeof v === 'string') answers[def.id] = v.trim().slice(0, 500);
    }
    const missing = missingRequiredHrFields(answers);
    if (missing.length) return { ok: false, error: `Fill the required fields first: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}` };
    return { ok: true, kind, payload: { answers } };
  }

  if (kind === 'document_create') {
    const title = text(p.title, 120);
    const content = text(p.content, 8000);
    if (!title || !content) return { ok: false, error: 'A policy needs a title and its text.' };
    return { ok: true, kind, payload: { title, content, required: p.required !== false } };
  }

  if (kind === 'document_update') {
    const id = text(p.id, 80);
    if (!id) return { ok: false, error: 'Choose which policy to change.' };
    const out: Record<string, unknown> = { id };
    if (p.title !== undefined) { const t = text(p.title, 120); if (!t) return { ok: false, error: 'A policy needs a title.' }; out.title = t; }
    if (p.content !== undefined) { const c = text(p.content, 8000); if (!c) return { ok: false, error: 'A policy needs its text.' }; out.content = c; }
    if (typeof p.required === 'boolean') out.required = p.required;
    if (Object.keys(out).length < 2) return { ok: false, error: 'There is nothing to change.' };
    return { ok: true, kind, payload: out };
  }

  if (kind === 'document_delete') {
    const id = text(p.id, 80);
    if (!id) return { ok: false, error: 'Choose which policy to remove.' };
    return { ok: true, kind, payload: { id } };
  }

  return { ok: false, error: 'That kind of change is not supported.' };
}

/** One plain line for the admin's list. */
export function summarise(kind: PolicyChangeKind, payload: Record<string, unknown>, existing?: Pick<HRPolicyDocument, 'title'>): string {
  const name = String(payload.title ?? existing?.title ?? 'a policy');
  switch (kind) {
    case 'structured': return 'Change the structured HR policy (leave, notice period, child safety and the rest)';
    case 'document_create': return `Add the policy: ${name}`;
    case 'document_update': return `Change the policy: ${existing?.title ?? name}`;
    case 'document_delete': return `Remove the policy: ${existing?.title ?? name}`;
  }
}

export type ApplyResult = { ok: true } | { ok: false; error: string };

/** Makes an approved change. Fails, changing nothing, if the policy it refers to is gone. */
export function applyChange(schoolId: string, r: Pick<PolicyChangeRequest, 'kind' | 'payload'>): ApplyResult {
  const now = new Date().toISOString();
  const policies = db.getHRPoliciesBySchool(schoolId);

  if (r.kind === 'structured') {
    const answers = r.payload.answers as HrPolicyAnswers;
    const content = formatHrAnswersAsPolicyText(answers);
    db.updateSchool(schoolId, { hr_policy_answers: answers });
    const existing = policies.find((p) => p.title === STRUCTURED_POLICY_TITLE);
    if (existing) db.updateHRPolicy(schoolId, existing.id, { content });
    else db.addHRPolicy({ id: `policy_${Date.now()}`, school_id: schoolId, title: STRUCTURED_POLICY_TITLE, content, category: 'general', required: true, uploaded_at: now });
    return { ok: true };
  }

  if (r.kind === 'document_create') {
    db.addHRPolicy({
      id: `policy_${Date.now()}`, school_id: schoolId, title: String(r.payload.title), content: String(r.payload.content),
      category: 'general', required: r.payload.required !== false, uploaded_at: now,
    });
    return { ok: true };
  }

  const id = String(r.payload.id);
  if (!policies.some((p) => p.id === id)) return { ok: false, error: 'That policy no longer exists.' };

  if (r.kind === 'document_update') {
    const updates: Partial<HRPolicyDocument> = {};
    if (typeof r.payload.title === 'string') updates.title = r.payload.title;
    if (typeof r.payload.content === 'string') updates.content = r.payload.content;
    if (typeof r.payload.required === 'boolean') updates.required = r.payload.required;
    db.updateHRPolicy(schoolId, id, updates);
    return { ok: true };
  }

  db.deleteHRPolicy(schoolId, id);
  return { ok: true };
}
