/**
 * Free times a reviewer offers for interviews. Each one is a start and an end,
 * and HR books a candidate into the whole of it, so a reviewer who wants 30-minute
 * interviews offers 30-minute times (the form cuts a longer stretch into pieces).
 */

import type { AvailabilitySlot } from './types';

export const MIN_SLOT_MIN = 15;
export const MAX_SLOT_MIN = 240;
export const MAX_NEW_AT_ONCE = 40;
export const MAX_OPEN = 200;
export const HORIZON_DAYS = 90;

export type SlotInput = { start: string; end: string };

/** Checks what a reviewer sent. Returns the cleaned times, or a plain-language reason. */
export function validateSlots(
  input: unknown,
  existing: Pick<AvailabilitySlot, 'start' | 'end'>[],
  now: Date
): { ok: true; slots: SlotInput[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Choose at least one time.' };
  if (input.length > MAX_NEW_AT_ONCE) return { ok: false, error: `Add up to ${MAX_NEW_AT_ONCE} times at once.` };
  if (existing.length + input.length > MAX_OPEN) return { ok: false, error: 'You have a lot of free times already. Remove some that have passed or you no longer need.' };

  const horizon = now.getTime() + HORIZON_DAYS * 86_400_000;
  const slots: SlotInput[] = [];
  for (const raw of input as Record<string, unknown>[]) {
    const start = new Date(String(raw?.start));
    const end = new Date(String(raw?.end));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { ok: false, error: 'One of the times is not a valid date.' };
    if (start.getTime() <= now.getTime()) return { ok: false, error: 'A free time must be in the future.' };
    if (start.getTime() > horizon) return { ok: false, error: `Free times can be up to ${HORIZON_DAYS} days ahead.` };
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes < MIN_SLOT_MIN || minutes > MAX_SLOT_MIN) return { ok: false, error: `Each time must be ${MIN_SLOT_MIN} minutes to ${MAX_SLOT_MIN / 60} hours long.` };
    slots.push({ start: start.toISOString(), end: end.toISOString() });
  }

  // Nothing may overlap another new time, or one the reviewer already offered.
  const all = [...existing.map((s) => ({ start: s.start, end: s.end })), ...slots].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < all.length; i++) {
    if (all[i].start < all[i - 1].end) return { ok: false, error: 'Some of those times overlap each other or a time you already offered.' };
  }
  return { ok: true, slots };
}

/** Cuts a stretch (for example 10:00 to 12:00) into equal pieces of `minutes`. Anything left over is dropped. */
export function cutIntoSlots(start: Date, end: Date, minutes: number): SlotInput[] {
  const out: SlotInput[] = [];
  const step = minutes * 60_000;
  for (let t = start.getTime(); t + step <= end.getTime(); t += step) {
    out.push({ start: new Date(t).toISOString(), end: new Date(t + step).toISOString() });
  }
  return out;
}
