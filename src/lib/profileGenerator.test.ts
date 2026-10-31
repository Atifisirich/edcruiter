import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candidate, StageResult } from './types';
import type { TeachingProfile } from './teachingProfile';

const saved: TeachingProfile[] = [];
let stageResults: StageResult[] = [];
let existingProfile: TeachingProfile | undefined;

const candidate = {
  id: 'c1', school_id: 's1', name: 'Priya', email: 'p@x.in', phone: '9', qualification: 'M.Sc', experience_band: '2-4 years',
  applied_subject: 'Biology', applied_segment: 'Secondary 9-10', resume_text: 'M.Sc Botany from Osmania University and B.Ed with CTET qualified.',
  interview_decisions: [],
} as unknown as Candidate;

vi.mock('./db', () => ({
  db: {
    getCandidateById: () => candidate,
    getSchoolById: () => ({ id: 's1', name: 'Green Valley', curriculum_guidelines: { board: 'CBSE' } }),
    getStageResultsByCandidate: () => stageResults,
    getProctoringEventsByCandidate: () => [],
    getTeachingProfile: () => existingProfile,
    saveTeachingProfile: (p: TeachingProfile) => { saved.push(p); return p; },
  },
}));
vi.mock('./ensurePack', () => ({ findActivePack: () => ({ lesson_prompt: 'Plan a lesson', demo_prompt: 'Record a demo', scenario_prompt: 'Handle a scenario' }) }));
vi.mock('./aiUsage', () => ({ logAiUsage: () => undefined }));
const prepareMediaPart = vi.fn();
vi.mock('./aiScoringEngine', async () => {
  const actual = await vi.importActual<typeof import('./aiScoringEngine')>('./aiScoringEngine');
  return { ...actual, prepareMediaPart: (...a: unknown[]) => prepareMediaPart(...a) };
});

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: (...a: unknown[]) => generateContent(...a) };
    files = { delete: () => Promise.resolve() };
  },
}));

import { generateTeachingProfile, maybeGenerateTeachingProfile, scoredStagesFinished } from './profileGenerator';

const LESSON = 'Hook: show a wilting plant. Misconception: plants eat soil. I will use a quick poll and an exit ticket at the end of the lesson.';
const SCENARIO = 'I would stay calm, move close to the student and ask what happened before speaking to the class.';

function stage(key: StageResult['stage_key'], extra: Partial<StageResult> = {}): StageResult {
  return { id: key, school_id: 's1', candidate_id: 'c1', stage_key: key, stage_name: key, completed_at: '2026-10-31T06:00:00.000Z', scoring_status: 'done', ...extra };
}

function modelReply(factors: Record<string, unknown>) {
  return { text: JSON.stringify({ summary: 'A decent candidate.', strengths: ['Calm'], improvements: ['Timing'], relevancy: { lesson: 80, demo: 70, scenario: 75 }, factors }), usageMetadata: {} };
}

const goodFactors = (quote = 'I would stay calm, move close to the student') => Object.fromEntries(
  ['professionalism', 'communication', 'teaching_excellence', 'classroom_management', 'subject_knowledge', 'inclusive_modern_teaching'].map((k) => [k, { score: 70, reason: 'Good.', quote }])
);

beforeEach(() => {
  vi.clearAllMocks();
  saved.length = 0;
  existingProfile = undefined;
  process.env.GEMINI_API_KEY = 'test-key';
  prepareMediaPart.mockResolvedValue(null);
  stageResults = [
    stage('written_theory', { written_submission: `MCQ TEST\n\nQ: a\nSelected: x\nKey: x (Correct)\n\n--- LESSON PLAN ---\n\n${LESSON}` }),
    stage('micro_teaching_demo', { transcript: 'Today we will learn about how leaves make food using sunlight.' }),
    stage('situational_scenario', { transcript: SCENARIO }),
  ];
});

describe('generateTeachingProfile', () => {
  it('writes a profile, counting only scores whose quote is really in the candidate\'s answer', async () => {
    generateContent.mockResolvedValue(modelReply({
      ...goodFactors(),
      pedagogy: { score: 90, reason: 'Excellent.', quote: 'I run the most engaging classes in the district' },
    }));

    const profile = await generateTeachingProfile('s1', 'c1');

    expect(profile.status).toBe('ready');
    expect(profile.overall.score).toBe(70);
    expect(profile.factors.find((f) => f.key === 'classroom_management')).toMatchObject({ confidence: 'high', counted: true });
    expect(profile.factors.find((f) => f.key === 'pedagogy')).toMatchObject({ confidence: 'low', counted: false });
    expect(profile.measured).toMatchObject({ mcq_correct: 1, mcq_total: 1 });
    expect(profile.relevancy.map((r) => r.score)).toEqual([80, 70, 75]);
    expect(saved).toHaveLength(1);
  });

  it('fails cleanly, with a message, when the AI is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const profile = await generateTeachingProfile('s1', 'c1');
    expect(profile.status).toBe('failed');
    expect(profile.error).toMatch(/not configured/);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('fails cleanly when the AI reply cannot be read', async () => {
    generateContent.mockResolvedValue({ text: 'I am sorry, I cannot do that.', usageMetadata: {} });
    const profile = await generateTeachingProfile('s1', 'c1');
    expect(profile.status).toBe('failed');
    expect(saved).toHaveLength(1);
  });

  it('stores a failure instead of throwing when the AI call itself breaks', async () => {
    generateContent.mockRejectedValue(new Error('quota exceeded'));
    const profile = await generateTeachingProfile('s1', 'c1');
    expect(profile.status).toBe('failed');
    expect(profile.error).toMatch(/quota exceeded/);
  });

  it('caps the overall score and professionalism when the candidate was abusive', async () => {
    stageResults[2] = stage('situational_scenario', { transcript: 'This is a stupid question, fuck this, I would stay calm, move close to the student.' });
    generateContent.mockResolvedValue(modelReply(goodFactors()));

    const profile = await generateTeachingProfile('s1', 'c1');

    expect(profile.overall.score).toBeLessThanOrEqual(30);
    expect(profile.overall.capped_reason).toBeTruthy();
    expect(profile.factors.find((f) => f.key === 'professionalism')!.score).toBeLessThanOrEqual(10);
  });

  it('adds video impressions when the video can be read, and never counts them', async () => {
    stageResults[1] = stage('micro_teaching_demo', { transcript: 'Today we will learn about leaves.', media_url: '/api/media/demo.webm' });
    prepareMediaPart.mockResolvedValue({ part: { inlineData: { mimeType: 'video/webm', data: 'x' } } });
    generateContent
      .mockResolvedValueOnce(modelReply(goodFactors()))
      .mockResolvedValueOnce({ text: JSON.stringify({ factors: { eye_contact: { score: 80, reason: 'Looks at the camera.' }, articulation: { score: 70, reason: 'Clear.' } } }), usageMetadata: {} });

    const profile = await generateTeachingProfile('s1', 'c1');

    expect(profile.observations.video_analyzed).toBe(true);
    const eye = profile.factors.find((f) => f.key === 'eye_contact')!;
    expect(eye).toMatchObject({ score: 80, counted: false, confidence: 'medium' });
    expect(profile.factors.find((f) => f.key === 'attire')).toBeUndefined(); // appearance is off by default
    expect(profile.overall.score).toBe(70);
  });

  it('marks the profile partial when there is a video but it could not be read', async () => {
    stageResults[1] = stage('micro_teaching_demo', { transcript: 'Today we will learn about leaves.', media_url: '/api/media/demo.webm' });
    prepareMediaPart.mockResolvedValue(null);
    generateContent.mockResolvedValue(modelReply(goodFactors()));

    const profile = await generateTeachingProfile('s1', 'c1');
    expect(profile.status).toBe('partial');
    expect(profile.factors.find((f) => f.key === 'eye_contact')).toMatchObject({ score: null, confidence: 'none' });
  });
});

describe('maybeGenerateTeachingProfile', () => {
  it('waits until every scored stage is finished', async () => {
    stageResults[2] = stage('situational_scenario', { scoring_status: 'pending' });
    await maybeGenerateTeachingProfile('s1', 'c1');
    expect(generateContent).not.toHaveBeenCalled();
    expect(scoredStagesFinished(stageResults)).toBe(false);
  });

  it('writes the profile once the last scored stage is done', async () => {
    generateContent.mockResolvedValue(modelReply(goodFactors()));
    await maybeGenerateTeachingProfile('s1', 'c1');
    expect(saved).toHaveLength(1);
  });

  it('does not write it again when a current profile already exists', async () => {
    existingProfile = { status: 'ready', generated_at: '2026-10-31T07:00:00.000Z' } as TeachingProfile;
    await maybeGenerateTeachingProfile('s1', 'c1');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('tries again when the earlier attempt failed', async () => {
    existingProfile = { status: 'failed', generated_at: '2026-10-31T07:00:00.000Z' } as TeachingProfile;
    generateContent.mockResolvedValue(modelReply(goodFactors()));
    await maybeGenerateTeachingProfile('s1', 'c1');
    expect(saved).toHaveLength(1);
  });
});
