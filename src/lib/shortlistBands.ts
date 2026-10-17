/** Configurable shortlist colour bands for school dashboards (scores 0–100). */

export type ShortlistBandKey = 'red' | 'yellow' | 'green';

export interface ShortlistBand {
  key: ShortlistBandKey;
  label: string;
  min: number;
  max: number;
  /** Tailwind-ish semantic for UI */
  tone: 'danger' | 'warning' | 'success';
}

export const DEFAULT_SHORTLIST_BANDS: ShortlistBand[] = [
  { key: 'red', label: 'Needs major improvement', min: 0, max: 29, tone: 'danger' },
  { key: 'yellow', label: 'Borderline / review', min: 30, max: 59, tone: 'warning' },
  { key: 'green', label: 'Strong shortlist', min: 60, max: 100, tone: 'success' },
];

export function normalizeBands(bands?: ShortlistBand[] | null): ShortlistBand[] {
  if (!bands?.length) return DEFAULT_SHORTLIST_BANDS.map((b) => ({ ...b }));
  return [...bands]
    .map((b) => ({
      ...b,
      min: Math.max(0, Math.min(100, Number(b.min) || 0)),
      max: Math.max(0, Math.min(100, Number(b.max) || 0)),
    }))
    .sort((a, b) => a.min - b.min);
}

export function bandForScore(score: number, bands?: ShortlistBand[] | null): ShortlistBand {
  const list = normalizeBands(bands);
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const hit = list.find((b) => s >= b.min && s <= b.max);
  return hit || list[list.length - 1];
}

export function bandBadgeClass(tone: ShortlistBand['tone']): string {
  if (tone === 'danger') return 'bg-rose-100 text-rose-800 border-rose-300';
  if (tone === 'warning') return 'bg-amber-100 text-amber-900 border-amber-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
}

export function bandScoreTextClass(tone: ShortlistBand['tone']): string {
  if (tone === 'danger') return 'text-rose-700';
  if (tone === 'warning') return 'text-amber-700';
  return 'text-emerald-700';
}
