/** Reading the AI's answer about one camera picture (see /api/proctoring/snapshot-review). */

export interface SnapshotFinding {
  phone_or_device: boolean;
  other_person: boolean;
  screen_glow_on_face: boolean;
  reading_from_something: boolean;
  note: string;
}

export function parseFinding(text: string): SnapshotFinding | null {
  try {
    const raw = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!raw || typeof raw !== 'object') return null;
    return {
      phone_or_device: raw.phone_or_device === true,
      other_person: raw.other_person === true,
      screen_glow_on_face: raw.screen_glow_on_face === true,
      reading_from_something: raw.reading_from_something === true,
      note: String(raw.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
    };
  } catch {
    return null;
  }
}

/** What was seen, as a sentence for the reviewer, or null when nothing matters. */
export function findingSummary(f: SnapshotFinding): string | null {
  const seen = [
    f.phone_or_device && 'a phone or other device',
    f.other_person && 'another person',
    f.screen_glow_on_face && 'light from another screen on the face',
    f.reading_from_something && 'the candidate reading from something off screen',
  ].filter(Boolean) as string[];
  if (!seen.length) return null;
  return `${seen.join(', ')}.${f.note ? ` ${f.note}` : ''}`;
}
