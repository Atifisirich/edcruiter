import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicVacancy, School } from './types';

// db.ts reads and writes <cwd>/data/store.json on import, so each test runs in
// a throwaway working directory.
const originalCwd = process.cwd();
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edcruiter-approval-'));
  process.chdir(dir);
  vi.stubEnv('NODE_ENV', 'production');
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

function school(id: string, status: School['status']): School {
  return {
    id, name: `School ${id}`, code: id.toUpperCase(),
    primary_contact: { name: 'A', email: 'a@example.com', phone: '' },
    branches: [], subjects: [], segments: [], curricula: [], stages_config: [],
    created_at: new Date().toISOString(), status,
  };
}

function job(id: string, schoolId: string): PublicVacancy {
  return { id, school_id: schoolId, status: 'active' } as PublicVacancy;
}

describe('school approval guard', () => {
  it('blocks a school waiting for approval, allows an approved one, blocks one that does not exist', async () => {
    const { db } = await import('./db');
    const { assertSchoolActive } = await import('./auth');
    db.createSchool(school('pending', 'onboarding'));
    db.createSchool(school('live', 'active'));
    db.createSchool(school('paused', 'suspended'));

    expect(() => assertSchoolActive('pending')).toThrow(/waiting for approval/i);
    expect(() => assertSchoolActive('paused')).toThrow(/suspended/i);
    expect(() => assertSchoolActive('does_not_exist')).toThrow();
    expect(() => assertSchoolActive('live')).not.toThrow();
  });

  it('keeps a pending school\'s vacancies off the public board until it is approved', async () => {
    const { db } = await import('./db');
    db.createSchool(school('pending', 'onboarding'));
    db.createSchool(school('live', 'active'));
    db.createJob(job('job_a', 'pending'));
    db.createJob(job('job_b', 'live'));

    expect(db.getPublicJobs().map((j) => j.id)).toEqual(['job_b']);

    db.updateSchool('pending', { status: 'active' });
    expect(db.getPublicJobs().map((j) => j.id).sort()).toEqual(['job_a', 'job_b']);
  });
});
