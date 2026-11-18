/** Subjects a school can pick when it posts a vacancy, in the order the dropdown shows them. */
export const VACANCY_SUBJECTS = [
  'English', 'Mathematics', 'EVS', 'Science', 'Physics', 'Chemistry', 'Biology',
  'Hindi', 'Telugu', 'French', 'Global Perspective', 'ICT/AI', 'Computer Science',
  'Social', 'History', 'Geography', 'Accounts', 'Business Studies', 'Economics',
  'Art & Craft', 'Life Skills', 'General Knowledge', 'Mother Teacher', 'Pre Primary',
  'Dance', 'Music', 'PET', 'Karate / Taekwondo', 'Basketball', 'Cricket', 'Football',
  'Swimming', 'Skating', 'Yoga', 'Athletics', 'Humanities', 'Psychology',
] as const;

/** Boards a vacancy or test can follow. Each is its own choice; a vacancy may tick several. */
export const CURRICULA = [
  'CBSE', 'ICSE', 'ISC', 'Cambridge IGCSE', 'Cambridge A-Levels', 'IB (PYP/MYP/DP)', 'State Board',
] as const;

/** "CBSE", "CBSE and Cambridge IGCSE", "CBSE, ICSE and IB (PYP/MYP/DP)". */
export function curriculumLabel(boards: readonly string[]): string {
  const list = boards.map((b) => b.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

const BOARD_PATTERN: Record<string, RegExp> = {
  'CBSE': /\bcbse\b/i,
  'ICSE': /\bicse\b/i,
  'ISC': /\bisc\b/i,
  'Cambridge IGCSE': /\bigcse\b/i,
  'Cambridge A-Levels': /\ba[\s-]?levels?\b/i,
  'IB (PYP/MYP/DP)': /\bib\b|international baccalaureate/i,
  'State Board': /\bstate\b/i,
};

/** Whether a vacancy's board text (new, or from before the tick boxes) includes this board. */
export function followsBoard(boardText: string | undefined, board: string): boolean {
  const pattern = BOARD_PATTERN[board];
  const text = boardText || '';
  return pattern ? pattern.test(text) : text.toLowerCase().includes(board.toLowerCase());
}

/** Subjects a school can write an AI test for: the full vacancy list plus any of the school's own. */
export function testSubjects(schoolSubjects: readonly string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...VACANCY_SUBJECTS, ...schoolSubjects]) {
    const name = s.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

export type SubjectKind = 'academic' | 'early_years' | 'arts' | 'sports';

const KIND_OF: Record<string, SubjectKind> = {
  'mother teacher': 'early_years', 'pre primary': 'early_years',
  dance: 'arts', music: 'arts', 'art & craft': 'arts',
  pet: 'sports', 'karate / taekwondo': 'sports', basketball: 'sports', cricket: 'sports',
  football: 'sports', swimming: 'sports', skating: 'sports', yoga: 'sports', athletics: 'sports',
};

/** Which kind of teacher a subject needs, so the posting asks for the right qualifications. */
export function subjectKind(subject?: string): SubjectKind {
  return KIND_OF[(subject || '').trim().toLowerCase()] ?? 'academic';
}
