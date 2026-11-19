import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Pack = Record<string, unknown> & { id: string; status: string; mcqs: Record<string, unknown>[] };
let pack: Pack;
const rubrics: Record<string, unknown>[] = [];
const updateAssessmentPack = vi.fn((id: string, patch: Record<string, unknown>) => {
  if (id !== pack.id) return undefined;
  pack = { ...pack, ...patch } as Pack;
  return pack;
});
vi.mock('@/lib/db', () => ({
  db: {
    getAssessmentPackById: (id: string) => (id === pack.id ? pack : undefined),
    updateAssessmentPack: (id: string, patch: Record<string, unknown>) => updateAssessmentPack(id, patch),
    addOrUpdateRubric: (r: Record<string, unknown>) => { rubrics.push(r); return r; },
  },
}));

let role = 'HR';
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    assertSchoolActive: () => undefined,
    auditAsStaff: () => undefined,
    requireSchoolAccess: async (schoolId: string, opts?: { anyOf?: string[] }) => {
      if (opts?.anyOf && !opts.anyOf.includes(role)) throw new actual.AuthError('Not allowed.', 403);
      return { role, schoolId, user: { id: 'u1', name: 'Staff' } };
    },
  };
});

import { PATCH } from './route';

const question = (i: number) => ({
  id: `q${i}`, question_text: `Question ${i}?`, options: [`right ${i}`, `a ${i}`, `b ${i}`, `c ${i}`], correct_option: `right ${i}`, category: 'subject',
});
const sixQuestions = Array.from({ length: 6 }, (_, i) => question(i));

const send = (body: object, id = 'pack_1') =>
  PATCH(new NextRequest(`http://localhost/api/assessment-packs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  rubrics.length = 0;
  role = 'HR';
  pack = {
    id: 'pack_1', school_id: 's1', title: 'Chemistry', subject: 'Chemistry', segment: 'Secondary', status: 'draft',
    mcqs: sixQuestions.slice(0, 5),
    lesson_prompt: 'Plan.', lesson_rubric: 'Old lesson guide', demo_prompt: 'Teach.', demo_rubric: 'Old demo guide', scenario_prompt: 'Handle.', scenario_rubric: 'Old scenario guide',
  };
});

describe('editing a written test', () => {
  it('lets HR and the school admin edit a test that is not in use', async () => {
    for (const r of ['HR', 'SCHOOL_ADMIN']) {
      role = r;
      const res = await send({ lesson_prompt: 'Plan a Chemistry lesson on acids.' });
      expect(res.status).toBe(200);
    }
    expect(pack.lesson_prompt).toBe('Plan a Chemistry lesson on acids.');
    expect(pack.edited_at).toBeTruthy();
  });

  it('is not open to reviewers', async () => {
    role = 'REPORTING_MANAGER';
    expect((await send({ title: 'x' })).status).toBe(403);
    expect(updateAssessmentPack).not.toHaveBeenCalled();
  });

  it('keeps a test that is in use to the school admin', async () => {
    pack.status = 'active';
    role = 'HR';
    const res = await send({ title: 'Changed' });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/in use/);
    role = 'SCHOOL_ADMIN';
    expect((await send({ title: 'Changed' })).status).toBe(200);
  });

  it('says so when the test does not exist, and when nothing was sent', async () => {
    expect((await send({ title: 'x' }, 'nope')).status).toBe(404);
    expect((await send({})).status).toBe(400);
  });

  it('turns on the test\'s own questions when a question is changed and no choice was made', async () => {
    const changed = [{ ...question(0), question_text: 'A much harder question?' }, ...sixQuestions.slice(1, 6)];
    const res = await send({ mcqs: changed });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.switched_to_own_questions).toBe(true);
    expect(pack.use_own_questions).toBe(true);
    expect((pack.mcqs[0] as { question_text: string }).question_text).toBe('A much harder question?');
  });

  it('does not switch when the questions were not changed, or the school chose the bank', async () => {
    await send({ mcqs: pack.mcqs });
    expect(pack.use_own_questions).toBeUndefined();
    pack.use_own_questions = false;
    await send({ mcqs: [{ ...question(0), question_text: 'Different?' }, ...sixQuestions.slice(1, 5)] });
    expect(pack.use_own_questions).toBe(false);
  });

  it('does not switch automatically when there are too few questions, but refuses an explicit choice', async () => {
    const few = sixQuestions.slice(0, 3).map((q) => ({ ...q, question_text: `${q.question_text} edited` }));
    expect((await send({ mcqs: few })).status).toBe(200);
    expect(pack.use_own_questions).toBeUndefined();
    const res = await send({ use_own_questions: true });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 5/);
  });

  it('refuses a question with no correct answer and names it', async () => {
    const res = await send({ mcqs: [question(0), { ...question(1), correct_option: 'nothing like it' }] });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Question 2: choose which answer is correct.');
    expect(updateAssessmentPack).not.toHaveBeenCalled();
  });

  it('updates the scoring guide that marking reads, only for guides that changed', async () => {
    await send({ lesson_rubric: 'New lesson guide', demo_rubric: 'Old demo guide' });
    expect(rubrics).toHaveLength(1);
    expect(rubrics[0]).toMatchObject({
      id: 'rubric_pack_1_written_theory',
      stage_key: 'written_theory',
      dimensions: [{ description: 'New lesson guide' }],
    });
  });

  it('ignores fields that are not editable', async () => {
    await send({ school_id: 'other', status: 'active', id: 'pack_9', title: 'Renamed' });
    const patch = updateAssessmentPack.mock.calls[0][1];
    expect(patch).not.toHaveProperty('school_id');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('id');
    expect(patch.title).toBe('Renamed');
  });
});
