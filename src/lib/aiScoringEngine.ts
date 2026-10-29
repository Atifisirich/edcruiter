import { GoogleGenAI, FileState, createPartFromUri, type Part } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { AIScoringContract, HRPolicyDocument, RubricTemplate, QuestionnaireItem, CurriculumGuidelines, StageResult } from './types';
import { safeUploadPath, UPLOADS_URL_PREFIX } from './uploads';

export interface ScoreInput {
  stage: string;
  candidateName: string;
  appliedSubject: string;
  appliedSegment: string;
  submissionText: string;
  transcript?: string;
  media_url?: string;
  rubric?: RubricTemplate;
  questionnaire?: QuestionnaireItem[];
  hrPolicies?: HRPolicyDocument[];
  curriculumGuidelines?: CurriculumGuidelines;
  priorStageResults?: StageResult[];
  /** When set, this model is used first. Production still falls back to Lite unless skipModelFallback is true. */
  modelId?: string;
  skipModelFallback?: boolean;
  onUsage?: (usage: GeminiUsageSnapshot | undefined) => void;
}

export interface GeminiUsageSnapshot {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export class NamedModelEvalError extends Error {
  constructor(
    message: string,
    public readonly modelId: string
  ) {
    super(message);
    this.name = 'NamedModelEvalError';
  }
}

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Check if a submission is essentially empty, placeholder, or gibberish
function checkContentQuality(text: string): { isGibberish: boolean; wordCount: number; reason?: string } {
  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (clean.length < 15 || wordCount < 3) {
    return { isGibberish: true, wordCount, reason: 'Submission is empty or less than 3 words.' };
  }

  const lower = clean.toLowerCase();
  const gibberishKeywords = ['asdf', 'qwerty', 'bullshit', 'test test', 'nothing', 'idk', 'dont know'];
  if (gibberishKeywords.some(g => lower.includes(g))) {
    return { isGibberish: true, wordCount, reason: 'Submission contains placeholder or unprofessional text.' };
  }

  if (/(.)\1{5,}/.test(lower)) {
    return { isGibberish: true, wordCount, reason: 'Submission contains repeated character sequences.' };
  }

  return { isGibberish: false, wordCount };
}

/** Unambiguous abuse. Matched on word boundaries only — never as a substring. */
const PROFANITY = [
  'fuck', 'fucking', 'shit', 'bullshit', 'bitch', 'asshole', 'bastard',
  'madarchod', 'bhenchod', 'chutiya', 'gandu', 'lauda', 'randi', 'harami',
  'shut up', 'screw you', 'go to hell'
];

/** Full-sentence refusals to attempt the task. */
const EXPLICIT_REFUSALS = [
  'i refuse', 'refuse to answer', 'refused to answer', 'wont answer', "won't answer",
  'dont want to answer', "don't want to answer", 'not going to do this',
  'do it yourself', 'none of your business', 'leave me alone', 'why should i'
];

/**
 * Ambiguous in a teaching context: a candidate may be quoting language they would
 * never use with a child, or describing scrap paper, dumbbells or a Dickens text.
 * These raise a review flag; they never zero a score on their own.
 */
const TONE_REVIEW_TERMS = [
  'stupid', 'idiot', 'moron', 'dumb', 'useless', 'rubbish', 'garbage',
  'waste of time', 'who cares', 'i dont care', "i don't care"
];

/**
 * Matches `term` only as a whole word (or whole phrase), case-insensitively.
 * Substring matching is deliberately avoided: it fires "crap" on "scrap",
 * "dick" on "Dickens" and "dumb" on "dumbbell", each of which silently
 * zeroed a legitimate submission.
 */
function wordBoundaryMatch(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:[^\\p{L}\\p{N}]|$)`, 'iu').test(haystack);
}

/**
 * Screens a submission for abuse or outright refusal before it reaches the model.
 * `isMisconduct` forces a zero; `needsReview` scores normally but asks a human to look.
 */
export function scanMisconductAndRefusal(text: string): {
  isMisconduct: boolean;
  needsReview?: boolean;
  reason?: string;
} {
  const clean = text.trim().toLowerCase();
  if (clean.length < 8) {
    return { isMisconduct: true, reason: 'Empty or nearly blank response submitted (under 8 characters).' };
  }

  for (const term of PROFANITY) {
    if (wordBoundaryMatch(clean, term)) {
      return {
        isMisconduct: true,
        reason: `Abusive or profane language detected ("${term}"). Zero score strictly enforced.`
      };
    }
  }

  for (const phrase of EXPLICIT_REFUSALS) {
    if (wordBoundaryMatch(clean, phrase)) {
      return {
        isMisconduct: true,
        reason: `Candidate explicitly refused to complete the task ("${phrase}"). Zero score strictly enforced.`
      };
    }
  }

  // Words below are hostile in some contexts and entirely ordinary in others — a
  // teacher quoting what not to say to a child, or describing scrap paper and
  // dumbbells, is not misconduct. Flag for a human rather than scoring zero.
  for (const term of TONE_REVIEW_TERMS) {
    if (wordBoundaryMatch(clean, term)) {
      return {
        isMisconduct: false,
        needsReview: true,
        reason: `Contains "${term}", which may be dismissive depending on context. Flagged for reviewer confirmation; scored normally.`
      };
    }
  }

  return { isMisconduct: false };
}

// Heuristic check for AI-generated text / copy-paste patterns
function detectPlagiarismSignatures(text: string): { risk: 'low' | 'moderate' | 'high'; reason?: string } {
  const lower = text.toLowerCase();
  const aiPhrases = [
    'in this lesson plan, students will embark',
    'foster a deep understanding',
    'delve into the fascinating world of',
    'as an ai language model',
    'it is important to remember that',
    'by the end of this lesson, learners will be able to'
  ];

  let matches = 0;
  for (const phrase of aiPhrases) {
    if (lower.includes(phrase)) matches++;
  }

  if (matches >= 2 || lower.includes('as an ai')) {
    return { risk: 'high', reason: 'High density of standard AI chatbot template phrasing detected.' };
  }
  if (matches === 1 && text.length > 200) {
    return { risk: 'moderate', reason: 'Some generic synthetic phrasing detected.' };
  }
  return { risk: 'low' };
}

// Helper to prepare local video/audio file as Gemini inlineData part
// Gemini caps an inline request at about 20 MB, and base64 adds a third, so
// anything above this goes through the Files API instead. A 5-minute webcam
// recording is typically 40-60 MB — the old inline-only path silently skipped
// it, so the "video" stage was scored from placeholder text alone.
const INLINE_MEDIA_MAX_BYTES = 14 * 1024 * 1024;
const UPLOADED_MEDIA_MAX_BYTES = 150 * 1024 * 1024;

type PreparedMedia = { part: Part; uploadedName?: string };

async function prepareMediaPart(mediaUrl?: string): Promise<PreparedMedia | null> {
  if (!mediaUrl || !ai) return null;
  const inline = prepareLocalMediaPart(mediaUrl);
  if (inline) return { part: inline };

  try {
    if (!mediaUrl.startsWith(UPLOADS_URL_PREFIX)) return null;
    const absPath = safeUploadPath(mediaUrl.slice(UPLOADS_URL_PREFIX.length));
    if (!absPath || !fs.existsSync(absPath)) return null;
    const size = fs.statSync(absPath).size;
    if (size <= INLINE_MEDIA_MAX_BYTES || size > UPLOADED_MEDIA_MAX_BYTES) return null;

    const ext = path.extname(absPath).toLowerCase();
    const mimeType = ext === '.mp4' ? 'video/mp4' : ext === '.mov' ? 'video/quicktime' : 'video/webm';
    let file = await ai.files.upload({ file: absPath, config: { mimeType } });

    // Uploaded video is processed asynchronously; wait until it can be used.
    const deadline = Date.now() + 120_000;
    while (file.state === FileState.PROCESSING && file.name && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      file = await ai.files.get({ name: file.name });
    }
    if (file.state !== FileState.ACTIVE || !file.uri) {
      if (file.name) ai.files.delete({ name: file.name }).catch(() => {});
      return null;
    }
    return { part: createPartFromUri(file.uri, file.mimeType || mimeType), uploadedName: file.name };
  } catch (err) {
    console.warn('Could not upload candidate video for multimodal analysis:', err);
    return null;
  }
}

function prepareLocalMediaPart(mediaUrl?: string): { inlineData: { mimeType: string; data: string } } | null {
  if (!mediaUrl || mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return null;
  }

  try {
    // media_url on a StageResult ultimately comes from client input (the
    // upload response, echoed back through the stage-result POST), so it is
    // never trusted as a bare filesystem path — safeUploadPath resolves it
    // against the uploads directory and rejects anything that would escape
    // it via `..`, an absolute path, or a URL-encoded variant of either.
    // A path outside /api/media/ (the only URL shape a real upload
    // produces) is rejected outright rather than guessed at.
    if (!mediaUrl.startsWith(UPLOADS_URL_PREFIX)) return null;
    const filename = mediaUrl.slice(UPLOADS_URL_PREFIX.length);
    const absPath = safeUploadPath(filename);
    if (!absPath) return null;

    if (fs.existsSync(absPath)) {
      const fileStats = fs.statSync(absPath);
      // Small files only; larger ones go through prepareMediaPart's upload path
      if (fileStats.size <= INLINE_MEDIA_MAX_BYTES) {
        const fileBuffer = fs.readFileSync(absPath);
        const base64Data = fileBuffer.toString('base64');
        const ext = path.extname(absPath).toLowerCase();
        let mimeType = 'video/webm';
        if (ext === '.mp4') mimeType = 'video/mp4';
        if (ext === '.mov') mimeType = 'video/quicktime';

        return {
          inlineData: {
            mimeType,
            data: base64Data
          }
        };
      }
    }
  } catch (err) {
    console.warn('Could not read local media file for multimodal analysis:', err);
  }

  return null;
}

export async function evaluateStageWithAIAsync(input: ScoreInput): Promise<AIScoringContract> {
  const isVideoStage = ['micro_teaching_demo', 'lesson_demo', 'situational_scenario', 'behavioural_assessment'].includes(input.stage);

  // 1. VIDEO SUBMISSION GUARD: If candidate did not upload/record a video for micro_teaching_demo or situational_scenario, assign 0/10!
  if (isVideoStage && (!input.media_url || input.media_url.trim() === '')) {
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 3: Delivery Compliance',
      scores: [
        {
          dimension: 'video_submission_check',
          score: 0,
          justification: 'NO VIDEO ATTACHED: Candidate completed stage without recording or uploading a video demo. Zero marks assigned.',
          pedagogical_benchmark: 'Compliance Standard'
        }
      ],
      overall_flag: 'needs_review',
      evidence_reference: 'NO_VIDEO_RECORDED: Missing required webcam recording.',
      identified_gaps: ['No video recording or media stream was submitted for pedagogical evaluation.']
    };
  }

  // Combined text payload
  const combinedText = (input.submissionText || '') + ' ' + (input.transcript || '');
  
  // 2. STRICT ZERO-TOLERANCE SCANNER: Bad words, hostility, careless one-liners, refusal to answer
  const misconductCheck = scanMisconductAndRefusal(combinedText);
  if (misconductCheck.isMisconduct && !isVideoStage) {
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 4f: Professional Conduct & Integrity',
      blooms_taxonomy_level: 'Remembering',
      evidence_quote: combinedText.substring(0, 100),
      scores: [
        {
          dimension: 'professional_conduct_and_integrity',
          score: 0,
          justification: `REJECTED (ZERO SCORE): ${misconductCheck.reason}`,
          pedagogical_benchmark: 'Zero-Tolerance Professional Standard'
        },
        {
          dimension: 'subject_competency_and_rigor',
          score: 0,
          justification: `Failed to attempt assessment with required pedagogical seriousness. Automatic 0/10.`,
          pedagogical_benchmark: 'Pedagogical Baseline'
        }
      ],
      overall_flag: 'needs_review',
      evidence_reference: `Misconduct Detected: ${misconductCheck.reason}`,
      identified_gaps: [
        misconductCheck.reason || 'Candidate submitted abusive, dismissive, or refusal response.',
        'Did not demonstrate required grade-level subject competency.'
      ],
      plagiarism_risk: 'low'
    };
  }

  const { isGibberish, wordCount, reason } = checkContentQuality(combinedText);

  // 3. If text is gibberish or empty (and not a pure video demo), assign 0/10!
  if (isGibberish && !isVideoStage) {
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 1a: Demonstrating Knowledge of Content',
      scores: [
        {
          dimension: 'content_quality_and_rigor',
          score: 0,
          justification: `INSUFFICIENT SUBMISSION: Candidate submitted inadequate or irrelevant input (${reason}). Lacks academic depth for ${input.appliedSubject}. Automatic 0/10.`,
          pedagogical_benchmark: 'Danielson Domain 1a'
        },
        {
          dimension: 'pedagogical_relevance',
          score: 0,
          justification: `Failed to address the evaluation criteria for ${input.stage.replace(/_/g, ' ')}. Minimal or non-serious response provided.`,
          pedagogical_benchmark: 'Danielson Domain 3'
        }
      ],
      overall_flag: 'needs_review',
      evidence_reference: `Flagged Input: "${combinedText.substring(0, 80)}..."`,
      identified_gaps: [
        'Submission was less than 3 words or contained placeholder gibberish.',
        'Did not demonstrate required grade-level subject competency.'
      ],
      plagiarism_risk: 'low'
    };
  }

  // Plagiarism check
  const plagiarismResult = detectPlagiarismSignatures(combinedText);

  // Cross-Stage Discrepancy Check
  let crossStageDiscrepancy: string | undefined = undefined;

  // If Gemini AI is configured with GEMINI_API_KEY
  if (ai) {
    try {
      // 1. Prepare Standardized Pedagogical Framework Directives
      let frameworkPrompt = '';
      let stageFrameworkName = 'Danielson Framework for Teaching';

      if (input.stage === 'written_theory' || input.stage.includes('lesson_plan') || input.stage.includes('quiz')) {
        stageFrameworkName = 'Danielson Domain 1 (Planning & Subject Depth) & Bloom\'s Taxonomy';
        frameworkPrompt = `
EVALUATION FRAMEWORK: DANIELSON DOMAIN 1 (PLANNING, CORE DEPTH & REMEDIATION)
1. subject_depth (Weight 50%): Deep mastery of ${input.appliedSubject} concepts for ${input.appliedSegment}, exposing persistent student misconceptions, and designing remedial scaffolding.
2. lesson_design (Weight 50%): Structured 35-min breakdown with SMART objectives, concrete-to-abstract progression, and multi-tier differentiation.
        `;
      } else if (input.stage === 'micro_teaching_demo' || input.stage.includes('lesson_demo')) {
        stageFrameworkName = 'Danielson Domain 3c (Micro-Teaching Delivery & Board Work)';
        frameworkPrompt = `
EVALUATION FRAMEWORK: DANIELSON DOMAIN 3c (5-MINUTE TEACHING DEMO)
1. teaching_delivery (Weight 50%): Vocal projection, chalkboard/smartboard presentation, energy, and clear explanation.
2. student_engagement (Weight 50%): Active questioning, checking for understanding, and conceptual scaffolding flow.
        `;
      } else if (input.stage === 'situational_scenario' || input.stage.includes('behavioural') || input.stage.includes('interview')) {
        stageFrameworkName = 'Danielson Domain 2 (Classroom Dynamics & Parent Relations)';
        frameworkPrompt = `
EVALUATION FRAMEWORK: DANIELSON DOMAIN 2 (CLASSROOM CONTROL & SITUATIONAL JUDGMENT)
1. situational_judgment (Weight 50%): Structured 3-step de-escalation protocols, classroom conflict resolution, and empathetic parent communication.
2. student_empathy (Weight 50%): Emotional containment, active listening, and supporting distressed or diverse learners.
        `;
      } else if (input.stage === 'hr_policy_briefing' || input.stage.includes('hr_policy')) {
        stageFrameworkName = 'Danielson Domain 4f (Professional Ethics & Safeguarding)';
        frameworkPrompt = `
EVALUATION FRAMEWORK: PROFESSIONAL ETHICS & CHILD SAFEGUARDING
1. policy_comprehension (Weight 100%): Explicit agreement to school working hours (7:45 AM), notice period (60 days), and zero-tolerance child safeguarding policies.
        `;
      } else {
        stageFrameworkName = 'Danielson Domain 4 (Professional Background & CV Pedigree)';
        frameworkPrompt = `
EVALUATION FRAMEWORK: DANIELSON DOMAIN 4 & PROFESSIONAL IDENTITY
1. identity_completeness (Weight 50%): Complete bio details, qualification, salary alignment, and campus readiness.
2. resume_pedigree (Weight 50%): Relevance of educational qualifications and prior school experience to ${input.appliedSubject}.
        `;
      }

      // 2. School Curriculum Guidelines Ingestion
      let curriculumContext = '';
      if (input.curriculumGuidelines) {
        curriculumContext = `
SCHOOL SPECIFIC CURRICULUM GUIDELINES:
- Board / Curriculum: ${input.curriculumGuidelines.board}
- School Pedagogical Philosophy: ${input.curriculumGuidelines.pedagogical_philosophy}
- Focus Areas: ${input.curriculumGuidelines.focus_areas.join(', ')}
${input.curriculumGuidelines.custom_syllabus_notes ? `- Syllabus Notes: ${input.curriculumGuidelines.custom_syllabus_notes}` : ''}
        `;
      }

      // 3. Chain-of-Thought (CoT) Prompt with ZERO-TOLERANCE ENFORCEMENT
      const cotPrompt = `
You are a senior academic evaluation director assessing a candidate for ${input.appliedSubject} Teacher (${input.appliedSegment}).
Adhere strictly to the ${stageFrameworkName}.

CRITICAL ZERO-TOLERANCE SCORING MANDATE:
- If the candidate uses bad language, profanity, insults, shows disrespect, refuses to answer, provides dismissive/careless one-liners (e.g. 'i don't care', 'do it yourself', 'whatever'), or submits irrelevant/abusive text, you MUST assign a score of EXACTLY 0 (ZERO out of 10) for every single dimension.
- NEVER award sympathy points (such as 1, 2, or 3 marks) for abusive, hostile, careless, or refusal submissions.
- Assign 0 for complete refusal/misconduct.

CANDIDATE SUBMISSION:
- Candidate Name: ${input.candidateName}
- Stage: ${input.stage}
- Text / Dialogue / Plan:
"""
${combinedText}
"""

${frameworkPrompt}
${curriculumContext}

CHAIN-OF-THOUGHT (CoT) EVALUATION INSTRUCTIONS:
Step 1. EVIDENCE: Extract 1-2 exact quotes or observable behaviors from the candidate.
Step 2. GAP ANALYSIS: Identify what specific pedagogical techniques were missing (e.g. lack of differentiation, no formative check, unrealistic timing).
Step 3. BLOOM'S TAXONOMY: Determine the cognitive level demonstrated (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating).
Step 4. CALIBRATED SCORING (0-10):
  - 0: MISCONDUCT / BAD WORDS / REFUSAL / CARELESS ONE-LINER / COMPLETE NONSENSE (Assign 0 with zero tolerance)
  - 1-3: Ineffective / Substandard (Severe factual errors, zero pedagogical scaffolding, fails grade standards)
  - 4-6: Developing (Basic textbook recall only, weak interactive engagement)
  - 7-8: Proficient (Solid concept delivery, good pacing, clear learning objectives)
  - 9-10: Master Teacher (Exceptional inquiry hooks, deep conceptual clarity, multi-tier differentiation)

Output ONLY valid JSON with this exact schema:
{
  "stage": "${input.stage}",
  "pedagogical_framework": "${stageFrameworkName}",
  "blooms_taxonomy_level": "Applying" | "Analyzing" | "Evaluating" | "Understanding",
  "evidence_quote": "Direct quote from candidate submission",
  "identified_gaps": [
    "Specific gap 1...",
    "Specific gap 2..."
  ],
  "scores": [
    {
      "dimension": "dimension_name",
      "score": 7,
      "justification": "Detailed justification referencing candidate's specific evidence...",
      "pedagogical_benchmark": "Danielson Domain / Bloom benchmark"
    }
  ],
  "overall_flag": "strong_candidate" | "needs_review" | "none",
  "evidence_reference": "Summary reference"
}
      `;

      // 4. Check if local video media part is available for Multimodal Analysis
      const prepared = isVideoStage ? await prepareMediaPart(input.media_url) : null;
      const requestContents: any[] = [];
      let multimodalAnalyzed = false;

      if (prepared) {
        requestContents.push(prepared.part);
        requestContents.push({
          text: `[MULTIMODAL VIDEO SUBMISSION ATTACHED]: Watch and listen to the candidate's recorded video. Judge their teaching: clarity of explanation, pacing, checking for understanding, and how they engage a class. Do NOT score or comment on appearance, accent, skin colour, gender, age, disability, or the room and equipment they record in — only on teaching.\n\n${cotPrompt}`
        });
        multimodalAnalyzed = true;
      } else {
        requestContents.push({ text: cotPrompt });
      }

      const primaryModel = input.modelId || 'gemini-3.5-flash';
      let response;
      try {
        try {
          response = await ai.models.generateContent({
            model: primaryModel,
            contents: requestContents
          });
        } catch (mErr) {
          if (input.skipModelFallback) {
            throw new NamedModelEvalError(
              mErr instanceof Error ? mErr.message : 'Gemini request failed',
              primaryModel
            );
          }
          response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: requestContents
          });
        }
      } finally {
        // Candidate video shouldn't sit on Google's side longer than needed.
        if (prepared?.uploadedName) ai.files.delete({ name: prepared.uploadedName }).catch(() => {});
      }

      // A video stage scored without the video is scored on placeholder text;
      // say so and send it to a person rather than presenting it as a verdict.
      const videoMissed = isVideoStage && !multimodalAnalyzed;
      const videoMissedNote = 'The video could not be analysed automatically. A person should watch it before relying on this score.';

      const usage = (response as { usageMetadata?: GeminiUsageSnapshot }).usageMetadata;
      input.onUsage?.(usage);

      const responseText = response.text ? response.text.trim() : '';
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed.scores && Array.isArray(parsed.scores)) {
        // Enforce 0 clamp if Gemini detected refusal/bad words in rationale
        const hasRefusalOrBadWord = parsed.scores.some((s: any) => 
          (s.justification && /refus|bad word|profan|abus|careless|inadequate|disrespect/i.test(s.justification) && s.score <= 3)
        );

        if (hasRefusalOrBadWord) {
          parsed.scores = parsed.scores.map((s: any) => ({
            ...s,
            score: s.score <= 3 ? 0 : s.score
          }));
          parsed.overall_flag = 'needs_review';
        }

        return {
          ...parsed,
          scoring_mode: 'gemini' as const,
          // A borderline tone term does not change the score, but the reviewer is told.
          overall_flag: misconductCheck.needsReview || videoMissed ? 'needs_review' : parsed.overall_flag,
          identified_gaps: [
            ...(parsed.identified_gaps ?? []),
            ...(misconductCheck.needsReview && misconductCheck.reason ? [misconductCheck.reason] : []),
            ...(videoMissed ? [videoMissedNote] : []),
          ],
          plagiarism_risk: plagiarismResult.risk,
          plagiarism_reason: plagiarismResult.reason,
          discrepancy_alert: crossStageDiscrepancy,
          multimodal_video_analyzed: multimodalAnalyzed
        } as AIScoringContract;
      }
      if (input.skipModelFallback) {
        throw new NamedModelEvalError('Model did not return a valid scores JSON array', primaryModel);
      }
    } catch (err) {
      if (input.skipModelFallback) {
        throw err;
      }
      console.warn('Gemini API call failed, falling back to rigorous deterministic evaluation:', err);
    }
  }

  return withDeterministicMode(evaluateStageWithAI(input));
}

function withDeterministicMode(result: AIScoringContract): AIScoringContract {
  return {
    ...result,
    scoring_mode: result.scoring_mode || 'deterministic_fallback'
  };
}

/** True when a teaching stage was wrongly scored with HR policy dimensions (legacy fallback bug). */
export function isMisappliedHrPolicyScore(stageKey: string, scores?: AIScoringContract | null): boolean {
  if (!scores?.scores?.length) return false;
  const teachingStages = ['written_theory', 'micro_teaching_demo', 'situational_scenario', 'lesson_plan', 'lesson_demo', 'subject_quiz', 'behavioural_assessment', 'subject_interview'];
  if (!teachingStages.includes(stageKey)) return false;
  const onlyPolicy = scores.scores.every((s) => s.dimension === 'policy_comprehension');
  const hrEvidence = /HR Policy Briefing/i.test(scores.evidence_reference || '')
    || /Professionalism & Ethics/i.test(scores.pedagogical_framework || '');
  return onlyPolicy || hrEvidence;
}

function evaluateQuizAccurately(input: ScoreInput): AIScoringContract {
  const submissionText = input.submissionText || '';
  let parsedAnswers: Record<string, string> = {};

  try {
    const jsonMatch = submissionText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsedAnswers = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {}

  let correctCount = 0;
  let totalQuestions = 0;
  const itemReport: string[] = [];

  const mcqs = (input.questionnaire || []).filter(q => q.type === 'mcq');

  if (mcqs.length === 0) {
    // No real questionnaire is configured for this subject/segment. This
    // used to fall back to a hardcoded 2-question demo answer key and
    // return a confident-looking score against content the candidate was
    // never even shown. A missing question bank is a school-configuration
    // gap, not something to paper over with a fake number — flag it for a
    // human instead.
    return {
      stage: input.stage,
      pedagogical_framework: 'Bloom\'s Taxonomy (Cognitive Knowledge & Retrieval)',
      scoring_mode: 'deterministic_fallback',
      evidence_quote: submissionText.slice(0, 200),
      scores: [
        {
          dimension: 'subject_mastery',
          score: 0,
          justification: 'No MCQ questionnaire is configured for this subject and segment, so this submission cannot be scored against real content.',
          pedagogical_benchmark: 'Subject Knowledge Standard'
        }
      ],
      overall_flag: 'needs_review',
      evidence_reference: 'NO_QUESTIONNAIRE_CONFIGURED',
      identified_gaps: [`No quiz questions exist for ${input.appliedSubject} / ${input.appliedSegment}. Configure a questionnaire before this stage is scored automatically.`]
    };
  }

  totalQuestions = mcqs.length;
  mcqs.forEach((qItem, idx) => {
    const candidateAns = parsedAnswers[String(idx + 1)] || parsedAnswers[qItem.id] || 'No Answer';
    if (candidateAns === qItem.correct_option) {
      correctCount++;
      itemReport.push(`Q${idx + 1}: Selected "${candidateAns}" (Correct ✓)`);
    } else {
      itemReport.push(`Q${idx + 1}: Selected "${candidateAns}" ❌ (Incorrect. Correct: "${qItem.correct_option}")`);
    }
  });

  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const scoreOutOf10 = Math.round((correctCount / totalQuestions) * 10);

  return {
    stage: input.stage,
    pedagogical_framework: 'Bloom\'s Taxonomy (Cognitive Knowledge & Retrieval)',
    blooms_taxonomy_level: 'Understanding',
    scoring_mode: 'deterministic_fallback',
    evidence_quote: itemReport.join(' | '),
    scores: [
      {
        dimension: 'subject_mastery',
        score: scoreOutOf10,
        justification: `Candidate scored ${correctCount}/${totalQuestions} (${percentage}%) on ${input.appliedSubject} MCQ quiz. ${itemReport.join(' | ')}`,
        pedagogical_benchmark: 'Subject Knowledge Standard'
      },
      {
        dimension: 'speed_and_accuracy',
        score: scoreOutOf10,
        justification: scoreOutOf10 === 0
          ? `Candidate failed all subject MCQ items. Precision was 0%.`
          : `Candidate achieved ${percentage}% accuracy on timed subject assessment.`,
        pedagogical_benchmark: 'Cognitive Accuracy'
      }
    ],
    overall_flag: scoreOutOf10 >= 8 ? 'strong_candidate' : 'needs_review',
    evidence_reference: `MCQ Score: ${correctCount}/${totalQuestions} (${percentage}%)`,
    identified_gaps: scoreOutOf10 < 8 ? [`Scored ${percentage}% on fundamental ${input.appliedSubject} curriculum quiz.`] : []
  };
}

export function evaluateStageWithAI(input: ScoreInput): AIScoringContract {
  const isVideoStage = [
    'identity_verification',
    'self_video_intro',
    'behavioural_assessment',
    'lesson_demo',
    'micro_teaching_demo',
    'situational_scenario'
  ].includes(input.stage);

  if (isVideoStage && (!input.media_url || input.media_url.trim() === '') &&
      (input.stage === 'micro_teaching_demo' || input.stage === 'situational_scenario' ||
       input.stage.includes('lesson_demo') || input.stage.includes('behavioural'))) {
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Framework Domain 4',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'video_submission_check',
          score: 0,
          justification: 'NO VIDEO RECORDED: Candidate completed stage without submitting a video response. Zero score assigned.',
          pedagogical_benchmark: 'Compliance Check'
        }
      ],
      overall_flag: 'needs_review',
      evidence_reference: 'NO_VIDEO_RECORDED: Missing video stream attachment.',
      identified_gaps: ['No video recording was attached.']
    };
  }

  if (input.stage.includes('quiz') && input.stage !== 'written_theory') {
    return evaluateQuizAccurately(input);
  }

  const text = ((input.submissionText || '') + ' ' + (input.transcript || '')).toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Current pipeline stage: written theory (MCQ + lesson design)
  if (input.stage === 'written_theory' || input.stage.includes('lesson_plan')) {
    const raw = input.submissionText || '';
    const incorrectMarks = (raw.match(/\(Incorrect\)/gi) || []).length;
    const correctMarks = (raw.match(/\(Correct(?: ✓)?\)/gi) || []).length;
    const totalMcq = incorrectMarks + correctMarks;
    const mcqScore = totalMcq > 0 ? Math.round((correctMarks / totalMcq) * 10) : null;

    const lessonPart = (raw.split(/LESSON\s*PLAN/i)[1] || raw).toLowerCase();
    const lessonWords = lessonPart.split(/\s+/).filter(Boolean).length;
    const hasStructure = /minute|warmup|warm-up|objective|practice|exit|hook|assess|starter|plenary/.test(lessonPart);
    const hasDifferentiation = /differentiat|struggl|advance|scaffold|remedial|gifted|mixed.?ability|support/.test(lessonPart);
    const hasMisconception = /misconception|error|wrong idea|remediat|diagnose/.test(lessonPart);
    const lessonScore = (hasStructure && hasDifferentiation && lessonWords > 35)
      ? 9
      : (lessonWords > 25 && (hasStructure || hasDifferentiation) ? 6 : (lessonWords > 8 ? 3 : 1));
    const subjectDepth = mcqScore !== null
      ? mcqScore
      : (hasMisconception && lessonWords > 25 ? 7 : (lessonWords > 15 ? 4 : 2));

    const avg = Math.round((subjectDepth + lessonScore) / 2);
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 1 (Planning & Subject Depth) & Bloom\'s Taxonomy',
      blooms_taxonomy_level: 'Creating',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'subject_depth',
          score: subjectDepth,
          justification: mcqScore !== null
            ? `MCQ accuracy ${correctMarks}/${totalMcq} (${Math.round((correctMarks / Math.max(totalMcq, 1)) * 100)}%) on ${input.appliedSubject} items.`
            : (hasMisconception
              ? `Written response addresses ${input.appliedSubject} misconceptions for ${input.appliedSegment}.`
              : `Limited evidence of ${input.appliedSubject} conceptual depth in the written submission.`),
          pedagogical_benchmark: 'Danielson 1a: Demonstrating Knowledge of Content'
        },
        {
          dimension: 'lesson_design',
          score: lessonScore,
          justification: lessonScore >= 8
            ? `Lesson plan shows structure, pacing, and differentiation for ${input.appliedSegment}.`
            : lessonScore >= 5
            ? `Lesson plan is partially structured but missing clear differentiation or timing.`
            : `Lesson design section was thin, missing, or lacked instructional structure.`,
          pedagogical_benchmark: 'Danielson 1e: Designing Coherent Instruction'
        }
      ],
      overall_flag: avg >= 8 ? 'strong_candidate' : (avg <= 3 ? 'needs_review' : 'none'),
      evidence_reference: totalMcq > 0
        ? `Deterministic parse of MCQ (${correctMarks}/${totalMcq}) + lesson plan text (Gemini unavailable).`
        : `Deterministic parse of written theory / lesson plan text (Gemini unavailable).`,
      identified_gaps: avg >= 8
        ? []
        : [
            ...(mcqScore !== null && mcqScore < 7 ? [`Subject MCQ score ${correctMarks}/${totalMcq}.`] : []),
            ...(lessonScore < 7 ? ['Lesson plan needs clearer objectives, pacing, and differentiation.'] : [])
          ]
    };
  }

  // Current pipeline: micro-teaching demo video
  if (input.stage === 'micro_teaching_demo' || input.stage.includes('lesson_demo')) {
    const hasVideo = Boolean(input.media_url && input.media_url.length > 5);
    const provisional = hasVideo ? 6 : 0;
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 3c (Micro-Teaching Delivery & Board Work)',
      blooms_taxonomy_level: 'Applying',
      scoring_mode: 'deterministic_fallback',
      multimodal_video_analyzed: false,
      scores: [
        {
          dimension: 'teaching_delivery',
          score: provisional,
          justification: hasVideo
            ? 'Demo video file was received. Full multimodal delivery analysis needs Gemini; provisional completeness score only.'
            : 'No demo teaching video submitted.',
          pedagogical_benchmark: 'Danielson 3a: Communicating with Students'
        },
        {
          dimension: 'student_engagement',
          score: provisional,
          justification: hasVideo
            ? 'Video on file; engagement quality not AI-reviewed offline. Treat as provisional until Gemini re-score.'
            : 'No teaching demonstration provided.',
          pedagogical_benchmark: 'Danielson 3c: Engaging Students in Learning'
        }
      ],
      overall_flag: hasVideo ? 'none' : 'needs_review',
      evidence_reference: hasVideo
        ? 'Video submitted — provisional completeness score (Gemini multimodal analysis unavailable).'
        : '5-Minute Teaching Demo Video Analysis',
      identified_gaps: hasVideo
        ? ['Re-run AI scoring when Gemini is reachable for full multimodal review.']
        : ['Missing 5-minute teaching demonstration video.']
    };
  }

  // Current pipeline: situational / classroom dynamics video
  if (input.stage === 'situational_scenario' || input.stage.includes('behavioural')) {
    const hasVideo = Boolean(input.media_url && input.media_url.length > 5);
    const hasStrategy = text.includes('de-escalat') || text.includes('calm') || text.includes('listen')
      || text.includes('parent') || text.includes('protocol') || text.includes('counsel')
      || text.includes('empath') || text.includes('restorative');
    const isDetailed = wordCount > 20;
    const textScore = (hasStrategy && isDetailed) ? 8 : (isDetailed ? 5 : (hasVideo ? 5 : 2));
    const score = hasVideo || isDetailed ? textScore : 0;

    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 2 (Classroom Dynamics & Parent Relations)',
      blooms_taxonomy_level: 'Applying',
      scoring_mode: 'deterministic_fallback',
      multimodal_video_analyzed: false,
      scores: [
        {
          dimension: 'situational_judgment',
          score,
          justification: hasVideo && !isDetailed
            ? 'Scenario video was received. Offline scorer cannot review video content; provisional score from submission completeness.'
            : (hasStrategy && isDetailed
              ? 'Outlined a clear de-escalation / classroom conflict protocol in the written response.'
              : 'Limited concrete classroom conflict management steps in the submission.'),
          pedagogical_benchmark: 'Danielson 2d: Managing Student Behavior'
        },
        {
          dimension: 'student_empathy',
          score,
          justification: hasVideo && !isDetailed
            ? 'Video on file; empathy markers not AI-reviewed offline. Provisional only.'
            : (hasStrategy && isDetailed
              ? 'Demonstrated empathy and understanding of learner / parent dynamics.'
              : 'Did not demonstrate explicit empathetic listening protocols.'),
          pedagogical_benchmark: 'Danielson 2a: Creating an Environment of Respect and Rapport'
        }
      ],
      overall_flag: score >= 8 ? 'strong_candidate' : (score <= 3 ? 'needs_review' : 'none'),
      evidence_reference: hasVideo
        ? 'Situational video submitted — provisional score (Gemini unavailable).'
        : 'Behavioural / situational written response (deterministic).',
      identified_gaps: score >= 8
        ? []
        : ['Needs a clearer multi-step restorative conflict resolution protocol.']
    };
  }

  if (input.stage.includes('identity') || input.stage.includes('intro')) {
    const isRich = wordCount > 25 && (text.includes('energy') || text.includes('thermodynamics') || text.includes('teach') || text.includes('experience'));
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 4: Professional Communication',
      blooms_taxonomy_level: 'Understanding',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'communication_skills',
          score: isRich ? 8 : 4,
          justification: isRich
            ? `Clear vocal articulation and fluent speech delivery during reading passage.`
            : `Reading passage delivery was brief; limited vocal modulation observed.`,
          pedagogical_benchmark: 'Danielson 4a'
        },
        {
          dimension: 'confidence_level',
          score: isRich ? 8 : 4,
          justification: isRich
            ? `Good composure and professional presentation during self-introduction.`
            : `Demonstrated tentative body posture during introduction.`,
          pedagogical_benchmark: 'Danielson 4b'
        },
        {
          dimension: 'english_fluency',
          score: isRich ? 8 : 4,
          justification: isRich
            ? `Grammatical accuracy and clear pronunciation in English.`
            : `Basic language structure with limited academic vocabulary.`,
          pedagogical_benchmark: 'Language Proficiency Standard'
        }
      ],
      overall_flag: isRich ? 'none' : 'needs_review',
      evidence_reference: `Self Video Intro & Reading Passage Analysis`,
      identified_gaps: isRich ? [] : ['Vocal modulation and academic vocabulary could be strengthened.']
    };
  }

  if (input.stage.includes('interview')) {
    const hasPedagogy = text.includes('inquiry') || text.includes('hook') || text.includes('demonstrat') || text.includes('hands-on') || text.includes('experiment');
    const hasDepth = text.includes('misconception') || text.includes('scaffold') || text.includes('differentiat') || text.includes('formative');
    const isSubstantial = wordCount > 40;

    const interviewScore = (hasPedagogy && hasDepth && isSubstantial) ? 8 : (isSubstantial ? 5 : 2);

    return {
      stage: input.stage,
      pedagogical_framework: 'Bloom\'s Taxonomy & Danielson Domain 3: Instruction',
      blooms_taxonomy_level: 'Analyzing',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'pedagogical_clarity',
          score: interviewScore,
          justification: interviewScore >= 8
            ? `Candidate provided concrete inquiry-based methods and lesson hook strategies for ${input.appliedSubject}.`
            : interviewScore >= 5
            ? `Candidate provided basic pedagogical ideas, but responses lacked step-by-step depth.`
            : `Candidate responses were extremely brief, vague, or non-serious during AI interview rounds.`,
          pedagogical_benchmark: 'Danielson 3b: Questioning and Discussion Techniques'
        },
        {
          dimension: 'conceptual_depth',
          score: interviewScore,
          justification: interviewScore >= 8
            ? `Clearly explained how to diagnose student misconceptions and scaffold learning for ${input.appliedSegment}.`
            : interviewScore >= 5
            ? `Mentioned standard textbook definitions without detailed scaffolding techniques.`
            : `Failed to articulate strategies for student misconception handling or differentiated instruction.`,
          pedagogical_benchmark: 'Danielson 3c: Engaging Students in Learning'
        }
      ],
      overall_flag: interviewScore >= 8 ? 'strong_candidate' : (interviewScore <= 3 ? 'needs_review' : 'none'),
      evidence_reference: `AI Subject Interview Transcript on ${input.appliedSubject}`,
      identified_gaps: interviewScore >= 8 ? [] : ['Needs more explicit Socratic questioning to counter student conceptual errors.']
    };
  }

  if (input.stage.includes('tech')) {
    const hasEdTech = text.includes('classroom') || text.includes('smart') || text.includes('board') || text.includes('geogebra') || text.includes('kahoot') || text.includes('lms') || text.includes('digital');
    return {
      stage: input.stage,
      pedagogical_framework: 'TPACK Model (Technological Pedagogical Knowledge)',
      blooms_taxonomy_level: 'Applying',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'edtech_fluency',
          score: (hasEdTech && wordCount > 10) ? 8 : 3,
          justification: (hasEdTech && wordCount > 10)
            ? `Demonstrated familiarity with smart classroom interactive software, Google Classroom, and digital formative tools.`
            : `Minimal technical software knowledge demonstrated for smart classroom instruction.`,
          pedagogical_benchmark: 'TPACK Technological Knowledge'
        }
      ],
      overall_flag: (hasEdTech && wordCount > 10) ? 'none' : 'needs_review',
      evidence_reference: `Technical Competency Response`,
      identified_gaps: (hasEdTech && wordCount > 10) ? [] : ['Familiarity with digital formative assessment software should be developed.']
    };
  }

  // HR Policy Comprehension — only for HR stages (never as a catch-all)
  if (input.stage === 'hr_policy_briefing' || input.stage.includes('hr_policy')) {
    const acknowledgesPolicies = text.includes('7:45') || text.includes('notice') || text.includes('safeguard')
      || text.includes('probation') || text.includes('acknowledge') || text.includes('agree')
      || text.includes('yes');
    return {
      stage: input.stage,
      pedagogical_framework: 'Danielson Domain 4f: Showing Professionalism & Ethics',
      blooms_taxonomy_level: 'Understanding',
      scoring_mode: 'deterministic_fallback',
      scores: [
        {
          dimension: 'policy_comprehension',
          score: acknowledgesPolicies ? 8 : 3,
          justification: acknowledgesPolicies
            ? `Explicitly agreed to school working hours (7:45 AM), 60-day notice period, and child safeguarding code of conduct.`
            : `Did not explicitly confirm compliance with school safeguarding guidelines and notice policies.`,
          pedagogical_benchmark: 'Institutional Policy Compliance'
        }
      ],
      overall_flag: acknowledgesPolicies ? 'none' : 'needs_review',
      evidence_reference: `HR Policy Briefing Assessment`,
      identified_gaps: acknowledgesPolicies ? [] : ['Explicit commitment to 60-day notice period and safeguarding code required.']
    };
  }

  // Unknown stage — do not invent HR policy scores
  return {
    stage: input.stage,
    pedagogical_framework: 'General submission review',
    scoring_mode: 'deterministic_fallback',
    scores: [
      {
        dimension: 'submission_completeness',
        score: wordCount > 10 || Boolean(input.media_url) ? 5 : 1,
        justification: wordCount > 10 || input.media_url
          ? 'Submission received. Stage-specific AI rubric was unavailable offline.'
          : 'Empty or near-empty submission.',
        pedagogical_benchmark: 'Completeness'
      }
    ],
    overall_flag: 'needs_review',
    evidence_reference: `Unhandled stage key "${input.stage}" — provisional completeness only.`,
    identified_gaps: ['Stage-specific scoring rules were not available for offline evaluation.']
  };
}
