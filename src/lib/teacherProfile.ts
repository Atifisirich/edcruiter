/**
 * The subject, board and education details a school records when it adds a
 * teacher by hand. The lists here feed the "Add candidate" form; the clean…
 * functions check what the server receives, so a hand-crafted request cannot
 * store junk; summariseEducation keeps the older one-line `qualification`
 * field filled for the screens and the AI scoring that still read it.
 */

export interface SubjectGroup {
  group: string;
  subjects: string[];
}

/** Subjects taught in Indian schools, grouped the way a school thinks of them. */
export const INDIAN_SCHOOL_SUBJECTS: SubjectGroup[] = [
  {
    group: 'Languages',
    subjects: [
      'English', 'Hindi', 'Telugu', 'Sanskrit', 'Urdu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi',
      'Bengali', 'Gujarati', 'Punjabi', 'Odia', 'Assamese', 'French', 'German', 'Spanish', 'Japanese',
      'Mandarin', 'Arabic',
    ],
  },
  {
    group: 'Maths and science',
    subjects: ['Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology', 'EVS (Environmental Studies)', 'Environmental Science'],
  },
  {
    group: 'Social sciences',
    subjects: ['Social Studies', 'History', 'Geography', 'Civics / Political Science', 'Sociology', 'Psychology'],
  },
  {
    group: 'Commerce',
    subjects: ['Economics', 'Commerce', 'Accountancy', 'Business Studies'],
  },
  {
    group: 'Computers',
    subjects: ['Computer Science', 'Information Technology (IT)', 'Artificial Intelligence (AI)', 'Robotics / Coding'],
  },
  {
    group: 'Arts and sport',
    subjects: ['Physical Education (PE)', 'Yoga', 'Music', 'Dance', 'Art & Craft', 'Drama / Theatre'],
  },
  {
    group: 'Other roles',
    subjects: [
      'General Knowledge / Life Skills / Value Education', 'Library', 'Special Educator', 'Counsellor',
      'Pre-primary / Montessori', 'Primary (all subjects)',
    ],
  },
];

/** Other spellings schools use for a subject in the list above. */
const SUBJECT_ALIASES: Record<string, string> = {
  math: 'Mathematics',
  maths: 'Mathematics',
  social: 'Social Studies',
  'social science': 'Social Studies',
  sst: 'Social Studies',
  accounts: 'Accountancy',
  'computer sciences': 'Computer Science',
  computers: 'Computer Science',
  evs: 'EVS (Environmental Studies)',
  pe: 'Physical Education (PE)',
  'physical education': 'Physical Education (PE)',
  'gk/ life skills/ value education': 'General Knowledge / Life Skills / Value Education',
  'political science': 'Civics / Political Science',
  civics: 'Civics / Political Science',
  it: 'Information Technology (IT)',
  ai: 'Artificial Intelligence (AI)',
};

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function standardName(subject: string): string | undefined {
  const n = norm(subject);
  const alias = SUBJECT_ALIASES[n];
  if (alias) return alias;
  for (const g of INDIAN_SCHOOL_SUBJECTS) for (const s of g.subjects) if (norm(s) === n) return s;
  return undefined;
}

/**
 * The full list, merged with the school's own subjects. Where the school has
 * its own name for a listed subject ("Math"), its name is shown in that place,
 * so candidates keep matching the school's vacancies and tests. Subjects of the
 * school's that are not on the list come first, under "Your school".
 */
export function subjectOptions(schoolSubjects: string[] = []): SubjectGroup[] {
  const own = new Map<string, string>(); // standard name -> school's spelling
  const extra: string[] = [];
  const seen = new Set<string>();
  for (const raw of schoolSubjects) {
    const name = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (!name || seen.has(norm(name))) continue;
    seen.add(norm(name));
    const std = standardName(name);
    if (std && !own.has(std)) own.set(std, name);
    else if (!std) extra.push(name);
  }
  const groups = INDIAN_SCHOOL_SUBJECTS.map((g) => ({ group: g.group, subjects: g.subjects.map((s) => own.get(s) ?? s) }));
  return extra.length ? [{ group: 'Your school', subjects: extra }, ...groups] : groups;
}

/** Each board is its own choice. */
export const BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'Cambridge IGCSE', 'Cambridge A-Levels', 'IB PYP', 'IB MYP', 'IB DP', 'State Board', 'NIOS',
] as const;

export const BACHELOR_DEGREES = ['BA', 'B.Sc', 'B.Com', 'BBA', 'BCA', 'B.Tech / BE', 'B.Arch', 'B.Pharm', 'B.Des / BFA', 'BSW', 'LLB'] as const;
export const MASTER_DEGREES = ['MA', 'M.Sc', 'M.Com', 'MBA', 'MCA', 'M.Tech', 'ME', 'M.Arch', 'M.Pharm', 'MFA', 'MSW', 'LLM', 'M.Phil'] as const;

export const TRAINING_KINDS = [
  { id: 'bed', label: 'B.Ed' },
  { id: 'deled', label: 'D.El.Ed' },
  { id: 'ntt', label: 'NTT' },
  { id: 'montessori', label: 'Montessori' },
  { id: 'ecce', label: 'ECCE' },
] as const;
export type TrainingKind = (typeof TRAINING_KINDS)[number]['id'];
export type CourseStatus = 'completed' | 'in_progress';

export interface Degree {
  /** One of the listed degrees, or what the school typed for "Other". */
  degree: string;
  /** Subject or specialisation, such as "Physics". */
  subject?: string;
}

export interface CandidateEducation {
  bachelor?: Degree;
  /**
   * B.Ed and other teacher training. An empty list means "none"; leaving it
   * out means the school does not know yet.
   */
  teacher_training?: { kind: TrainingKind; status: CourseStatus }[];
  master?: Degree;
  m_ed?: boolean;
  phd?: boolean;
  ctet?: boolean;
  state_tet?: boolean;
}

const MAX_TEXT = 80;

/** Trimmed, single-spaced text no longer than `max`, or '' when there is none. */
export function cleanText(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  const printable = Array.from(value.replace(/\s+/g, ' '))
    .filter((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127)
    .join('');
  return printable.trim().replace(/ +/g, ' ').slice(0, max).trim();
}

/** The subject, or '' when none was given. Any subject is allowed ("Other"), within reason. */
export function cleanSubject(value: unknown): string {
  return cleanText(value);
}

/**
 * Boards the candidate has taught, each known board in its usual spelling, plus
 * at most a few boards typed in under "Other". Duplicates are dropped.
 */
export function cleanBoards(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  let others = 0;
  for (const raw of value) {
    const text = cleanText(raw, 60);
    if (!text) continue;
    const known = BOARDS.find((b) => norm(b) === norm(text));
    if (!known && ++others > 3) continue;
    const name = known ?? text;
    if (seen.has(norm(name))) continue;
    seen.add(norm(name));
    out.push(name);
  }
  return out;
}

function cleanDegree(value: unknown, listed: readonly string[]): Degree | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  const typed = cleanText(v.degree, 40);
  if (!typed) return undefined;
  const degree = listed.find((d) => norm(d) === norm(typed)) ?? typed;
  const subject = cleanText(v.subject);
  return subject ? { degree, subject } : { degree };
}

/**
 * The education details as sent by the form, checked: unknown keys, unknown
 * training kinds and non-boolean flags are dropped. Returns undefined when
 * nothing is left.
 */
export function cleanEducation(value: unknown): CandidateEducation | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const v = value as Record<string, unknown>;
  const out: CandidateEducation = {};

  const bachelor = cleanDegree(v.bachelor, BACHELOR_DEGREES);
  if (bachelor) out.bachelor = bachelor;
  const master = cleanDegree(v.master, MASTER_DEGREES);
  if (master) out.master = master;

  if (Array.isArray(v.teacher_training)) {
    const kinds = new Set<string>(TRAINING_KINDS.map((k) => k.id));
    const seen = new Set<string>();
    out.teacher_training = [];
    for (const t of v.teacher_training) {
      if (!t || typeof t !== 'object') continue;
      const { kind, status } = t as Record<string, unknown>;
      if (typeof kind !== 'string' || !kinds.has(kind) || seen.has(kind)) continue;
      seen.add(kind);
      out.teacher_training.push({ kind: kind as TrainingKind, status: status === 'in_progress' ? 'in_progress' : 'completed' });
    }
  }

  for (const flag of ['m_ed', 'phd', 'ctet', 'state_tet'] as const) {
    if (v[flag] === true) out[flag] = true;
  }

  return Object.keys(out).length ? out : undefined;
}

/** The value of an "Other" choice in a list; the typed text is used instead. */
export const OTHER_CHOICE = '__other';

/** A degree as the form holds it: a choice from the list, or OTHER_CHOICE and typed text. */
export interface DegreeForm {
  choice: string;
  other: string;
  subject: string;
}

/** The education part of the "Add candidate" form, as it holds it. */
export interface EducationForm {
  bachelor: DegreeForm;
  master: DegreeForm;
  /** The teacher training they have, and whether each is finished. */
  training: Partial<Record<TrainingKind, CourseStatus>>;
  /** The school knows they have no B.Ed or other teacher training. */
  noTraining: boolean;
  m_ed: boolean;
  phd: boolean;
  ctet: boolean;
  state_tet: boolean;
}

function degreeFromForm(d: DegreeForm): Degree | undefined {
  const degree = (d.choice === OTHER_CHOICE ? d.other : d.choice).trim();
  if (!degree) return undefined;
  const subject = d.subject.trim();
  return subject ? { degree, subject } : { degree };
}

/** What the form holds, in the shape the server stores. Parts left blank are left out. */
export function educationFromForm(e: EducationForm): CandidateEducation | undefined {
  const out: CandidateEducation = {};
  const bachelor = degreeFromForm(e.bachelor);
  if (bachelor) out.bachelor = bachelor;
  const training = TRAINING_KINDS.flatMap((k) => {
    const status = e.training[k.id];
    return status ? [{ kind: k.id, status }] : [];
  });
  if (training.length) out.teacher_training = training;
  else if (e.noTraining) out.teacher_training = [];
  const master = degreeFromForm(e.master);
  if (master) out.master = master;
  if (e.m_ed) out.m_ed = true;
  if (e.phd) out.phd = true;
  if (e.ctet) out.ctet = true;
  if (e.state_tet) out.state_tet = true;
  return Object.keys(out).length ? out : undefined;
}

function degreeText(d: Degree): string {
  return d.subject ? `${d.degree} (${d.subject})` : d.degree;
}

export function trainingLabel(kind: TrainingKind): string {
  return TRAINING_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** One line per part, for the candidate's profile. */
export function describeEducation(e: CandidateEducation | undefined): { label: string; value: string }[] {
  if (!e) return [];
  const rows: { label: string; value: string }[] = [];
  if (e.bachelor) rows.push({ label: "Bachelor's degree", value: degreeText(e.bachelor) });
  if (e.teacher_training) {
    rows.push({
      label: 'B.Ed / teacher training',
      value: e.teacher_training.length
        ? e.teacher_training.map((t) => `${trainingLabel(t.kind)}${t.status === 'in_progress' ? ' (in progress)' : ''}`).join(', ')
        : 'None',
    });
  }
  if (e.master) rows.push({ label: "Master's degree", value: degreeText(e.master) });
  const more = [e.m_ed && 'M.Ed', e.phd && 'PhD', e.ctet && 'CTET passed', e.state_tet && 'State TET passed'].filter(Boolean);
  if (more.length) rows.push({ label: 'Also has', value: more.join(', ') });
  return rows;
}

/**
 * A readable one-line summary, such as
 * "M.Sc (Physics), B.Sc (Physics), B.Ed, CTET passed". Highest degree first,
 * as the older qualification text and the AI scoring expect.
 */
export function summariseEducation(e: CandidateEducation | undefined): string {
  if (!e) return '';
  const parts: string[] = [];
  if (e.phd) parts.push('PhD');
  if (e.master) parts.push(degreeText(e.master));
  if (e.bachelor) parts.push(degreeText(e.bachelor));
  if (e.m_ed) parts.push('M.Ed');
  for (const t of e.teacher_training ?? []) parts.push(`${trainingLabel(t.kind)}${t.status === 'in_progress' ? ' (in progress)' : ''}`);
  if (e.teacher_training && e.teacher_training.length === 0) parts.push('No B.Ed');
  if (e.ctet) parts.push('CTET passed');
  if (e.state_tet) parts.push('State TET passed');
  return parts.join(', ');
}
