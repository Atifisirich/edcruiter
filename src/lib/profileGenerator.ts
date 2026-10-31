/**
 * Writes a candidate's teaching profile: gathers what they submitted, asks the
 * model for scores and reasons, checks the model's quotes against the real
 * text, and saves the result. Never throws to its caller; a failure is stored
 * as a profile with status "failed" so the report can say so and offer a retry.
 */

import { GoogleGenAI } from '@google/genai';
import { db } from './db';
import { logAiUsage } from './aiUsage';
import { prepareMediaPart, scanMisconductAndRefusal } from './aiScoringEngine';
import { calculateAuthenticityScore } from './proctoringEngine';
import { findActivePack } from './ensurePack';
import { SCORED_STAGE_KEYS } from './scoredStages';
import {
  buildTextPrompt, buildVideoPrompt, parseTextReply, parseVideoReply, textFactorDefs, videoFactorDefs,
} from './profilePrompts';
import {
  applyMisconduct, buildFactors, computeOverall, lessonPlanText, parseMcqMarks, reportSettingsOf,
  wordCount, type ProfileFactor, type ProfileMeasured, type RawFactor, type TeachingProfile,
} from './teachingProfile';
import type { Candidate, StageResult } from './types';

const PRIMARY_MODEL = 'gemini-3.5-flash';
const FALLBACK_MODEL = 'gemini-flash-lite-latest';

const apiKey = () => process.env.GEMINI_API_KEY || '';

async function askModel(contents: unknown[], label: string): Promise<{ text: string; model: string }> {
  const ai = new GoogleGenAI({ apiKey: apiKey() });
  let model = PRIMARY_MODEL;
  let response;
  try {
    response = await ai.models.generateContent({ model, contents: contents as never });
  } catch {
    model = FALLBACK_MODEL;
    response = await ai.models.generateContent({ model, contents: contents as never });
  }
  logAiUsage(label, response, model);
  return { text: response.text ? response.text.trim() : '', model };
}

function stage(results: StageResult[], key: string): StageResult | undefined {
  return results.find((r) => r.stage_key === key);
}

function measuredFrom(candidate: Candidate, results: StageResult[], lessonWords: number | null): ProfileMeasured {
  const written = stage(results, 'written_theory');
  const marks = parseMcqMarks(written?.written_submission);
  const events = db.getProctoringEventsByCandidate(candidate.school_id, candidate.id);
  const integrity = events.length ? calculateAuthenticityScore(events) : null;
  return {
    mcq_correct: marks?.correct ?? null,
    mcq_total: marks?.total ?? null,
    lesson_words: lessonWords,
    integrity_score: integrity?.score ?? null,
    integrity_label: integrity?.label ?? null,
    integrity_flags: integrity?.violationCount ?? 0,
    stages_completed: results.length,
    interview_rounds: (candidate.interview_decisions || []).map((d) => ({ round: d.round_label, decision: d.decision })),
  };
}

/** Looks across the submissions for abuse or a refusal to answer, which caps the professionalism score. */
function misconductReasonFor(results: StageResult[], texts: string[]): string | undefined {
  for (const r of results) {
    const hit = r.ai_scores?.scores?.find((s) => s.dimension === 'professional_conduct_and_integrity' && s.score === 0);
    if (hit) return 'Abusive language or a refusal to answer was found in a submission, so this is capped.';
  }
  for (const text of texts) {
    if (!text.trim()) continue;
    const scan = scanMisconductAndRefusal(text);
    if (scan.isMisconduct && !/Empty or nearly blank/i.test(scan.reason || '')) {
      return 'Abusive language or a refusal to answer was found in a submission, so this is capped.';
    }
  }
  return undefined;
}

function failedProfile(candidate: Candidate, results: StageResult[], error: string, settings: { delivery: boolean; appearance: boolean }): TeachingProfile {
  return {
    version: 1,
    candidate_id: candidate.id,
    school_id: candidate.school_id,
    generated_at: new Date().toISOString(),
    status: 'failed',
    error,
    overall: { score: null, counted_weight: 0 },
    summary: '',
    strengths: [],
    improvements: [],
    factors: [],
    relevancy: [],
    measured: measuredFrom(candidate, results, null),
    observations: { delivery_enabled: settings.delivery, appearance_enabled: settings.appearance, video_analyzed: false },
  };
}

const inflight = new Map<string, Promise<TeachingProfile>>();

export function isGeneratingProfile(schoolId: string, candidateId: string): boolean {
  return inflight.has(`${schoolId}|${candidateId}`);
}

/** Writes (or rewrites) the profile for one candidate. Safe to call twice at once. */
export function generateTeachingProfile(schoolId: string, candidateId: string): Promise<TeachingProfile> {
  const key = `${schoolId}|${candidateId}`;
  const running = inflight.get(key);
  if (running) return running;
  const job = writeProfile(schoolId, candidateId).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function writeProfile(schoolId: string, candidateId: string): Promise<TeachingProfile> {
  const candidate = db.getCandidateById(schoolId, candidateId);
  if (!candidate) throw new Error('Candidate not found');
  const school = db.getSchoolById(schoolId);
  const settings = reportSettingsOf(school?.report_settings);
  const results = db.getStageResultsByCandidate(schoolId, candidateId);

  try {
    if (!apiKey()) {
      const failed = failedProfile(candidate, results, 'AI scoring is not configured on this server.', settings);
      return db.saveTeachingProfile(failed);
    }

    const written = stage(results, 'written_theory');
    const demo = stage(results, 'micro_teaching_demo');
    const scenario = stage(results, 'situational_scenario');
    const policy = stage(results, 'hr_policy_briefing');
    const pack = findActivePack(schoolId, candidate.applied_subject, candidate.applied_segment);

    const lessonPlan = lessonPlanText(written?.written_submission);
    const demoTranscript = demo?.transcript || '';
    const scenarioTranscript = scenario?.transcript || '';
    const resumeText = candidate.resume_text || '';
    const policyText = [policy?.transcript, policy?.written_submission].filter(Boolean).join('\n');
    const marks = parseMcqMarks(written?.written_submission);
    const mcqBlock = (written?.written_submission || '').split('--- LESSON PLAN ---')[0].replace(/^MCQ TEST\s*/, '').trim();

    // 1. What they wrote and said
    const prompt = buildTextPrompt({
      candidateName: candidate.name,
      subject: candidate.applied_subject,
      segment: candidate.applied_segment,
      board: school?.curriculum_guidelines?.board,
      qualification: candidate.qualification,
      experience: candidate.experience_band,
      lessonPrompt: pack?.lesson_prompt,
      lessonPlan,
      demoPrompt: pack?.demo_prompt,
      demoTranscript,
      scenarioPrompt: pack?.scenario_prompt,
      scenarioTranscript,
      policyAcknowledgement: policyText,
      resumeText,
      mcq: marks,
      mcqBlock,
    });
    const textReply = await askModel([{ text: prompt }], 'profile:text');
    const parsed = parseTextReply(textReply.text);
    if (!parsed) {
      return db.saveTeachingProfile(failedProfile(candidate, results, 'The AI reply could not be read. Try again.', settings));
    }

    // 2. What they looked and sounded like on video
    let videoRaw: Record<string, RawFactor> = {};
    let videoAnalyzed = false;
    const mediaUrl = demo?.media_url || scenario?.media_url;
    if (mediaUrl) {
      const prepared = await prepareMediaPart(mediaUrl).catch(() => null);
      if (prepared) {
        try {
          const videoPrompt = buildVideoPrompt({
            subject: candidate.applied_subject,
            segment: candidate.applied_segment,
            delivery: settings.delivery,
            appearance: settings.appearance,
          });
          const reply = await askModel([prepared.part, { text: videoPrompt }], 'profile:video');
          const raw = parseVideoReply(reply.text);
          if (raw) {
            videoRaw = raw;
            videoAnalyzed = true;
          }
        } catch (err) {
          console.warn('Teaching profile: video observations unavailable:', err);
        } finally {
          if (prepared.uploadedName) {
            new GoogleGenAI({ apiKey: apiKey() }).files.delete({ name: prepared.uploadedName }).catch(() => {});
          }
        }
      }
    }

    // 3. Check, combine and score
    const answerSources = [lessonPlan, demoTranscript, scenarioTranscript, policyText, mcqBlock].filter(Boolean);
    const sources = { answers: answerSources, cv: resumeText ? [resumeText] : [] };

    const textFactors = buildFactors(textFactorDefs(), parsed.factors, sources, true);
    const videoFactors = buildFactors(videoFactorDefs(settings), videoRaw, sources, videoAnalyzed);

    const misconduct = misconductReasonFor(results, [lessonPlan, demoTranscript, scenarioTranscript]);
    const factors: ProfileFactor[] = applyMisconduct([...textFactors, ...videoFactors], misconduct);
    const overall = computeOverall(factors, misconduct);

    const questions = [
      { id: 'lesson', question: pack?.lesson_prompt || 'Lesson plan task' },
      { id: 'demo', question: pack?.demo_prompt || 'Teaching demonstration task' },
      { id: 'scenario', question: pack?.scenario_prompt || 'Classroom scenario' },
    ];
    const submitted: Record<string, string> = { lesson: lessonPlan, demo: demoTranscript, scenario: scenarioTranscript };

    const profile: TeachingProfile = {
      version: 1,
      candidate_id: candidate.id,
      school_id: candidate.school_id,
      generated_at: new Date().toISOString(),
      status: videoAnalyzed || !mediaUrl ? 'ready' : 'partial',
      model: textReply.model,
      overall,
      summary: parsed.summary,
      strengths: parsed.strengths,
      improvements: parsed.improvements,
      factors,
      relevancy: questions.map((q) => ({
        ...q,
        score: submitted[q.id].trim() ? (parsed.relevancy[q.id] ?? null) : null,
      })),
      measured: measuredFrom(candidate, results, lessonPlan ? wordCount(lessonPlan) : null),
      observations: { delivery_enabled: settings.delivery, appearance_enabled: settings.appearance, video_analyzed: videoAnalyzed },
    };
    return db.saveTeachingProfile(profile);
  } catch (err) {
    console.error('Teaching profile failed:', err);
    const message = err instanceof Error ? err.message : 'The profile could not be written.';
    return db.saveTeachingProfile(failedProfile(candidate, results, message.slice(0, 200), settings));
  }
}

/** True when every scored stage has been submitted and the AI has finished with it. */
export function scoredStagesFinished(results: StageResult[]): boolean {
  return SCORED_STAGE_KEYS.every((key) => {
    const r = results.find((x) => x.stage_key === key);
    return !!r && r.scoring_status !== 'pending';
  });
}

/** Called after a stage is scored; writes the profile once, when the last scored stage is done. */
export async function maybeGenerateTeachingProfile(schoolId: string, candidateId: string): Promise<void> {
  try {
    const results = db.getStageResultsByCandidate(schoolId, candidateId);
    if (!scoredStagesFinished(results)) return;
    const existing = db.getTeachingProfile(schoolId, candidateId);
    const newest = Math.max(...results.map((r) => Date.parse(r.completed_at) || 0));
    if (existing && existing.status !== 'failed' && Date.parse(existing.generated_at) >= newest) return;
    await generateTeachingProfile(schoolId, candidateId);
  } catch (err) {
    console.error('Teaching profile trigger failed:', err);
  }
}
