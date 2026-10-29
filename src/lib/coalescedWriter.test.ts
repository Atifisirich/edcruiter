import { describe, expect, it } from 'vitest';
import { createCoalescedWriter } from './coalescedWriter';

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

describe('createCoalescedWriter', () => {
  it('writes once for a single change', async () => {
    let writes = 0;
    const save = createCoalescedWriter(async () => { writes++; });
    await save();
    expect(writes).toBe(1);
  });

  it('folds a burst of changes into far fewer writes, ending on the latest state', async () => {
    let state = 0;
    const written: number[] = [];
    const save = createCoalescedWriter(async () => {
      const snapshot = state;
      await tick();
      written.push(snapshot);
    });
    const saves: Promise<void>[] = [];
    for (let i = 1; i <= 20; i++) { state = i; saves.push(save()); }
    await Promise.all(saves);
    expect(written.length).toBeLessThan(5);
    expect(written[written.length - 1]).toBe(20);
  });

  it('never runs two writes at the same time', async () => {
    let active = 0;
    let maxActive = 0;
    const save = createCoalescedWriter(async () => {
      active++; maxActive = Math.max(maxActive, active);
      await tick();
      active--;
    });
    await Promise.all([save(), save(), save(), save()]);
    expect(maxActive).toBe(1);
  });

  it('a change made while a write is running is still written afterwards', async () => {
    let state = 'a';
    const written: string[] = [];
    const save = createCoalescedWriter(async () => {
      const snapshot = state;
      await tick(20);
      written.push(snapshot);
    });
    const first = save();
    await tick(5);
    state = 'b';
    const second = save();
    await Promise.all([first, second]);
    expect(written).toEqual(['a', 'b']);
  });

  it('keeps working after a write fails', async () => {
    let calls = 0;
    const save = createCoalescedWriter(async () => {
      calls++;
      if (calls === 1) throw new Error('disk hiccup');
    });
    await expect(save()).rejects.toThrow('disk hiccup');
    await save();
    expect(calls).toBe(2);
  });
});
