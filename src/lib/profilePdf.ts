/**
 * The candidate report as a PDF, laid out by hand with pdf-lib so it needs no
 * browser and no font files. The built-in fonts only cover Western European
 * letters, so any other character in a name or quote is replaced with "?"
 * rather than stopping the whole report.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from 'pdf-lib';
import {
  GROUP_LABEL, GROUP_NOTE, observationLabel, recommendationFor, scoreTone,
  type FactorGroup, type ProfileFactor, type TeachingProfile,
} from './teachingProfile';
import type { ShortlistBand } from './shortlistBands';

export interface PdfCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  subject: string;
  segment: string;
  experience?: string;
  qualification?: string;
  invite_code?: string;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TOP = PAGE_H - 78;
const BOTTOM = 64;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const INK = hex('#0f172a');
const MUTED = hex('#64748b');
const RULE = hex('#e2e8f0');
const BRAND = hex('#4f46e5');
const TONES: Record<'red' | 'yellow' | 'green' | 'grey', { bg: RGB; fg: RGB }> = {
  red: { bg: hex('#fee2e2'), fg: hex('#991b1b') },
  yellow: { bg: hex('#fef3c7'), fg: hex('#92400e') },
  green: { bg: hex('#d1fae5'), fg: hex('#065f46') },
  grey: { bg: hex('#f1f5f9'), fg: hex('#475569') },
};

/** Replaces anything the built-in fonts cannot draw. */
export function pdfSafe(input: string): string {
  return input
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/[\r\t]/g, ' ')
    .replace(/[^\n\x20-\x7E¡-ÿ•]/g, '?');
}

class Layout {
  pdf!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  italic!: PDFFont;
  page!: PDFPage;
  y = TOP;
  pages: PDFPage[] = [];

  static async create(): Promise<Layout> {
    const l = new Layout();
    l.pdf = await PDFDocument.create();
    l.font = await l.pdf.embedFont(StandardFonts.Helvetica);
    l.bold = await l.pdf.embedFont(StandardFonts.HelveticaBold);
    l.italic = await l.pdf.embedFont(StandardFonts.HelveticaOblique);
    return l;
  }

  newPage(): void {
    this.page = this.pdf.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = TOP;
  }

  need(height: number): void {
    if (this.y - height < BOTTOM) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const lines: string[] = [];
    for (const paragraph of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ').filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width) {
          line = next;
        } else {
          if (line) lines.push(line);
          // A single word wider than the column is cut so it cannot run off the page.
          let rest = word;
          while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
            let cut = rest.length - 1;
            while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
            lines.push(rest.slice(0, cut));
            rest = rest.slice(cut);
          }
          line = rest;
        }
      }
      lines.push(line);
    }
    return lines.length ? lines : [''];
  }

  draw(text: string, x: number, y: number, o: { font?: PDFFont; size?: number; color?: RGB } = {}): void {
    this.page.drawText(pdfSafe(text), { x, y, font: o.font ?? this.font, size: o.size ?? 10, color: o.color ?? INK });
  }

  /** Draws wrapped text at the cursor and moves the cursor down. */
  para(text: string, o: { font?: PDFFont; size?: number; color?: RGB; x?: number; width?: number; gap?: number } = {}): void {
    const size = o.size ?? 10;
    const font = o.font ?? this.font;
    const lead = size * 1.45;
    const lines = this.wrap(text, font, size, o.width ?? CONTENT_W);
    for (const line of lines) {
      this.need(lead);
      this.draw(line, o.x ?? MARGIN, this.y - size, { font, size, color: o.color });
      this.y -= lead;
    }
    this.y -= o.gap ?? 4;
  }

  heading(text: string, size = 15): void {
    this.need(size * 2.4);
    this.y -= 6;
    this.draw(text, MARGIN, this.y - size, { font: this.bold, size });
    this.y -= size * 1.6;
  }

  rule(): void {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_W - MARGIN, y: this.y }, thickness: 0.6, color: RULE });
  }

  chip(label: string, x: number, yTop: number, width: number, tone: keyof typeof TONES, size = 9): void {
    const t = TONES[tone];
    const h = size + 9;
    this.page.drawRectangle({ x, y: yTop - h, width, height: h, color: t.bg });
    const w = this.bold.widthOfTextAtSize(pdfSafe(label), size);
    this.draw(label, x + (width - w) / 2, yTop - h + (h - size) / 2 + 1.5, { font: this.bold, size, color: t.fg });
  }

  bullets(items: string[], o: { width?: number } = {}): void {
    for (const item of items) {
      const lines = this.wrap(item, this.font, 10, (o.width ?? CONTENT_W) - 14);
      this.need(lines.length * 14.5);
      this.draw('•', MARGIN + 2, this.y - 10, { color: BRAND });
      for (const line of lines) {
        this.draw(line, MARGIN + 14, this.y - 10);
        this.y -= 14.5;
      }
      this.y -= 2;
    }
  }
}

const COL_LABEL = 150;
const COL_SCORE = 74;
const COL_REASON = CONTENT_W - COL_LABEL - COL_SCORE;

function factorTone(f: ProfileFactor): 'red' | 'yellow' | 'green' | 'grey' {
  return f.score === null || f.confidence === 'none' ? 'grey' : scoreTone(f.score);
}

function drawFactorRow(l: Layout, f: ProfileFactor, mode: 'number' | 'band'): void {
  const labelLines = l.wrap(f.label, l.bold, 10, COL_LABEL - 8);
  const defLines = l.wrap(f.definition, l.font, 7.5, COL_LABEL - 8);
  const reasonLines = l.wrap(f.reason, l.font, 9, COL_REASON - 4);
  const quoteLines = f.quote ? l.wrap(`"${f.quote}"`, l.italic, 8.5, COL_REASON - 4) : [];
  const confidenceNote = f.confidence === 'low' ? 'No matching quote was found, so this is shown for information and is not counted in the overall score.' : '';
  const noteLines = confidenceNote ? l.wrap(confidenceNote, l.italic, 7.5, COL_REASON - 4) : [];

  const leftH = labelLines.length * 13 + defLines.length * 9.5 + 4;
  const rightH = reasonLines.length * 12.5 + (quoteLines.length ? quoteLines.length * 11.5 + 4 : 0) + (noteLines.length ? noteLines.length * 10 + 3 : 0);
  const height = Math.max(leftH, rightH, 26) + 12;
  l.need(height);

  const top = l.y - 6;
  let ly = top;
  for (const line of labelLines) { l.draw(line, MARGIN + 4, ly - 10, { font: l.bold, size: 10 }); ly -= 13; }
  for (const line of defLines) { l.draw(line, MARGIN + 4, ly - 8, { size: 7.5, color: MUTED }); ly -= 9.5; }

  const tone = factorTone(f);
  const chipLabel = mode === 'band'
    ? (observationLabel(f) === 'Not enough evidence' ? 'No data' : observationLabel(f))
    : f.score === null || f.confidence === 'none' ? 'No data' : `${f.score}`;
  const chipW = mode === 'band' ? COL_SCORE - 10 : 40;
  l.chip(chipLabel, MARGIN + COL_LABEL + 2, top, chipW, tone, mode === 'band' ? 6.5 : 10);

  let ry = top;
  for (const line of reasonLines) { l.draw(line, MARGIN + COL_LABEL + COL_SCORE, ry - 9, { size: 9 }); ry -= 12.5; }
  if (quoteLines.length) {
    ry -= 2;
    for (const line of quoteLines) { l.draw(line, MARGIN + COL_LABEL + COL_SCORE, ry - 8.5, { font: l.italic, size: 8.5, color: MUTED }); ry -= 11.5; }
  }
  if (noteLines.length) {
    ry -= 1;
    for (const line of noteLines) { l.draw(line, MARGIN + COL_LABEL + COL_SCORE, ry - 7.5, { font: l.italic, size: 7.5, color: MUTED }); ry -= 10; }
  }

  l.y -= height;
  l.rule();
}

function drawGroup(l: Layout, profile: TeachingProfile, group: FactorGroup, mode: 'number' | 'band'): void {
  const rows = profile.factors.filter((f) => f.group === group);
  if (!rows.length) return;
  l.need(80);
  l.heading(GROUP_LABEL[group], 14);
  l.para(GROUP_NOTE[group], { size: 8.5, color: MUTED, gap: 6 });
  l.rule();
  for (const f of rows) drawFactorRow(l, f, mode);
  l.y -= 8;
}

function cover(l: Layout, profile: TeachingProfile, c: PdfCandidate, schoolName: string, bands?: ShortlistBand[] | null): void {
  l.newPage();
  l.y = PAGE_H - 210;
  const title = 'Teaching Assessment Report';
  l.draw(title, MARGIN, l.y, { font: l.bold, size: 30 });
  l.y -= 22;
  l.page.drawRectangle({ x: MARGIN, y: l.y, width: 90, height: 3, color: BRAND });
  l.y -= 52;

  l.draw(c.name, MARGIN, l.y, { font: l.bold, size: 22 });
  l.y -= 24;
  l.draw(`${c.subject} teacher - ${c.segment}`, MARGIN, l.y, { size: 12, color: MUTED });
  l.y -= 18;
  const lines = [
    c.experience ? `Experience: ${c.experience}` : '',
    c.qualification ? `Qualification: ${c.qualification}` : '',
    c.email ? `Email: ${c.email}` : '',
    c.phone ? `Phone: ${c.phone}` : '',
    c.invite_code ? `Application ID: ${c.invite_code}` : '',
  ].filter(Boolean);
  for (const line of lines) { l.draw(line, MARGIN, l.y, { size: 10, color: MUTED }); l.y -= 15; }

  l.y -= 24;
  const boxH = 120;
  l.page.drawRectangle({ x: MARGIN, y: l.y - boxH, width: CONTENT_W, height: boxH, color: hex('#f8fafc'), borderColor: RULE, borderWidth: 1 });
  const overall = profile.overall.score;
  const rec = recommendationFor(overall, bands);
  l.draw('Overall suitability', MARGIN + 24, l.y - 30, { size: 10, color: MUTED });
  l.draw(overall === null ? 'Not enough evidence' : `${overall}`, MARGIN + 24, l.y - 78, { font: l.bold, size: overall === null ? 22 : 48 });
  if (overall !== null) l.draw('/ 100', MARGIN + 24 + l.bold.widthOfTextAtSize(`${overall}`, 48) + 8, l.y - 78, { size: 14, color: MUTED });
  if (rec) {
    const tone = rec.tone === 'success' ? 'green' : rec.tone === 'warning' ? 'yellow' : 'red';
    const label = pdfSafe(rec.label);
    const w = l.bold.widthOfTextAtSize(label, 11) + 24;
    l.chip(label, PAGE_W - MARGIN - 24 - w, l.y - 34, w, tone, 11);
  }
  l.y -= boxH + 30;

  l.draw(`Prepared for ${schoolName}`, MARGIN, l.y, { size: 10, color: MUTED });
  l.y -= 14;
  l.draw(`Assessment date: ${new Date(profile.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, MARGIN, l.y, { size: 10, color: MUTED });
}

function summaryPage(l: Layout, profile: TeachingProfile): void {
  l.newPage();
  l.heading('Overall assessment', 18);
  if (profile.overall.capped_reason) {
    l.para(`Note: ${profile.overall.capped_reason}`, { size: 9.5, color: TONES.red.fg, gap: 8 });
  }
  l.para(profile.summary || 'No summary was written for this candidate.', { size: 10.5, gap: 10 });

  if (profile.strengths.length) {
    l.heading('Strengths', 13);
    l.bullets(profile.strengths);
  }
  if (profile.improvements.length) {
    l.heading('Areas to improve', 13);
    l.bullets(profile.improvements);
  }

  l.heading('Measured facts', 13);
  l.para('These are counted by the system, not estimated by the AI.', { size: 8.5, color: MUTED, gap: 6 });
  const m = profile.measured;
  const facts = [
    m.mcq_total ? `Subject test: ${m.mcq_correct} of ${m.mcq_total} correct` : 'Subject test: not taken',
    m.lesson_words !== null ? `Lesson plan length: ${m.lesson_words} words` : 'Lesson plan: not submitted',
    m.integrity_score !== null
      ? `Test integrity: ${m.integrity_score}/100 (${m.integrity_label}), ${m.integrity_flags} flag${m.integrity_flags === 1 ? '' : 's'}`
      : 'Test integrity: no events recorded',
    `Stages completed: ${m.stages_completed}`,
    ...(m.interview_rounds ?? []).map((r) => `${r.round} interview: ${r.decision}`),
  ];
  l.bullets(facts);
}

function relevancySection(l: Layout, profile: TeachingProfile): void {
  if (!profile.relevancy.length) return;
  l.need(120);
  l.heading('Response relevancy', 14);
  l.para('How directly each response answers the question that was asked.', { size: 8.5, color: MUTED, gap: 6 });
  l.rule();
  for (const r of profile.relevancy) {
    const lines = l.wrap(r.question, l.font, 9, COL_REASON + COL_LABEL - 20);
    const height = lines.length * 12.5 + 14;
    l.need(height);
    const top = l.y - 6;
    let y = top;
    for (const line of lines) { l.draw(line, MARGIN + 4, y - 9, { size: 9 }); y -= 12.5; }
    const tone = r.score === null ? 'grey' : scoreTone(r.score);
    l.chip(r.score === null ? 'No data' : `${r.score}`, PAGE_W - MARGIN - 46, top, 42, tone, 10);
    l.y -= height;
    l.rule();
  }
  l.y -= 8;
}

function notesPage(l: Layout, profile: TeachingProfile): void {
  l.newPage();
  l.heading('Important to note', 18);

  l.heading('How to read this report', 12);
  l.bullets([
    'Scores run from 0 to 100. Each teaching area has a reason and, where possible, a short quote taken word for word from the candidate. The system checks that every quote really appears in their submission.',
    'A score marked "No data" means the candidate gave too little evidence to judge fairly. It is left out rather than guessed.',
    'The overall score uses the six teaching areas and the CV review. Observations from the video are never part of it.',
  ]);

  l.heading('Colour guide', 12);
  const key: [string, string, 'red' | 'yellow' | 'green'][] = [
    ['0 - 40', 'Needs attention: significant gaps', 'red'],
    ['41 - 79', 'Developing: sound in places, with room to grow', 'yellow'],
    ['80 - 100', 'Strong: clear competence in this area', 'green'],
  ];
  for (const [range, text, tone] of key) {
    l.need(24);
    l.chip(range, MARGIN, l.y - 2, 64, tone, 8.5);
    l.draw(text, MARGIN + 76, l.y - 15, { size: 9.5 });
    l.y -= 26;
  }

  l.heading('Video observations', 12);
  l.bullets([
    'Delivery and presentation notes come from an AI watching the recording. They are impressions, shown only as Strong, Adequate or Needs attention, and a poor camera, light or microphone can affect them.',
    'Religious and cultural dress, accent, age, gender and appearance are never reasons to mark a candidate down.',
  ]);

  l.heading('Confidentiality and use', 12);
  l.bullets([
    'This report is for the hiring school only. It should not be shared with anyone outside the hiring process.',
    'It is an aid to a human decision, not a decision. The school remains responsible for hiring choices and should read the candidate\'s own answers before deciding.',
    `Generated by Edcruiter AI on ${new Date(profile.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
  ]);
}

function stamp(l: Layout, schoolName: string, candidateName: string): void {
  const total = l.pages.length;
  l.pages.forEach((page, i) => {
    page.drawText('EDCRUITER', { x: MARGIN, y: PAGE_H - 40, font: l.bold, size: 11, color: BRAND });
    const right = pdfSafe(schoolName).slice(0, 48);
    const w = l.font.widthOfTextAtSize(right, 9);
    page.drawText(right, { x: PAGE_W - MARGIN - w, y: PAGE_H - 40, font: l.font, size: 9, color: MUTED });
    page.drawLine({ start: { x: MARGIN, y: PAGE_H - 50 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - 50 }, thickness: 0.6, color: RULE });

    const left = pdfSafe(`${candidateName} - confidential, for the hiring school only`).slice(0, 80);
    page.drawText(left, { x: MARGIN, y: 30, font: l.font, size: 8, color: MUTED });
    const pageText = `Page ${i + 1} of ${total}`;
    const pw = l.font.widthOfTextAtSize(pageText, 8);
    page.drawText(pageText, { x: PAGE_W - MARGIN - pw, y: 30, font: l.font, size: 8, color: MUTED });
  });
}

export async function buildProfilePdf(input: {
  profile: TeachingProfile;
  candidate: PdfCandidate;
  schoolName: string;
  bands?: ShortlistBand[] | null;
}): Promise<Uint8Array> {
  const { profile, candidate, schoolName, bands } = input;
  const l = await Layout.create();

  cover(l, profile, candidate, schoolName, bands);
  summaryPage(l, profile);

  l.newPage();
  drawGroup(l, profile, 'area', 'number');
  drawGroup(l, profile, 'extra', 'number');
  drawGroup(l, profile, 'attitude', 'number');
  drawGroup(l, profile, 'resume', 'number');
  drawGroup(l, profile, 'communication', 'number');
  relevancySection(l, profile);
  drawGroup(l, profile, 'delivery', 'band');
  drawGroup(l, profile, 'appearance', 'band');

  notesPage(l, profile);
  stamp(l, schoolName, candidate.name);
  l.pdf.setTitle(`Teaching Assessment Report - ${pdfSafe(candidate.name)}`);
  l.pdf.setProducer('Edcruiter');
  return l.pdf.save();
}

