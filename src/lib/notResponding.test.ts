import { describe, expect, it } from 'vitest';
import { isNotResponding, moveBack, reachOf, reachText, setAside, setAsideProblem } from './notResponding';
import { countByTab } from './candidateProgress';

const base = { status: 'in_progress' as const, not_responding: undefined, selected_at: undefined, lead: undefined };

describe('Not responding: who can be set aside', () => {
  it('lets a candidate who is still in progress, ready, shortlisted or closed be set aside', () => {
    expect(setAsideProblem(base)).toBeNull();
    expect(setAsideProblem({ ...base, status: 'passed' })).toBeNull();
    expect(setAsideProblem({ ...base, status: 'rejected' })).toBeNull();
  });

  it('keeps selected teachers, lead-list people and people already set aside where they are', () => {
    expect(setAsideProblem({ ...base, status: 'hired' })).toMatch(/selected/);
    expect(setAsideProblem({ ...base, selected_at: '2026-11-01T00:00:00Z' })).toMatch(/selected/);
    expect(setAsideProblem({ ...base, lead: { list_id: 'l1', status: 'waiting' } as never })).toMatch(/lead list/);
    expect(setAsideProblem({ ...base, lead: { list_id: 'l1', status: 'moved' } as never })).toBeNull();
    expect(setAsideProblem({ ...base, not_responding: { at: 'x', by_id: 'u', by_name: 'Priya' } })).toMatch(/Already/);
  });
});

describe('Not responding: moving there and back', () => {
  it('records who moved them and when, from the person signed in', () => {
    const u = setAside({ id: 'user_hr', name: 'Priya (HR)' }, '2026-11-24T10:00:00.000Z');
    expect(u).toEqual({ not_responding: { at: '2026-11-24T10:00:00.000Z', by_id: 'user_hr', by_name: 'Priya (HR)' } });
    expect(isNotResponding(u)).toBe(true);
  });

  it('moving back clears it, and nothing else', () => {
    expect(moveBack()).toEqual({ not_responding: null });
    expect(isNotResponding(moveBack())).toBe(false);
    expect(isNotResponding(undefined)).toBe(false);
  });

  it('the main tabs count only the people passed to them (set-aside people are left out by the list)', () => {
    const counts = countByTab([{ ...base, shortlist_status: 'pending', current_stage_key: 'identity_verification' } as never]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe('Not responding: can they still be reached', () => {
  it('reads phone, WhatsApp (needs consent) and email', () => {
    expect(reachOf({ phone: '+91 98765 43210', email: 'asha@example.com' }, true)).toEqual({ phone: true, whatsapp: true, email: true });
    expect(reachOf({ phone: '98765 43210', email: '' }, false)).toEqual({ phone: true, whatsapp: false, email: false });
    expect(reachOf({ phone: '123', email: 'x@school.local' }, true)).toEqual({ phone: false, whatsapp: false, email: false });
  });

  it('says it in plain words', () => {
    expect(reachText({ phone: true, whatsapp: true, email: true })).toBe('Phone · WhatsApp · Email');
    expect(reachText({ phone: true, whatsapp: false, email: false })).toBe('Phone only');
    expect(reachText({ phone: false, whatsapp: false, email: false })).toBe('No way to reach them');
  });
});
