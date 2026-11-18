import { describe, expect, it } from 'vitest';
import {
  BOARDS,
  OTHER_CHOICE,
  cleanBoards,
  cleanEducation,
  cleanSubject,
  cleanText,
  describeEducation,
  educationFromForm,
  subjectOptions,
  summariseEducation,
  type EducationForm,
} from './teacherProfile';
import { SLOKA_DEFAULT_SCHOOL } from './defaultData';

const blankForm = (): EducationForm => ({
  bachelor: { choice: '', other: '', subject: '' },
  master: { choice: '', other: '', subject: '' },
  training: {},
  noTraining: false,
  m_ed: false,
  phd: false,
  ctet: false,
  state_tet: false,
});

const allSubjects = (groups: ReturnType<typeof subjectOptions>) => groups.flatMap((g) => g.subjects);

describe('subjectOptions', () => {
  it('offers the full list when the school has none of its own', () => {
    const subjects = allSubjects(subjectOptions([]));
    for (const s of ['Hindi', 'Telugu', 'Sanskrit', 'Urdu', 'Tamil', 'Kannada', 'French', 'German', 'Physics', 'Chemistry', 'Biology', 'Accountancy', 'Library', 'Counsellor']) {
      expect(subjects).toContain(s);
    }
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("uses the school's own spelling in place of the listed subject, with no duplicates", () => {
    const subjects = allSubjects(subjectOptions(['Math', 'Accounts', 'Computer Sciences', 'english']));
    expect(subjects).toContain('Math');
    expect(subjects).not.toContain('Mathematics');
    expect(subjects).toContain('Accounts');
    expect(subjects).not.toContain('Accountancy');
    expect(subjects).toContain('Computer Sciences');
    expect(subjects).not.toContain('Computer Science');
    expect(subjects).toContain('english');
    expect(subjects).not.toContain('English');
  });

  it("puts the school's subjects that are not on the list first", () => {
    const groups = subjectOptions(['Home Science', 'Physics', 'Home Science', '  ']);
    expect(groups[0]).toEqual({ group: 'Your school', subjects: ['Home Science'] });
    expect(allSubjects(groups).filter((s) => s === 'Physics')).toHaveLength(1);
  });

  it("merges the default school's subjects without duplicates", () => {
    const subjects = allSubjects(subjectOptions(SLOKA_DEFAULT_SCHOOL.subjects));
    expect(new Set(subjects.map((s) => s.toLowerCase())).size).toBe(subjects.length);
    for (const s of SLOKA_DEFAULT_SCHOOL.subjects) expect(subjects).toContain(s);
  });
});

describe('cleanText and cleanSubject', () => {
  it('trims, joins spaces, drops control characters and caps the length', () => {
    expect(cleanText('  Home \n  Science\u0007 ')).toBe('Home Science');
    expect(cleanText('x'.repeat(200))).toHaveLength(80);
    expect(cleanText(42)).toBe('');
    expect(cleanSubject(undefined)).toBe('');
    expect(cleanSubject(' Physics ')).toBe('Physics');
  });
});

describe('cleanBoards', () => {
  it('keeps each board separately, in its usual spelling, without duplicates', () => {
    expect(cleanBoards(['cbse', 'IB DP', 'CBSE', 'ib myp'])).toEqual(['CBSE', 'IB DP', 'IB MYP']);
  });

  it('allows a few boards typed under Other', () => {
    expect(cleanBoards(['CBSE', 'Telangana SSC', 'a', 'b', 'c', 'd'])).toEqual(['CBSE', 'Telangana SSC', 'a', 'b']);
  });

  it('ignores anything that is not a list of text', () => {
    expect(cleanBoards('CBSE')).toEqual([]);
    expect(cleanBoards([1, null, '', '  '])).toEqual([]);
  });

  it('has every board as its own choice, not combined', () => {
    for (const b of BOARDS) expect(b).not.toMatch(/[&/]/);
  });
});

describe('cleanEducation', () => {
  it('keeps the separate degrees and normalises listed names', () => {
    expect(
      cleanEducation({
        bachelor: { degree: 'b.sc', subject: ' Physics ' },
        teacher_training: [{ kind: 'bed', status: 'in_progress' }],
        master: { degree: 'M.Sc', subject: 'Physics' },
        ctet: true,
      })
    ).toEqual({
      bachelor: { degree: 'B.Sc', subject: 'Physics' },
      teacher_training: [{ kind: 'bed', status: 'in_progress' }],
      master: { degree: 'M.Sc', subject: 'Physics' },
      ctet: true,
    });
  });

  it('accepts an Other degree as typed', () => {
    expect(cleanEducation({ bachelor: { degree: 'B.F.A' } })).toEqual({ bachelor: { degree: 'B.F.A' } });
  });

  it('drops unknown training, duplicate training, unknown keys and non-true flags', () => {
    expect(
      cleanEducation({
        teacher_training: [{ kind: 'bed' }, { kind: 'bed', status: 'in_progress' }, { kind: 'mba' }, 'x'],
        phd: 'yes',
        m_ed: false,
        admin: true,
        bachelor: { degree: '   ' },
      })
    ).toEqual({ teacher_training: [{ kind: 'bed', status: 'completed' }] });
  });

  it('keeps an empty training list, which means "none"', () => {
    expect(cleanEducation({ teacher_training: [] })).toEqual({ teacher_training: [] });
  });

  it('returns undefined when nothing useful is left', () => {
    expect(cleanEducation(undefined)).toBeUndefined();
    expect(cleanEducation('B.Ed')).toBeUndefined();
    expect(cleanEducation([])).toBeUndefined();
    expect(cleanEducation({ phd: false })).toBeUndefined();
  });
});

describe('educationFromForm', () => {
  it('sends nothing for a blank form', () => {
    expect(educationFromForm(blankForm())).toBeUndefined();
  });

  it('uses the typed name for an Other degree, and leaves out an Other left blank', () => {
    const f = blankForm();
    f.bachelor = { choice: OTHER_CHOICE, other: ' B.F.A ', subject: 'Painting' };
    f.master = { choice: OTHER_CHOICE, other: '  ', subject: 'Art' };
    expect(educationFromForm(f)).toEqual({ bachelor: { degree: 'B.F.A', subject: 'Painting' } });
  });

  it('lists training in a fixed order, or none', () => {
    const f = blankForm();
    f.training = { ntt: 'in_progress', bed: 'completed' };
    expect(educationFromForm(f)?.teacher_training).toEqual([
      { kind: 'bed', status: 'completed' },
      { kind: 'ntt', status: 'in_progress' },
    ]);
    const g = blankForm();
    g.noTraining = true;
    expect(educationFromForm(g)).toEqual({ teacher_training: [] });
  });

  it('survives the server check unchanged', () => {
    const f = blankForm();
    f.bachelor = { choice: 'B.Com', other: '', subject: 'Accounts' };
    f.master = { choice: 'MBA', other: '', subject: '' };
    f.training = { bed: 'completed' };
    f.state_tet = true;
    const payload = educationFromForm(f);
    expect(cleanEducation(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });
});

describe('summariseEducation and describeEducation', () => {
  const edu = {
    bachelor: { degree: 'B.Sc', subject: 'Physics' },
    teacher_training: [{ kind: 'bed' as const, status: 'in_progress' as const }],
    master: { degree: 'M.Sc', subject: 'Physics' },
    phd: true,
    ctet: true,
  };

  it('gives a readable one-line qualification, highest degree first', () => {
    expect(summariseEducation(edu)).toBe('PhD, M.Sc (Physics), B.Sc (Physics), B.Ed (in progress), CTET passed');
    expect(summariseEducation({ bachelor: { degree: 'BA' }, teacher_training: [] })).toBe('BA, No B.Ed');
    expect(summariseEducation(undefined)).toBe('');
  });

  it('gives one row per part for the profile', () => {
    expect(describeEducation(edu)).toEqual([
      { label: "Bachelor's degree", value: 'B.Sc (Physics)' },
      { label: 'B.Ed / teacher training', value: 'B.Ed (in progress)' },
      { label: "Master's degree", value: 'M.Sc (Physics)' },
      { label: 'Also has', value: 'PhD, CTET passed' },
    ]);
    expect(describeEducation({ teacher_training: [] })).toEqual([{ label: 'B.Ed / teacher training', value: 'None' }]);
    expect(describeEducation(undefined)).toEqual([]);
  });
});
