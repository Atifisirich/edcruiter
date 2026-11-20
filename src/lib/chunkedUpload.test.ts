import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { chunkDirFor, joinChunks, receivedChunks, safePart, saveChunk } from './chunkedUpload';

const roots: string[] = [];
const temp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'chunks-')); roots.push(d); return d; };
afterEach(() => { for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true }); });

describe('uploading a large recording in pieces', () => {
  it('joins the pieces in order into one file, whatever order they arrived in', () => {
    const root = temp();
    const dir = chunkDirFor(root, 'cand_1', 'abc123');
    saveChunk(dir, 2, Buffer.from('CC'));
    saveChunk(dir, 0, Buffer.from('AA'));
    saveChunk(dir, 1, Buffer.from('BB'));
    const target = path.join(root, 'out.webm');
    expect(joinChunks(dir, 3, target)).toEqual({ ok: true, size: 6 });
    expect(fs.readFileSync(target, 'utf8')).toBe('AABBCC');
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('refuses to join when a piece is missing, and keeps what arrived', () => {
    const root = temp();
    const dir = chunkDirFor(root, 'cand_1', 'abc123');
    saveChunk(dir, 0, Buffer.from('AA'));
    saveChunk(dir, 2, Buffer.from('CC'));
    const r = joinChunks(dir, 3, path.join(root, 'out.webm'));
    expect(r).toEqual({ ok: false, error: 'Part 2 of 3 is missing.' });
    expect(receivedChunks(dir)).toEqual([0, 2]);
  });

  it('treats a piece sent twice as one, so a retry does no harm', () => {
    const root = temp();
    const dir = chunkDirFor(root, 'cand_1', 'abc123');
    saveChunk(dir, 0, Buffer.from('AA'));
    saveChunk(dir, 0, Buffer.from('AA'));
    saveChunk(dir, 1, Buffer.from('BB'));
    expect(receivedChunks(dir)).toEqual([0, 1]);
    expect(joinChunks(dir, 2, path.join(root, 'o.webm'))).toEqual({ ok: true, size: 4 });
  });

  it('refuses a recording over the size limit', () => {
    const root = temp();
    const dir = chunkDirFor(root, 'cand_1', 'abc123');
    saveChunk(dir, 0, Buffer.alloc(10));
    expect(joinChunks(dir, 1, path.join(root, 'o.webm'), 5)).toEqual({ ok: false, error: 'The recording is too large.' });
  });

  it('only accepts plain ids, so nobody can aim a piece outside the folder', () => {
    expect(safePart('a1B2c3_d4-e5')).toBe('a1B2c3_d4-e5');
    expect(safePart('../../etc')).toBeNull();
    expect(safePart('a/b')).toBeNull();
    expect(safePart('x')).toBeNull();
    expect(safePart(42)).toBeNull();
  });
});
