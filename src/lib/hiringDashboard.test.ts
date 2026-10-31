import { describe, expect, it } from 'vitest';
import { candidateState, countByTab, stagesDone, TEST_STAGE_COUNT } from './candidateProgress';
import { buildChecklist, checklistProgress, nextStep } from './onboardingChecklist';

const base = {
  status: 'in_progress' as const,
  shortlist_status: 'pending' as const,
  current_stage_key: 'identity_verification' as const,
};

describe('candidateState', () => {
  it('calls a candidate who has not started "Invited"', () => {
    expect(candidateState({ ...base, stages_completed: 0 })).toMatchObject({ tab: 'in_progress', label: 'Invited', stagesDone: 0 });
  });

  it('says which stage a candidate is on', () => {
    expect(candidateState({ ...base, stages_completed: 2 })).toMatchObject({ tab: 'in_progress', label: 'Stage 3 of 5' });
  });

  it('puts a candidate who finished every stage in "Ready to review"', () => {
    expect(candidateState({ ...base, stages_completed: TEST_STAGE_COUNT })).toMatchObject({ tab: 'ready', label: 'Ready to review', tone: 'amber' });
  });

  it('lets a decision win over progress', () => {
    expect(candidateState({ ...base, stages_completed: 5, shortlist_status: 'shortlisted' }).tab).toBe('shortlisted');
    expect(candidateState({ ...base, stages_completed: 5, status: 'hired' }).tab).toBe('selected');
    expect(candidateState({ ...base, stages_completed: 5, status: 'rejected' }).tab).toBe('rejected');
    expect(candidateState({ ...base, selected_at: '2026-10-01T00:00:00Z' }).tab).toBe('selected');
  });

  it('tells a withdrawal from a school rejection', () => {
    expect(candidateState({ ...base, rejected_by_candidate_at: '2026-10-01T00:00:00Z' }).label).toBe('Withdrew');
    expect(candidateState({ ...base, rejected_by_school_at: '2026-10-01T00:00:00Z' }).label).toBe('Not moving forward');
  });

  it('falls back to the current stage for rows without a count', () => {
    expect(stagesDone({ current_stage_key: 'micro_teaching_demo' })).toBe(2);
    expect(stagesDone({ current_stage_key: 'hr_policy_briefing' })).toBe(4);
  });

  it('keeps a count inside 0 to 5', () => {
    expect(stagesDone({ stages_completed: 9, current_stage_key: 'identity_verification' })).toBe(5);
    expect(stagesDone({ stages_completed: -2, current_stage_key: 'identity_verification' })).toBe(0);
  });
});

describe('countByTab', () => {
  it('counts every candidate once', () => {
    const counts = countByTab([
      { ...base, stages_completed: 1 },
      { ...base, stages_completed: 5 },
      { ...base, stages_completed: 5, status: 'hired' },
      { ...base, status: 'rejected' },
      { ...base, shortlist_status: 'shortlisted' },
    ]);
    expect(counts).toEqual({ in_progress: 1, ready: 1, shortlisted: 1, selected: 1, rejected: 1 });
  });
});

describe('the get-started checklist', () => {
  const empty = { tests: 0, policies: 0, vacancies: 0, candidates: 0, teamMembers: 1 };

  it('starts with nothing done for a brand new school', () => {
    const items = buildChecklist({ school: { branches: [], whatsapp_hiring: { status: 'not_connected' } }, counts: empty });
    expect(items).toHaveLength(7);
    expect(items.every((i) => !i.done)).toBe(true);
    expect(checklistProgress(items)).toEqual({ done: 0, total: 7, percent: 0 });
    expect(nextStep(items)?.key).toBe('school');
  });

  it('ticks each step from what the school already has', () => {
    const items = buildChecklist({
      school: { branches: [{}], whatsapp_hiring: { status: 'connected' } },
      counts: { tests: 1, policies: 2, vacancies: 0, candidates: 3, teamMembers: 4 },
    });
    const done = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(done).toEqual({ school: true, whatsapp: true, test: true, policy: true, vacancy: false, candidates: true, team: true });
    expect(nextStep(items)?.key).toBe('vacancy');
  });

  it('counts a team of one as not yet invited', () => {
    const items = buildChecklist({ school: null, counts: { ...empty, teamMembers: 1 } });
    expect(items.find((i) => i.key === 'team')?.done).toBe(false);
  });

  it('gives every step somewhere to go', () => {
    for (const item of buildChecklist({ school: null, counts: empty })) {
      expect(Boolean(item.href) !== Boolean(item.action)).toBe(true);
    }
  });

  it('is complete at 100 percent', () => {
    const items = buildChecklist({
      school: { branches: [{}], whatsapp_hiring: { status: 'connected' } },
      counts: { tests: 1, policies: 1, vacancies: 1, candidates: 1, teamMembers: 2 },
    });
    expect(checklistProgress(items).percent).toBe(100);
    expect(nextStep(items)).toBeUndefined();
  });
});
