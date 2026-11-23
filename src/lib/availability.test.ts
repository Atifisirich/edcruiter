import { describe, expect, it } from 'vitest';
import { cutIntoSlots, validateSlots } from './availability';

const now = new Date('2026-11-23T04:00:00.000Z');
const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 24, h, m)).toISOString();

describe('free times', () => {
  it('cuts a stretch into equal interview-sized pieces', () => {
    const slots = cutIntoSlots(new Date(at(5)), new Date(at(7)), 30);
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ start: at(5), end: at(5, 30) });
    expect(slots[3].end).toBe(at(7));
  });

  it('drops the leftover when the stretch does not divide evenly', () => {
    expect(cutIntoSlots(new Date(at(5)), new Date(at(6, 45)), 30)).toHaveLength(3);
  });

  it('accepts future, non-overlapping times', () => {
    const r = validateSlots([{ start: at(5), end: at(5, 30) }], [], now);
    expect(r.ok).toBe(true);
  });

  it('refuses a time in the past', () => {
    const r = validateSlots([{ start: '2026-11-22T05:00:00.000Z', end: '2026-11-22T05:30:00.000Z' }], [], now);
    expect(r).toMatchObject({ ok: false });
  });

  it('refuses times that overlap one already offered', () => {
    const r = validateSlots([{ start: at(5, 15), end: at(5, 45) }], [{ start: at(5), end: at(5, 30) }], now);
    expect(r).toMatchObject({ ok: false });
  });

  it('allows a time that starts exactly when another ends', () => {
    const r = validateSlots([{ start: at(5, 30), end: at(6) }], [{ start: at(5), end: at(5, 30) }], now);
    expect(r.ok).toBe(true);
  });

  it('refuses too short, too long, empty and nonsense input', () => {
    expect(validateSlots([{ start: at(5), end: at(5, 5) }], [], now).ok).toBe(false);
    expect(validateSlots([{ start: at(5), end: at(10) }], [], now).ok).toBe(false);
    expect(validateSlots([], [], now).ok).toBe(false);
    expect(validateSlots([{ start: 'x', end: 'y' }], [], now).ok).toBe(false);
    expect(validateSlots('nope', [], now).ok).toBe(false);
  });
});
