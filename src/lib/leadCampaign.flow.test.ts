/**
 * The whole lead-list flow on the real database code, in a throwaway folder:
 * upload → calling queue → (demo) calls → good fit moved into Candidates,
 * a missed must-have set aside with the reason, an unclear one left for HR.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// The AI's reading of each call, fixed per person (the demo call's first line says their name).
vi.mock('./screeningCall', async () => {
  const actual = await vi.importActual<typeof import('./screeningCall')>('./screeningCall');
  return {
    ...actual,
    demoTranscript: async (c: { name: string }) => [{ role: 'agent' as const, text: `Hello ${c.name}` }, { role: 'user' as const, text: 'Yes' }],
    analyseCall: async (questions: string[], transcript: { text: string }[], requirements: string[], importance: string[]) => {
      const who = transcript[0].text;
      const result = who.includes('Asha') ? 'met' : who.includes('Bala') ? 'not_met' : 'unclear';
      return {
        answers: questions.map((q) => ({ question: q, answer: 'x' })),
        summary: `Call with ${who}`,
        recommendation: who.includes('Asha') ? 'proceed' : 'maybe',
        interest: 'interested',
        checks: questions.map((q, i) => ({ question: q, requirement: requirements[i], importance: importance[i] === 'prefer' ? 'prefer' : 'must', result })).filter((c) => c.requirement),
      };
    },
  };
});

const cwd = process.cwd();
let tmp = '';

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edc-leads-'));
  process.chdir(tmp);
});
afterAll(() => {
  process.chdir(cwd);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* left for the OS */ }
});

const until = async (ok: () => boolean, ms = 8000) => {
  const end = Date.now() + ms;
  while (!ok() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
};

describe('a lead list, start to finish', () => {
  it('screens, moves the good fit, sets aside the rest with reasons, and keeps leads out of Candidates', async () => {
    const { db } = await import('./db');
    const { importLeads } = await import('./leadActions');
    const { runLeadCampaigns } = await import('./screeningCallService');
    const { leadListView } = await import('./leadListView');
    expect(fs.realpathSync(process.cwd())).toBe(fs.realpathSync(tmp));

    const school = db.getSchools()[0];
    db.updateSchool(school.id, { screening_call: { questions: ['Are you interested in this job?'], auto_call_on_apply: false, rules: { enabled: false, window_start_hour: 0, window_end_hour: 24, skip_sundays: false } as never } });
    const before = db.getCandidatesBySchool(school.id).length;
    const existingPhone = db.getCandidatesBySchool(school.id).find((c) => c.phone)?.phone;

    const now = new Date().toISOString();
    const list = db.addLeadList({
      id: 'll_test', school_id: school.id, name: 'Test leads', created_by: 'HR', created_at: now, updated_at: now, status: 'setup', on_good_fit: 'move',
      setup: { questions: ['Are you still interested?', 'Do you have a B.Ed degree?'], requirements: ['', 'Has a B.Ed'], importance: ['ask', 'must'], language: 'English', good_fit: 'Has a B.Ed' },
    });
    const imported = importLeads(list, [
      { name: 'Asha Rao', phone: '+91 90000 00001' },
      { name: 'Bala Kumar', phone: '9000000002' },
      { name: 'Chetan Das', phone: '9000000003' },
      { name: 'Asha Again', phone: '09000000001' },
      { name: 'No Phone' },
      ...(existingPhone ? [{ name: 'Known person', phone: existingPhone }] : []),
    ], undefined);
    expect(imported.added).toBe(3);
    expect(imported.skipped.map((s) => s.why)).toEqual(expect.arrayContaining(['twice in this file', 'no usable phone number']));
    // Leads never show among candidates.
    expect(db.getCandidatesBySchool(school.id).length).toBe(before);

    db.updateLeadList(school.id, list.id, { status: 'running' });
    const placed = await runLeadCampaigns();
    expect(placed).toBe(3);
    await until(() => db.getLeadsOfList(school.id, list.id).every((c) => c.lead!.status !== 'calling' && c.lead!.status !== 'waiting'));

    const by = (n: string) => db.getLeadsOfList(school.id, list.id).find((c) => c.name.startsWith(n))!;
    expect(by('Asha').lead).toMatchObject({ status: 'moved' });
    expect(by('Bala').lead).toMatchObject({ status: 'set_aside', reason: 'Not met: Has a B.Ed' });
    expect(by('Chetan').lead).toMatchObject({ status: 'needs_look', reason: 'Could not confirm: Has a B.Ed' });
    // The good fit is now a candidate; the others are not.
    expect(db.getCandidatesBySchool(school.id).map((c) => c.name)).toContain('Asha Rao');
    expect(db.getCandidatesBySchool(school.id).length).toBe(before + 1);

    // The list finishes on its own, and the report adds up.
    await runLeadCampaigns();
    expect(db.getLeadList(school.id, list.id)!.status).toBe('done');
    const view = leadListView(school.id, db.getLeadList(school.id, list.id)!);
    expect(view.report).toMatchObject({ total: 3, good_fit: 1, moved: 1, needs_look: 1, set_aside: 1, called: 3, answered: 3, progress: 100 });
    expect(view.report.reasons.map((r) => r.text)).toEqual(expect.arrayContaining(['Not met: Has a B.Ed', 'Could not confirm: Has a B.Ed']));
    // Each lead was asked the list's own questions, not the school's.
    expect(db.getScreeningCallsBySchool(school.id, by('Bala').id)[0].questions).toEqual(['Are you still interested?', 'Do you have a B.Ed degree?']);
  }, 20_000);
});
