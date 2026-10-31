/**
 * The teaching profile: a school-facing report built from everything a
 * candidate submitted. It is deliberately split in three, so a reader can tell
 * a fact from an estimate:
 *
 *   measured      - marks and counts worked out by code (MCQ marks, word count, integrity events)
 *   answers/cv    - AI judgement of what the candidate wrote or said; every score carries a reason
 *                   and a quote that code checks really appears in their submission
 *   observations  - AI impressions from the recorded video (eye contact, body language, ...).
 *                   Shown as bands, never as a number, and never counted in the overall score.
 *
 * Everything here is pure, so it is tested without calling a model.
 */

import { bandForScore, type ShortlistBand } from './shortlistBands';

export type FactorGroup = 'area' | 'extra' | 'resume' | 'communication' | 'attitude' | 'delivery' | 'appearance';
export type FactorSource = 'answers' | 'cv' | 'video';
export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface FactorDef {
  key: string;
  label: string;
  group: FactorGroup;
  source: FactorSource;
  definition: string;
  /** Share of the overall score. Only the six core areas carry one (the CV carries its own below). */
  weight?: number;
}

export const FACTOR_DEFS: FactorDef[] = [
  // The six core teaching areas
  { key: 'professionalism', label: 'Professionalism', group: 'area', source: 'answers', weight: 14,
    definition: 'Respectful, accountable and prepared; sound judgement; language fit for a school.' },
  { key: 'communication', label: 'Communication', group: 'area', source: 'answers', weight: 14,
    definition: 'Explains ideas clearly and in order, in language a class can follow.' },
  { key: 'teaching_excellence', label: 'Teaching excellence', group: 'area', source: 'answers', weight: 20,
    definition: 'Lesson design, delivery, checking understanding, feedback and reflection.' },
  { key: 'classroom_management', label: 'Classroom management', group: 'area', source: 'answers', weight: 14,
    definition: 'How they would keep order, handle behaviour and keep a class learning.' },
  { key: 'subject_knowledge', label: 'Subject knowledge', group: 'area', source: 'answers', weight: 20,
    definition: 'Accuracy and depth in the subject, and the curriculum it is taught in.' },
  { key: 'inclusive_modern_teaching', label: 'Inclusive & modern teaching', group: 'area', source: 'answers', weight: 8,
    definition: 'Teaching every learner, including mixed ability, and using technology sensibly.' },

  // Extra teaching factors
  { key: 'pedagogy', label: 'Pedagogy', group: 'extra', source: 'answers',
    definition: 'Choice and justification of teaching methods: questioning, scaffolding, checks for understanding.' },
  { key: 'lesson_planning', label: 'Lesson planning', group: 'extra', source: 'answers',
    definition: 'Clear outcomes, timing, activities, differentiation and an exit check.' },
  { key: 'student_engagement', label: 'Student engagement', group: 'extra', source: 'answers',
    definition: 'Hooks, questions and activities that keep students involved.' },
  { key: 'safeguarding_awareness', label: 'Safeguarding awareness', group: 'extra', source: 'answers',
    definition: 'Puts child safety first: reports concerns, keeps boundaries, follows school policy.' },

  // CV
  { key: 'school_fit', label: 'School fit', group: 'resume', source: 'cv',
    definition: 'How well their background matches this school, board and grade level.' },
  { key: 'relevant_experience', label: 'Relevant experience', group: 'resume', source: 'cv',
    definition: 'Teaching experience that relates to the role they applied for.' },
  { key: 'role_knowledge', label: 'Role knowledge', group: 'resume', source: 'cv',
    definition: 'Understanding of what the role involves, shown by past responsibilities.' },
  { key: 'education', label: 'Education & qualifications', group: 'resume', source: 'cv',
    definition: 'Subject degree, B.Ed and teacher-eligibility tests such as CTET or TET.' },
  { key: 'teaching_skills', label: 'Teaching & technology skills', group: 'resume', source: 'cv',
    definition: 'Curriculum, assessment and classroom-technology skills listed or evidenced.' },

  // Communication detail
  { key: 'clarity', label: 'Clarity', group: 'communication', source: 'answers',
    definition: 'Ideas are expressed so a listener understands them easily.' },
  { key: 'articulation', label: 'Articulation', group: 'communication', source: 'video',
    definition: 'Distinct, easy-to-follow pronunciation. Judged from the audio of the recording.' },
  { key: 'grammar', label: 'Grammar', group: 'communication', source: 'answers',
    definition: 'Correct sentences and word forms.' },
  { key: 'vocabulary', label: 'Vocabulary', group: 'communication', source: 'answers',
    definition: 'A suitable range of words for the subject and the classroom.' },
  { key: 'language_proficiency', label: 'Language proficiency', group: 'communication', source: 'answers',
    definition: 'Overall fluency and comfort in the language of instruction.' },
  { key: 'coherence', label: 'Coherence', group: 'communication', source: 'answers',
    definition: 'Ideas are organised and connected logically.' },
  { key: 'engagement', label: 'Engagement', group: 'communication', source: 'answers',
    definition: 'Speaks in a way that draws a listener in.' },
  { key: 'conciseness', label: 'Conciseness', group: 'communication', source: 'answers',
    definition: 'Stays on the point without padding or rambling.' },
  { key: 'formality', label: 'Formality & tone', group: 'communication', source: 'answers',
    definition: 'A tone suitable for a school and an interview.' },

  // Attitude
  { key: 'positive_attitude', label: 'Positive attitude', group: 'attitude', source: 'answers',
    definition: 'Constructive, optimistic and encouraging approach to students and challenges.' },
  { key: 'sentiment', label: 'Sentiment', group: 'attitude', source: 'answers',
    definition: 'Positive, supportive word choices toward students and colleagues.' },

  // Observations from the video (never counted in the overall score)
  { key: 'eye_contact', label: 'Eye contact', group: 'delivery', source: 'video',
    definition: 'Looks toward the camera as a teacher would look at a class.' },
  { key: 'body_language', label: 'Body language', group: 'delivery', source: 'video',
    definition: 'Natural gestures and posture that support the explanation.' },
  { key: 'facial_expression', label: 'Facial expression', group: 'delivery', source: 'video',
    definition: 'Warm, approachable expression.' },
  { key: 'energy_level', label: 'Energy', group: 'delivery', source: 'video',
    definition: 'Enough energy and enthusiasm to hold a class.' },
  { key: 'voice_modulation', label: 'Voice modulation', group: 'delivery', source: 'video',
    definition: 'Pace, volume and pitch that keep listeners engaged.' },
  { key: 'attire', label: 'Attire', group: 'appearance', source: 'video',
    definition: 'Neat and suitable for a classroom. Religious and cultural dress is never marked down.' },
  { key: 'grooming', label: 'Grooming', group: 'appearance', source: 'video',
    definition: 'Tidy and presentable on camera.' },
];

export const GROUP_LABEL: Record<FactorGroup, string> = {
  area: 'Teaching areas',
  extra: 'More teaching factors',
  resume: 'CV review',
  communication: 'Communication in detail',
  attitude: 'Attitude',
  delivery: 'Delivery on video',
  appearance: 'Presentation on video',
};

export const GROUP_NOTE: Record<FactorGroup, string> = {
  area: 'Scored from what the candidate wrote and said. Each score has a reason and a quote from their answer.',
  extra: 'Scored from the lesson plan, teaching demo and scenario answers.',
  resume: 'Scored from the CV they uploaded.',
  communication: 'Scored from the words in their answers and the audio of the recording.',
  attitude: 'Scored from the tone and word choices in their answers.',
  delivery: 'AI impressions from the recorded video. These are indicative only and do not change the overall score.',
  appearance: 'AI impressions from the recorded video. Indicative only, switched on by the school, and never part of the overall score.',
};

const DEF_BY_KEY = new Map(FACTOR_DEFS.map((d) => [d.key, d]));
export function factorDef(key: string): FactorDef | undefined {
  return DEF_BY_KEY.get(key);
}
export function defsInGroup(group: FactorGroup): FactorDef[] {
  return FACTOR_DEFS.filter((d) => d.group === group);
}

/** Share of the overall score that comes from the CV review. */
export const RESUME_WEIGHT = 10;
/** Below this much counted weight the overall is "not enough evidence" rather than a number. */
export const MIN_COUNTED_WEIGHT = 40;
/** Abusive or refusing answers cap the profile however well the rest reads. */
export const MISCONDUCT_OVERALL_CAP = 30;
export const MISCONDUCT_AREA_CAP = 10;

export interface ProfileFactor {
  key: string;
  label: string;
  group: FactorGroup;
  source: FactorSource;
  definition: string;
  score: number | null;
  reason: string;
  quote?: string;
  confidence: Confidence;
  /** True when the score contributes to the overall score. */
  counted: boolean;
}

export interface ProfileRelevancy {
  id: string;
  question: string;
  score: number | null;
}

export interface ProfileMeasured {
  mcq_correct: number | null;
  mcq_total: number | null;
  lesson_words: number | null;
  integrity_score: number | null;
  integrity_label: string | null;
  integrity_flags: number;
  stages_completed: number;
  interview_rounds: { round: string; decision: string }[];
}

export interface TeachingProfile {
  version: 1;
  candidate_id: string;
  school_id: string;
  generated_at: string;
  status: 'ready' | 'partial' | 'failed';
  error?: string;
  model?: string;
  overall: { score: number | null; counted_weight: number; capped_reason?: string };
  summary: string;
  strengths: string[];
  improvements: string[];
  factors: ProfileFactor[];
  relevancy: ProfileRelevancy[];
  measured: ProfileMeasured;
  observations: { delivery_enabled: boolean; appearance_enabled: boolean; video_analyzed: boolean };
}

export interface ReportSettings {
  /** Eye contact, body language, expression, energy and voice. On unless the school turns it off. */
  delivery_observations?: boolean;
  /** Attire and grooming. Off unless the school turns it on. */
  appearance_observations?: boolean;
}

export function reportSettingsOf(settings?: ReportSettings | null): { delivery: boolean; appearance: boolean } {
  return {
    delivery: settings?.delivery_observations !== false,
    appearance: settings?.appearance_observations === true,
  };
}

// ---------------------------------------------------------------------------
// Bands and stars
// ---------------------------------------------------------------------------

export type ScoreTone = 'red' | 'yellow' | 'green';

/** 0-40 red, 41-79 yellow, 80-100 green. */
export function scoreTone(score: number): ScoreTone {
  if (score >= 80) return 'green';
  if (score >= 41) return 'yellow';
  return 'red';
}

export function scoreLabel(score: number): string {
  const tone = scoreTone(score);
  return tone === 'green' ? 'Strong' : tone === 'yellow' ? 'Developing' : 'Needs attention';
}

/** Observations are shown as a word, not a number, because the underlying reading is rough. */
export function observationLabel(factor: Pick<ProfileFactor, 'score' | 'confidence'>): string {
  if (factor.score === null || factor.confidence === 'none') return 'Not enough evidence';
  if (factor.score >= 75) return 'Strong';
  if (factor.score >= 50) return 'Adequate';
  return 'Needs attention';
}

/** Five stars in half steps. */
export function stars(score: number): number {
  return Math.round((Math.max(0, Math.min(100, score)) / 20) * 2) / 2;
}

export function recommendationFor(score: number | null, bands?: ShortlistBand[] | null): { label: string; tone: ShortlistBand['tone'] } | null {
  if (score === null) return null;
  const band = bandForScore(score, bands);
  return { label: band.label, tone: band.tone };
}

// ---------------------------------------------------------------------------
// Checking the model's quotes
// ---------------------------------------------------------------------------

function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * True when `quote` really appears in one of the candidate's own submissions.
 * Case, spacing and punctuation are ignored; the words must match exactly, so a
 * quote the model made up or paraphrased does not pass.
 */
export function quoteAppearsIn(quote: string, sources: string[]): boolean {
  const q = squash(quote);
  if (q.length < 12 || q.split(' ').length < 3) return false;
  return sources.some((s) => squash(s).includes(q));
}

// ---------------------------------------------------------------------------
// Turning the model's answer into factors
// ---------------------------------------------------------------------------

export interface RawFactor {
  score?: unknown;
  reason?: unknown;
  quote?: unknown;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function cleanScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Builds one factor from the model's raw answer.
 *  - no score or no reason  -> "not enough evidence"
 *  - answer/CV factors need a quote that is really in the submission; without one
 *    the score is shown but with low confidence and not counted
 *  - video observations are never better than medium confidence and never counted
 */
export function buildFactor(def: FactorDef, raw: RawFactor | undefined, sources: string[], videoAnalyzed: boolean): ProfileFactor {
  const base = {
    key: def.key, label: def.label, group: def.group, source: def.source, definition: def.definition,
  };
  const score = cleanScore(raw?.score);
  const reason = cleanText(raw?.reason, 400);
  const quote = cleanText(raw?.quote, 240);

  if (score === null || !reason) {
    const none = def.source === 'video' ? 'The recording did not show enough to judge this.' : 'Not enough evidence in what the candidate submitted.';
    return { ...base, score: null, reason: none, confidence: 'none', counted: false };
  }

  if (def.source === 'video') {
    if (!videoAnalyzed) {
      return { ...base, score: null, reason: 'The video could not be analysed.', confidence: 'none', counted: false };
    }
    return { ...base, score, reason, confidence: 'medium', counted: false };
  }

  const verified = quote !== '' && quoteAppearsIn(quote, sources);
  const confidence: Confidence = verified ? 'high' : 'low';
  const counted = def.group === 'area' || def.group === 'resume' ? verified : false;
  return { ...base, score, reason, ...(verified ? { quote } : {}), confidence, counted };
}

export function buildFactors(
  defs: FactorDef[],
  rawByKey: Record<string, RawFactor | undefined>,
  sources: { answers: string[]; cv: string[] },
  videoAnalyzed: boolean
): ProfileFactor[] {
  return defs.map((d) => buildFactor(d, rawByKey[d.key], d.source === 'cv' ? sources.cv : sources.answers, videoAnalyzed));
}

// ---------------------------------------------------------------------------
// The overall score
// ---------------------------------------------------------------------------

/**
 * Weighted average of the six core areas plus the CV review, using only the
 * parts that have verified evidence. Returns null when too little is counted to
 * be fair to the candidate.
 */
export function computeOverall(factors: ProfileFactor[], misconductReason?: string): TeachingProfile['overall'] {
  let weighted = 0;
  let weight = 0;

  for (const def of defsInGroup('area')) {
    const f = factors.find((x) => x.key === def.key);
    if (f?.counted && f.score !== null) {
      weighted += f.score * (def.weight ?? 0);
      weight += def.weight ?? 0;
    }
  }

  const resume = factors.filter((f) => f.group === 'resume' && f.counted && f.score !== null);
  if (resume.length >= 3) {
    const avg = resume.reduce((sum, f) => sum + (f.score as number), 0) / resume.length;
    weighted += avg * RESUME_WEIGHT;
    weight += RESUME_WEIGHT;
  }

  if (weight < MIN_COUNTED_WEIGHT) return { score: null, counted_weight: weight };

  let score = Math.round(weighted / weight);
  let capped_reason: string | undefined;
  if (misconductReason && score > MISCONDUCT_OVERALL_CAP) {
    score = MISCONDUCT_OVERALL_CAP;
    capped_reason = misconductReason;
  }
  return { score, counted_weight: weight, ...(capped_reason ? { capped_reason } : {}) };
}

/** A candidate who was abusive or refused to answer cannot score well in professionalism, whatever else reads well. */
export function applyMisconduct(factors: ProfileFactor[], misconductReason?: string): ProfileFactor[] {
  if (!misconductReason) return factors;
  return factors.map((f) => {
    if (f.key !== 'professionalism' && f.key !== 'formality') return f;
    const capped = f.score === null ? MISCONDUCT_AREA_CAP : Math.min(f.score, MISCONDUCT_AREA_CAP);
    return {
      ...f,
      score: capped,
      reason: `${misconductReason} ${f.reason && f.confidence !== 'none' ? f.reason : ''}`.trim().slice(0, 400),
      confidence: f.confidence === 'none' ? 'medium' : f.confidence,
      counted: f.group === 'area',
    };
  });
}

// ---------------------------------------------------------------------------
// Facts worked out by code
// ---------------------------------------------------------------------------

export function parseMcqMarks(writtenSubmission: string | undefined): { correct: number; total: number } | null {
  if (!writtenSubmission) return null;
  const mcqPart = writtenSubmission.split('--- LESSON PLAN ---')[0];
  const correct = (mcqPart.match(/\(Correct\)/g) || []).length;
  const incorrect = (mcqPart.match(/\(Incorrect\)/g) || []).length;
  const total = correct + incorrect;
  return total > 0 ? { correct, total } : null;
}

export function lessonPlanText(writtenSubmission: string | undefined): string {
  if (!writtenSubmission) return '';
  const idx = writtenSubmission.indexOf('--- LESSON PLAN ---');
  return idx >= 0 ? writtenSubmission.slice(idx + '--- LESSON PLAN ---'.length).trim() : '';
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
