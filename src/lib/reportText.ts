import type { ResumeAnalysisReport } from './types';

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was', 'be', 'with', 'this', 'that', 'cv', 'candidate', 'form']);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ''))
    .filter((w) => w && !STOP.has(w));
}

/** True when two points say the same thing: identical, one inside the other, or mostly the same words. */
export function similarText(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return a.trim().toLowerCase() === b.trim().toLowerCase();
  const sa = new Set(ta);
  const sb = new Set(tb);
  const shared = [...sa].filter((w) => sb.has(w)).length;
  const smaller = Math.min(sa.size, sb.size);
  const union = new Set([...sa, ...sb]).size;
  // Everything the shorter point says is in the longer one, or the two overlap heavily.
  return shared / smaller >= 0.9 || shared / union >= 0.7;
}

/** Drops repeats within a list, and anything already said in `alsoExclude`. Keeps the first wording and the order. */
export function dedupeSimilar(items: string[] | undefined, alsoExclude: string[] = []): string[] {
  const out: string[] = [];
  for (const raw of items || []) {
    const item = typeof raw === 'string' ? raw.trim() : '';
    if (!item) continue;
    if (alsoExclude.some((x) => similarText(item, x))) continue;
    if (out.some((x) => similarText(item, x))) continue;
    out.push(item);
  }
  return out;
}

/**
 * Cleans a stored CV report for display. `crossList` also removes points that
 * the summary or the mismatch list already state, for screens that show all of
 * them one after another.
 */
export function cleanResumeReport<T extends ResumeAnalysisReport>(report: T, options: { crossList?: boolean } = {}): T {
  const summary = report.eligibility_summary ? [report.eligibility_summary] : [];
  const discrepancies = dedupeSimilar(report.form_vs_cv_discrepancies, options.crossList ? summary : []);
  const green = dedupeSimilar(report.green_flags);
  return {
    ...report,
    form_vs_cv_discrepancies: discrepancies,
    red_flags: dedupeSimilar(report.red_flags, options.crossList ? [...summary, ...discrepancies] : []),
    green_flags: green,
    pedagogical_highlights: dedupeSimilar(report.pedagogical_highlights, green),
    recommended_interview_probes: dedupeSimilar(report.recommended_interview_probes)
  };
}
