import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// db.ts reads and writes <cwd>/data/store.json the moment it is imported, so
// every test points the working directory at a throwaway folder first.
const originalCwd = process.cwd();
let dir: string;

async function loadDb() {
  vi.resetModules();
  return (await import('./db')).db;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edcruiter-db-'));
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('first start on a live site', () => {
  it('starts with no demo school and no seeded staff accounts', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const db = await loadDb();
    expect(db.getSchools()).toHaveLength(0);
    expect(db.getUserByEmail('superadmin@edcruiter.ai')).toBeUndefined();
    expect(db.getUserByEmail('admin@edcruiter.ai')).toBeUndefined();
  });

  it('makes the named owner a super admin, and only once', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BOOTSTRAP_SUPER_ADMIN_EMAIL', ' Owner@Example.com ');
    const db = await loadDb();
    const owner = db.getUserByEmail('owner@example.com');
    expect(owner?.role).toBe('SUPER_ADMIN');
    expect(owner?.school_id).toBeNull();

    const again = await loadDb();
    await new Promise((r) => setTimeout(r, 50));
    expect(again.getUsersBySchool(null).filter((u) => u.email === 'owner@example.com')).toHaveLength(1);
  });

  it('can still seed the demo school on request', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SEED_DEMO_DATA', 'true');
    const db = await loadDb();
    expect(db.getSchools().length).toBeGreaterThan(0);
  });
});

describe('an unreadable store', () => {
  it('is set aside, not overwritten', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'store.json'), '{ not valid json');
    await loadDb();
    await new Promise((r) => setTimeout(r, 50));
    const kept = fs.readdirSync(path.join(dir, 'data')).filter((f) => f.startsWith('store.json.unreadable.'));
    expect(kept).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, 'data', kept[0]), 'utf8')).toBe('{ not valid json');
  });
});
