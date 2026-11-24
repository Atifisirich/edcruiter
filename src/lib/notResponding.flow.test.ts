/**
 * "Not responding" on the real database code, in a throwaway folder: set-aside
 * people leave the main list (and its counts) but are kept, can be listed on
 * their own, and the call sweeper places no planned call to them.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const cwd = process.cwd();
let tmp = '';

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edc-notresp-'));
  process.chdir(tmp);
});
afterAll(() => {
  process.chdir(cwd);
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* left for the OS */ }
});

describe('Not responding', () => {
  it('keeps them out of the main list, lists them on their own, and stops planned calls', async () => {
    const { db } = await import('./db');
    const { setAside, moveBack } = await import('./notResponding');
    const { runScreeningSweep } = await import('./screeningCallService');
    expect(fs.realpathSync(process.cwd())).toBe(fs.realpathSync(tmp));

    const school = db.getSchools()[0];
    for (const [id, name] of [['cand_nr_1', 'Asha'], ['cand_nr_2', 'Bala']]) {
      db.createCandidate({
        id, school_id: school.id, name, email: `${id}@example.com`, phone: '9876543210', status: 'in_progress',
        applied_subject: 'Maths', applied_segment: 'Primary', relocation_branches: [], languages: [], target_branch_id: '',
        current_stage_key: 'identity_verification', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      } as never);
    }
    const before = db.getCandidatesBySchool(school.id);
    expect(before.length).toBeGreaterThan(0);
    const target = before[0];

    db.updateCandidate(school.id, target.id, setAside({ id: 'user_hr', name: 'Priya' }));
    expect(db.getCandidatesBySchool(school.id).map((c) => c.id)).not.toContain(target.id);
    expect(db.getCandidatesBySchool(school.id).length).toBe(before.length - 1);
    expect(db.getCandidatesBySchool(school.id, { notResponding: 'only' }).map((c) => c.id)).toEqual([target.id]);
    expect(db.getCandidatesBySchool(school.id, { notResponding: 'include' }).length).toBe(before.length);
    // Nothing is deleted: the record still opens.
    expect(db.getCandidateById(school.id, target.id)?.not_responding?.by_name).toBe('Priya');

    // A call that was planned for them is not placed.
    db.addScreeningCall({
      id: 'call_planned', school_id: school.id, candidate_id: target.id, mode: 'demo', status: 'scheduled',
      questions: ['Are you interested?'], requested_by: 'Automatic', trigger: 'auto',
      scheduled_for: new Date(Date.now() - 60_000).toISOString(), started_at: new Date(Date.now() - 60_000).toISOString(),
    } as never);
    await runScreeningSweep(new Date());
    const call = db.getScreeningCall('call_planned');
    expect(call?.status).toBe('skipped');
    expect(call?.failure_reason).toMatch(/Not responding/);

    // One step back.
    db.updateCandidate(school.id, target.id, moveBack());
    expect(db.getCandidatesBySchool(school.id).length).toBe(before.length);
    expect(db.getCandidatesBySchool(school.id, { notResponding: 'only' })).toEqual([]);
  });
});
