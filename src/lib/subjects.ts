/** Subjects a school can pick when it posts a vacancy, in the order the dropdown shows them. */
export const VACANCY_SUBJECTS = [
  'English', 'Mathematics', 'EVS', 'Science', 'Physics', 'Chemistry', 'Biology',
  'Hindi', 'Telugu', 'French', 'Global Perspective', 'ICT/AI', 'Computer Science',
  'Social', 'History', 'Geography', 'Accounts', 'Business Studies', 'Economics',
  'Art & Craft', 'Life Skills', 'General Knowledge', 'Mother Teacher', 'Pre Primary',
  'Dance', 'Music', 'PET', 'Karate / Taekwondo', 'Basketball', 'Cricket', 'Football',
  'Swimming', 'Skating', 'Yoga', 'Athletics', 'Humanities', 'Psychology',
] as const;

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
