import type { AnswerBehaviour } from './answerBehaviour';
import type { ShortlistBand } from './shortlistBands';
import type { HrPolicyAnswers } from './hrPolicyTemplate';
import type { ReportSettings } from './teachingProfile';

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'SCHOOL_ADMIN' 
  | 'REPORTING_MANAGER' 
  | 'INSTITUTE_HEAD' 
  | 'FINAL_DECISION_MAKER';

export type StageKey = 
  | 'hiring_ad_leads'
  | 'whatsapp_invite'
  | 'identity_verification'
  | 'written_theory'
  | 'micro_teaching_demo'
  | 'situational_scenario'
  | 'hr_policy_briefing'
  // Legacy aliases, kept so historical StageResult records created before
  // the current 5-stage pipeline still deserialize and score correctly
  // (see the weights table in db.ts#calculateCandidateTotalScore). Do not
  // configure a new stage against one of these — use the current key above.
  | 'self_video_intro'
  | 'subject_quiz'
  | 'behavioural_assessment'
  | 'subject_interview'
  | 'lesson_plan'
  | 'lesson_demo'
  | 'tech_round'
  | 'hr_policy_check'
  | 'reporting_manager_review'
  | 'institute_head_review'
  | 'final_decision';

export interface StageConfig {
  key: StageKey;
  name: string;
  phase: 1 | 2 | 3 | 4;
  required: boolean;
  order: number;
  description: string;
  timeLimitSeconds?: number;
}

export interface RubricDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface RubricTemplate {
  id: string;
  school_id: string;
  stage_key: StageKey;
  role_type: string;
  subject: string;
  segment: string;
  dimensions: RubricDimension[];
}

export interface QuestionnaireItem {
  id: string;
  school_id: string;
  stage_key: StageKey;
  subject: string; // 'Physics', 'Math', 'ALL'
  segment: string; // 'Secondary Grade 9 – 10', 'ALL'
  type: 'mcq' | 'case_study' | 'video_prompt';
  question_text: string;
  options?: string[];
  correct_option?: string;
  rubric_hint?: string;
  created_at: string;
}

export interface HRPolicyDocument {
  id: string;
  school_id: string;
  title: string;
  content: string;
  uploaded_at: string;
  updated_at?: string;
  category: 'code_of_conduct' | 'leave_policy' | 'safeguarding' | 'compensation' | 'general';
  /**
   * Whether a candidate must explicitly acknowledge this policy before
   * completing stage 5 (hr_policy_briefing). Defaults to true when absent —
   * every policy created before this field existed represented content the
   * school genuinely wanted acknowledged, so absence should read as
   * "required", not "optional".
   */
  required?: boolean;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  location: string;
}

export interface CurriculumGuidelines {
  board: string; // 'CBSE' | 'Cambridge IGCSE' | 'ICSE' | 'IB' | 'State Board'
  pedagogical_philosophy: string;
  focus_areas: string[];
  custom_syllabus_notes?: string;
}

/**
 * What a school has paid for. A school with no `billing` record predates plans
 * and is treated as complimentary; a self-signup starts on `none` and the
 * platform owner sets its plan once payment is received.
 */
export interface SchoolBilling {
  plan: 'none' | 'trial' | 'starter' | 'growth' | 'complimentary';
  /** ISO date the paid period ends; absent means no end date. */
  valid_until?: string;
  /** Payment reference or note entered by the platform owner. */
  note?: string;
  updated_at: string;
}

/** A job title a school gives its team (for example "Science HOD"), and the access it carries. */
export interface RoleDef {
  id: string;
  name: string;
  level: UserRole;
}

export interface School {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  primary_contact: {
    name: string;
    email: string;
    phone: string;
  };
  branches: Branch[];
  subjects: string[];
  segments: string[];
  curricula: string[];
  stages_config: StageConfig[];
  curriculum_guidelines?: CurriculumGuidelines;
  created_at: string;
  status: 'active' | 'onboarding' | 'suspended';
  billing?: SchoolBilling;
  /** Configurable AI shortlist colour bands (0–100 overall score). */
  shortlist_bands?: ShortlistBand[];
  /** Structured HR answers used to generate the teacher-facing policy pack. */
  hr_policy_answers?: HrPolicyAnswers;
  /** Hiring WhatsApp line used to send assessment invites to teachers. */
  whatsapp_hiring?: WhatsAppHiringConfig;
  /** Which video observations appear in the teaching profile. See teachingProfile.ts. */
  report_settings?: ReportSettings;
  /** The school's own role names. Absent means the four standard roles. See roles.ts. */
  roles?: RoleDef[];
}

export interface WhatsAppHiringConfig {
  display_number: string;
  e164: string;
  display_name: string;
  /** Which WhatsApp Business Account actually sends: ours, or the school's own. */
  provider: 'platform_shared' | 'school_waba';
  waba_id?: string;
  phone_number_id?: string;
  /**
   * The System User access token, encrypted at rest with AES-256-GCM under
   * WHATSAPP_TOKEN_KEY (see src/lib/secrets.ts) — never the plaintext token.
   * A deployment with a real secret manager (GCP Secret Manager, etc.) should
   * swap this for a reference key; call sites only ever go through
   * getSchoolWhatsAppToken(), so that swap touches one function.
   */
  token_encrypted?: string;
  /**
   * `credentials_saved` — school pasted values, nothing verified yet.
   * `verified`          — Graph API confirmed the phone number ID resolves.
   * `live`               — a real delivery receipt has been observed on the webhook.
   * `restricted`         — Meta has restricted the number (quality or policy).
   */
  status: 'not_connected' | 'credentials_saved' | 'verified' | 'live' | 'restricted';
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  messaging_tier?: number;
  verified_at?: string;
  last_error?: { code: number; title: string; at: string };
  saved_at?: string;
}

export type WhatsAppMessageStatus =
  | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped_no_consent';

export interface WhatsAppMessageLog {
  id: string;
  school_id: string;
  candidate_id?: string;
  to_e164: string;
  template_name: string;
  template_vars: string[];
  wa_message_id?: string;
  status: WhatsAppMessageStatus;
  error_code?: number;
  error_title?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
  /** Set when the recipient replies — free-form sends are allowed until this passes. */
  window_expires_at?: string;
}

/**
 * Written at upload time so /api/media can authorize a just-uploaded file
 * immediately — before it is attached to a stage result or the candidate
 * record, which is when the school_id/media_url match in
 * findCandidateByMediaUrl would otherwise start working.
 */
export interface UploadOwner {
  filename: string;
  candidate_id: string;
  school_id: string;
  created_at: string;
}

/** Tracks the 24-hour window WhatsApp opens after a candidate replies. */
export interface MessageWindow {
  school_id: string;
  candidate_id: string;
  channel: 'whatsapp';
  expires_at: string;
}

export interface MessagingConsent {
  candidate_id: string;
  channel: 'whatsapp' | 'email';
  granted: boolean;
  source: 'apply_form' | 'school_attested' | 'reply';
  wording_version: string;
  granted_at: string;
  revoked_at?: string;
}

/**
 * A right-to-erasure request from /api/account/delete-request. Deliberately
 * durable rather than instant: the requester is identified only by an email
 * address they typed into a public, unauthenticated form, so honouring it
 * immediately would let anyone delete another candidate's application data
 * just by knowing their email. `matched_candidates` lists every candidate
 * record found with that email, across every school — each entry is
 * fulfilled independently by staff at the owning school (or a super admin),
 * removing it from the list; the request moves to 'completed' once none remain.
 */
export interface DeletionRequest {
  id: string;
  email: string;
  reason?: string;
  status: 'pending' | 'completed' | 'no_match';
  matched_candidates: { candidate_id: string; school_id: string; fulfilled_at?: string }[];
  requested_at: string;
  resolved_at?: string;
}

export interface User {
  id: string;
  school_id: string | null; // null for Super Admin
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  branch_id?: string;
  /** Which of the school's own role names this person holds. `role` is the permission level behind it. */
  role_id?: string;
  /** Set when a school admin added this person, before they have ever signed in. */
  invited_at?: string;
  invited_by?: string;
  /** Stamped on every successful sign-in, by password or Google. Absent means never signed in. */
  last_login_at?: string;
}

/**
 * Proof of identity for someone who signs in with an email and password. It is
 * deliberately separate from `User`, which says which school someone belongs to
 * and in what role: an Account can exist before it belongs to any school (a new
 * sign-up on its way to the setup wizard), and a User can exist before it has an
 * Account (a colleague just invited). Both are matched by email.
 */
export interface Account {
  id: string;
  /** Always lower-case. */
  email: string;
  name: string;
  /** scrypt hash, see password.ts. Never sent to a browser. */
  password_hash: string;
  email_verified_at: string;
  created_at: string;
  password_changed_at?: string;
}

export interface ResumeCareerGap {
  period: string; // e.g. "Jun 2021 – Aug 2022"
  duration_months: number;
  description: string;
  flagged: boolean;
}

export interface ResumeTrajectory {
  trend: 'Upward' | 'Lateral' | 'Downward' | 'Volatile';
  summary: string;
  milestones: string[];
}

export interface ResumeAnalysisReport {
  overall_fitment_score: number; // 1-10
  career_stability_index: 'High' | 'Moderate' | 'Volatile';
  total_experience_years: number;
  average_tenure_years: number;
  job_hopping_risk: 'Low' | 'Moderate' | 'High';
  career_gaps: ResumeCareerGap[];
  career_trajectory: ResumeTrajectory;
  qualifications_match: {
    degrees_found: string[];
    alignment_with_subject: string;
    b_ed_status: string;
    ctet_tet_status: string;
  };
  pedagogical_highlights: string[];
  red_flags: string[];
  green_flags: string[];
  recommended_interview_probes: string[];
  analyzed_at: string;
  eligibility_verdict?: 'eligible' | 'not_eligible' | 'needs_review';
  eligibility_summary?: string;
  name_on_cv?: string;
  form_vs_cv_discrepancies?: string[];
}

export interface Candidate {
  id: string;
  school_id: string;
  invite_code?: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  age?: number;
  qualification: string; // Grade 10, Grade 12, Graduation, Masters, Other Certificate
  experience_band: string; // Fresher, 1-2 years, 2-4 years, 4-6 years, 6+ years
  prior_org: string;
  current_salary: string;
  expected_salary: string;
  current_location: string;
  relocation_branches: string[]; // Manneguda, Tukkuguda, Vikarabad
  languages: string[];
  notice_period: string; // Immediate, 7 days, 15 days, 1 month, 2 months, 3 months
  applied_segment: string; // Level and grades, such as "Primary (Grades 1, 2 and 5)". See grades.ts.
  /** The exact grades they would teach (ids from grades.ts, such as "1", "5", "lkg"). */
  applied_grades?: string[];
  applied_subject: string; // 16 subjects
  target_branch_id: string;
  video_intro_url?: string;
  reading_passage_text?: string;
  reading_passage_score?: number;
  resume_url?: string;
  resume_text?: string;
  resume_analysis?: ResumeAnalysisReport;
  status: 'in_progress' | 'passed' | 'rejected' | 'hired';
  shortlist_status?: 'pending' | 'shortlisted' | 'rejected' | 'hold';
  total_ai_score?: number; // 0 - 100 aggregate score
  /** When the school marked this teacher selected / hired */
  selected_at?: string;
  /** When an offer letter was sent */
  offer_letter_sent_at?: string;
  /** School rejected the candidate */
  rejected_by_school_at?: string;
  /** When the candidate was told their application was declined (sent at most once). */
  outcome_notified_at?: string;
  /** When the WhatsApp test invite was last sent, so a bulk send never double-messages. */
  whatsapp_invite_sent_at?: string;
  rejected_by_school_reason?: string;
  /** Candidate declined the role / offer */
  rejected_by_candidate_at?: string;
  rejected_by_candidate_reason?: string;
  rm_clearance?: {
    status: 'cleared' | 'rejected' | 'pending';
    rating?: number; // 1-5, only when an interviewer actually gave one
    notes: string;
    gmeet_link?: string;
    completed_at?: string;
    reviewer_name?: string;
  };
  ih_clearance?: {
    status: 'cleared' | 'rejected' | 'pending';
    rating?: number; // 1-5, only when an interviewer actually gave one
    notes: string;
    gmeet_link?: string;
    completed_at?: string;
    reviewer_name?: string;
  };
  coo_clearance?: {
    status: 'cleared' | 'rejected' | 'pending';
    decision?: 'offer_issued' | 'rejected' | 'hold';
    notes: string;
    gmeet_link?: string;
    completed_at?: string;
    offer_letter?: OfferLetterDetails;
  };
  current_stage_key: StageKey;
  /** The questions drawn for this candidate from the platform bank, so the same test is served and marked every time. */
  test_set?: { subject: string; ids: string[]; drawn_at: string };
  /** Worked out when the list is served (how many of the five test stages are done); never stored. */
  stages_completed?: number;
  interview_decisions?: InterviewDecision[];
  created_at: string;
  updated_at: string;
}

export type InterviewRound = 'subject_lead' | 'principal' | 'management';

export interface InterviewDecision {
  round: InterviewRound;
  round_label: string;
  /** The signed-in staff member who actually recorded this — never a typed name. */
  reviewer_id: string;
  reviewer_name: string;
  decision: 'accepted' | 'rejected';
  reason: string;
  decided_at: string;
}

export type ScheduledInterviewStatus = 'scheduled' | 'completed' | 'cancelled';

/**
 * A real, HR-allotted interview slot: a specific candidate meets a specific
 * staff member at a specific time over a specific link. Distinct from
 * InterviewDecision, which records the outcome after the interview happens —
 * a ScheduledInterview is what gets a candidate and a reviewer to the same
 * (virtual) room in the first place.
 */
export interface ScheduledInterview {
  id: string;
  school_id: string;
  candidate_id: string;
  round: InterviewRound;
  assigned_user_id: string;
  assigned_user_name: string;
  scheduled_at: string; // ISO
  duration_minutes: number;
  meeting_link: string;
  status: ScheduledInterviewStatus;
  notes?: string;
  scheduled_by_id: string;
  scheduled_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentPack {
  id: string;
  school_id: string;
  title: string;
  subject: string;
  segment: string;
  board: string;
  status: 'draft' | 'active' | 'archived';
  mcqs: {
    id: string;
    question_text: string;
    options: string[];
    correct_option: string;
    explanation?: string;
    /** subject = content depth; pedagogy = teaching practice */
    category?: 'subject' | 'pedagogy';
  }[];
  pedagogy_mcqs?: {
    id: string;
    question_text: string;
    options: string[];
    correct_option: string;
    explanation?: string;
    category?: 'pedagogy';
  }[];
  lesson_prompt: string;
  lesson_rubric: string;
  demo_prompt: string;
  demo_rubric: string;
  scenario_prompt: string;
  scenario_rubric: string;
  created_at: string;
}

export interface AIScoreDimension {
  dimension: string;
  score: number; // 1-10
  justification: string;
  pedagogical_benchmark?: string; // e.g. 'Danielson 3b: Questioning & Discussion'
}

export interface AIScoringContract {
  stage: string;
  scores: AIScoreDimension[];
  overall_flag: 'none' | 'needs_review' | 'strong_candidate';
  evidence_reference: string;
  // Advanced 5-Pillar Evaluation Enhancements
  pedagogical_framework?: string;
  blooms_taxonomy_level?: 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';
  evidence_quote?: string;
  identified_gaps?: string[];
  plagiarism_risk?: 'low' | 'moderate' | 'high';
  plagiarism_reason?: string;
  discrepancy_alert?: string;
  multimodal_video_analyzed?: boolean;
  /** gemini = live model; deterministic_fallback = offline/heuristic when Gemini unavailable */
  scoring_mode?: 'gemini' | 'deterministic_fallback';
}

export interface HumanOverride {
  original_ai_score: number;
  overridden_score: number;
  justification_note: string;
  reviewer_id: string;
  reviewer_name: string;
  timestamp: string;
}

export interface StageResult {
  id: string;
  school_id: string;
  candidate_id: string;
  stage_key: StageKey;
  stage_name: string;
  ai_scores?: AIScoringContract;
  /** 'pending' while the AI is still scoring a saved submission; absent on older results. */
  scoring_status?: 'pending' | 'done' | 'failed';
  human_override?: HumanOverride;
  reviewer_notes?: string;
  reviewer_decision?: 'pass' | 'reject' | 'hire' | 'hold';
  reviewer_id?: string;
  reviewer_name?: string;
  transcript?: string;
  written_submission?: string;
  media_url?: string;
  /** How the written answers were produced (typing pattern, answer pace). For the reviewer; never changes a score. */
  behaviour?: AnswerBehaviour;
  completed_at: string;
}

export type ProctoringEventType = 
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'TIMEOUT'
  | 'WEBCAM_SNAPSHOT'
  | 'COPY_PASTE_ATTEMPT'
  | 'GAZE_OFF_SCREEN'
  | 'LOOKING_DOWN_AT_DEVICE'
  | 'PHONE_DETECTED'
  | 'READING_TELEPROMPTER_SUSPECTED'
  | 'VOICE_PROCTOR_WARNING'
  | 'MULTI_FACE_DETECTED'
  | 'FACE_NOT_DETECTED'
  | 'OBJECT_DETECTED'
  | 'FOCUS_LOST'
  | 'MULTIPLE_DISPLAYS'
  | 'CAMERA_LOST'
  | 'RECALIBRATED'
  | 'TYPING_ANOMALY';

export interface ProctoringEvent {
  id: string;
  school_id: string;
  candidate_id: string;
  stage_key: StageKey;
  event_type: ProctoringEventType;
  details: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  school_id: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

export interface EvaluationRecord {
  id: string;
  school_id: string;
  candidate_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: UserRole;
  decision: 'approve' | 'reject' | 'hire' | 'hold';
  notes: string;
  feedback_video_url?: string;
  recommended_branch_id?: string;
  offered_salary?: string;
  joining_date?: string;
  timestamp: string;
}

export interface OfferLetterDetails {
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  school_id: string;
  school_name: string;
  designation: string;
  subject: string;
  grade_segment: string;
  branch_name: string;
  branch_location: string;
  annual_ctc: string;
  monthly_salary: string;
  probation_period: string;
  notice_period: string;
  joining_date: string;
  reporting_authority: string;
  issue_date: string;
}

export interface PublicVacancy {
  id: string;
  school_id: string;
  school_name: string;
  school_type?: string;
  title: string;
  subject: string;
  segment: string;
  /** The exact grades this vacancy is for. `segment` carries the same grades as text. */
  grades?: string[];
  board: string;
  location: string;
  branch: string;
  /**
   * The real Branch.id this posting is for, so an applicant can be tagged
   * to the correct campus at apply time. Optional because older postings
   * (and any created before this field existed) only ever captured the
   * branch as free display text.
   */
  target_branch_id?: string;
  experience_required: string;
  salary_range: string;
  posted_date: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  perks?: string[];
  is_verified?: boolean;
  is_urgent?: boolean;
  status: 'active' | 'closed';
  created_at: string;
}

