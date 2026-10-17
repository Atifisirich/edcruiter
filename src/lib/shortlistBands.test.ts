import { describe, expect, it } from 'vitest';
import { bandForScore, normalizeBands, DEFAULT_SHORTLIST_BANDS } from './shortlistBands';

describe('bandForScore', () => {
  it('places boundary scores in the correct default band', () => {
    expect(bandForScore(0).key).toBe('red');
    expect(bandForScore(29).key).toBe('red');
    expect(bandForScore(30).key).toBe('yellow');
    expect(bandForScore(59).key).toBe('yellow');
    expect(bandForScore(60).key).toBe('green');
    expect(bandForScore(100).key).toBe('green');
  });

  it('clamps an out-of-range score into the nearest valid band', () => {
    expect(bandForScore(-10).key).toBe('red');
    expect(bandForScore(150).key).toBe('green');
  });

  it('treats a non-numeric score as zero rather than throwing', () => {
    expect(bandForScore(NaN).key).toBe('red');
  });

  it('respects a school-configured custom band set', () => {
    const customBands = [
      { key: 'red' as const, label: 'Low', min: 0, max: 49, tone: 'danger' as const },
      { key: 'green' as const, label: 'High', min: 50, max: 100, tone: 'success' as const },
    ];
    expect(bandForScore(45, customBands).key).toBe('red');
    expect(bandForScore(55, customBands).key).toBe('green');
  });
});

describe('normalizeBands', () => {
  it('returns the default bands when none are configured', () => {
    expect(normalizeBands(undefined)).toEqual(DEFAULT_SHORTLIST_BANDS);
    expect(normalizeBands([])).toEqual(DEFAULT_SHORTLIST_BANDS);
  });

  it('clamps min/max into the valid 0-100 range', () => {
    const bands = normalizeBands([
      { key: 'red', label: 'x', min: -20, max: 200, tone: 'danger' },
    ]);
    expect(bands[0].min).toBe(0);
    expect(bands[0].max).toBe(100);
  });

  it('sorts bands by minimum score ascending', () => {
    const bands = normalizeBands([
      { key: 'green', label: 'High', min: 70, max: 100, tone: 'success' },
      { key: 'red', label: 'Low', min: 0, max: 39, tone: 'danger' },
    ]);
    expect(bands.map((b) => b.key)).toEqual(['red', 'green']);
  });
});
