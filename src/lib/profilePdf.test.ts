import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { buildProfilePdf, pdfSafe } from './profilePdf';
import { FACTOR_DEFS, type ProfileFactor, type TeachingProfile } from './teachingProfile';

function factor(def: (typeof FACTOR_DEFS)[number], score: number | null, withQuote = true): ProfileFactor {
  return {
    key: def.key, label: def.label, group: def.group, source: def.source, definition: def.definition, score,
    reason: score === null ? 'Not enough evidence in what the candidate submitted.' : 'A specific reason that is long enough to wrap onto a second line so the layout code is exercised properly.',
    quote: score !== null && def.source !== 'video' && withQuote ? 'I would stay calm and ask what happened' : undefined,
    confidence: score === null ? 'none' : def.source === 'video' ? 'medium' : 'high',
    counted: score !== null && (def.group === 'area' || def.group === 'resume'),
  };
}

function profile(overrides: Partial<TeachingProfile> = {}): TeachingProfile {
  return {
    version: 1, candidate_id: 'c1', school_id: 's1', generated_at: '2026-10-31T06:30:00.000Z', status: 'ready',
    overall: { score: 72, counted_weight: 100 },
    summary: 'A solid candidate with clear explanations. '.repeat(6),
    strengths: ['Clear explanations', 'Good questioning'],
    improvements: ['More differentiation'],
    factors: FACTOR_DEFS.map((d, i) => factor(d, i % 7 === 0 ? null : 40 + ((i * 13) % 60))),
    relevancy: [{ id: 'lesson', question: 'Design a 35-minute lesson.', score: 80 }, { id: 'demo', question: 'Record a demo.', score: null }],
    measured: { mcq_correct: 21, mcq_total: 30, lesson_words: 240, integrity_score: 90, integrity_label: 'High confidence', integrity_flags: 1, stages_completed: 5, interview_rounds: [{ round: 'Principal', decision: 'accepted' }] },
    observations: { delivery_enabled: true, appearance_enabled: true, video_analyzed: true },
    ...overrides,
  };
}

const candidate = { id: 'c1', name: 'Priya Nair', subject: 'Biology', segment: 'Secondary 9-10', email: 'priya@example.com', phone: '9876543210' };

describe('pdfSafe', () => {
  it('turns curly quotes and dashes into plain ones and replaces letters the font cannot draw', () => {
    expect(pdfSafe('“Hello” – it’s')).toBe('"Hello" - it\'s');
    expect(pdfSafe('नमस्ते')).toBe('??????');
  });
});

describe('buildProfilePdf', () => {
  it('writes a real PDF with several pages', async () => {
    const bytes = await buildProfilePdf({ profile: profile(), candidate, schoolName: 'Green Valley School' });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(5);
  });

  it('does not fail on a name or quote in another script', async () => {
    const p = profile({ summary: 'नमस्ते teacher', factors: [factor(FACTOR_DEFS[0], 60)] });
    const bytes = await buildProfilePdf({ profile: p, candidate: { ...candidate, name: 'ప్రియ' }, schoolName: 'St. Mary’s' });
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('handles a profile with no overall score and no factors', async () => {
    const p = profile({ overall: { score: null, counted_weight: 0 }, factors: [], relevancy: [], strengths: [], improvements: [], summary: '' });
    const bytes = await buildProfilePdf({ profile: p, candidate, schoolName: 'Green Valley School' });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('handles a very long unbroken word without looping forever', async () => {
    const p = profile({ summary: 'x'.repeat(3000) });
    const bytes = await buildProfilePdf({ profile: p, candidate, schoolName: 'Green Valley School' });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
