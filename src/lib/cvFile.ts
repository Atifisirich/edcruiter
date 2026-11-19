/**
 * The file name a CV is saved under when staff download it: "Asha Rao - CV.pdf"
 * rather than the random name it is stored under. `ascii` is for the plain
 * header (no quotes, slashes or accents), `full` keeps the real name.
 */
const FORBIDDEN = new Set(['/', String.fromCharCode(92), ':', '*', '?', '"', '<', '>', '|']);

function printable(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 32 && code !== 127 && !FORBIDDEN.has(ch);
}

export function cvFilename(candidateName: string | undefined): { full: string; ascii: string } {
  const clean = Array.from(candidateName ?? '')
    .map((ch) => (printable(ch) ? ch : ' '))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  const full = clean ? `${clean} - CV.pdf` : 'Candidate CV.pdf';
  const plain = Array.from(full.normalize('NFKD'))
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  // Nothing readable left (a name in another script): fall back to a neutral name.
  return { full, ascii: plain.startsWith('-') || !plain ? 'Candidate CV.pdf' : plain };
}
