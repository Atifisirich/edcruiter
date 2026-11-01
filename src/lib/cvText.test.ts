import { describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';

vi.mock('./db', () => ({ db: { updateCandidate: vi.fn() } }));
vi.mock('./uploads', () => ({ safeUploadPath: () => null }));
vi.mock('./aiUsage', () => ({ logAiUsage: () => undefined }));

import { pdfText, ensureResumeText } from './cvText';
import type { Candidate } from './types';

async function pdfWith(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => page.drawText(line, { x: 30, y: 700 - i * 18, size: 10, font }));
  return doc.save();
}

describe('the words in a CV', () => {
  it('are read straight from the PDF', async () => {
    const bytes = await pdfWith(['Atif Khan - M.A. English, B.Ed, CTET qualified.', 'Four years teaching English at Sloka School.']);
    const text = await pdfText(bytes);
    expect(text).toContain('Atif Khan');
    expect(text).toContain('CTET qualified');
    expect(text).toContain('Sloka School');
  });

  it('are empty for something that is not a readable PDF', async () => {
    expect(await pdfText(new Uint8Array([1, 2, 3, 4]))).toBe('');
  });

  it('are used as saved when the candidate already has them', async () => {
    const saved = 'M.Sc Botany from Osmania University and B.Ed with CTET qualified. Five years teaching Biology to grades 9 and 10 at a CBSE school in Hyderabad.';
    const text = await ensureResumeText({ id: 'c', school_id: 's', resume_text: saved } as Candidate);
    expect(text).toBe(saved);
  });

  it('are empty when there is no CV file to read', async () => {
    expect(await ensureResumeText({ id: 'c', school_id: 's' } as Candidate)).toBe('');
  });
});
