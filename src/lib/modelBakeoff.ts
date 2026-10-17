export const SCREENING_BAKEOFF_MODELS = [
  {
    id: 'gemini-3-flash-preview',
    shortLabel: 'Gemini 3 Flash',
    blurb: 'Cheaper Flash model. Compare quotes, gaps, and video judgment to 3.5 on the same submissions.'
  },
  {
    id: 'gemini-3.5-flash',
    shortLabel: 'Gemini 3.5 Flash',
    blurb: 'Current production baseline. Live API call — not a local heuristic score.'
  }
] as const;

export type BakeoffModelId = (typeof SCREENING_BAKEOFF_MODELS)[number]['id'];
