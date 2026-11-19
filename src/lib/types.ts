import type { AnswerBehaviour } from './answerBehaviour';
import type { ShortlistBand } from './shortlistBands';
import type { HrPolicyAnswers } from './hrPolicyTemplate';
import type { ReportSettings } from './teachingProfile';
import type { CandidateEducation } from './teacherProfile';

/**
 * Access levels. REPORTING_MANAGER, INSTITUTE_HEAD and FINAL_DECISION_MAKER all
 * carry reviewer access now (see permissions.ts); which candidates a reviewer
 * decides on comes from the school's review rounds, not from the level.
 */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'HR'
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
  /** The Google account the school connected so interviews get real Google Meet links and calendar invites. See googleCalendar.ts. */
  google_calendar?: GoogleCalendarConnection;
  /** Which video observations appear in the teaching profile. See teachingProfile.ts. */
  report_settings?: ReportSettings;
  /** The school's own role names. Absent means the standard roles. See roles.ts. */
  roles?: RoleDef[];
  /** How many people of each kind the school may have, set by the platform owner. Absent means the standard seats. See seats.ts. */
  seat_limits?: Partial<Record<UserRole, number>>;
  /** A video explaining the school's policies, shown to candidates in stage 5 before the policy questions. See policyVideo.ts. */
  policy_video?: PolicyVideo;
  /** The "Do you agree…?" questions asked after the policy video. Absent means the starter set. See policyVideo.ts. */
  policy_questions?: PolicyQuestion[];
  /** The AI screening phone call: the school's questions and whether new applicants are called automatically. See screeningCall.ts. */
  screening_call?: ScreeningCallSettings;
  /** What the school pays per started minute of an answered AI screening call, in rupees. Set by the platform owner; absent means the standard rate. */
  screening_call_price_per_min_inr?: number;
  /** The most a school may spend on AI calls in a month, in rupees, set by the platform owner. Absent or 0: no owner limit. */
  screening_call_owner_cap_inr?: number;
  /** Bookkeeping for the call automation, so a summary or an alert goes out once. */
  screening_call_state?: { digest_on?: string; cap_alert_month?: string };
  /** The interview rounds after the shortlist, in order. Absent means the standard three. See reviewRounds.ts. */
  review_rounds?: ReviewRound[];
}

/**
 * The school's policy video. Stored as numbered pieces (data/uploads/pv_<id>_<n>.part),
 * because the live server takes uploads of about 30 MB at most; it is played
 * back from the pieces too, so any length of video works.
 */
export interface PolicyVideo {
  id: string;
  title: string;
  mime: string;
  size: number;
  chunk_size: number;
  chunks: number;
  uploaded_at: string;
  uploaded_by: string;
}

/**
 * What to do with the candidate after a screening call. `suggest_decline`
 * never messages anyone on its own: HR sees a "Send the decline" button and
 * the polite decline goes out only when they press it.
 */
export type ScreeningAction = 'send_link' | 'hold' | 'flag' | 'suggest_decline';

/** How the school wants call results turned into action (the test link going out on its own). See screeningFlow.ts. */
export interface ScreeningRules {
  /** Off: results are only shown; nobody is messaged automatically. */
  enabled: boolean;
  on_proceed: ScreeningAction;
  on_maybe: ScreeningAction;
  on_not_suitable: ScreeningAction;
  /** When the candidate says on the call they are no longer interested: mark them withdrawn (no message), or treat it as Not suitable. */
  on_not_interested: 'withdraw' | 'as_not_suitable';
  /** Days a result may wait for HR before something happens (0: wait for ever). */
  hold_days: number;
  /** After `hold_days`: email HR a reminder, or (for "Wait for HR" results only) send the test link anyway. */
  after_hold: 'remind' | 'send_link';
  /** Extra calls when the candidate does not pick up or the line is busy. */
  retries: number;
  retry_gap_hours: number;
  /** After the last retry: send the test link, or flag for HR. */
  after_no_answer: 'send_link' | 'flag';
  /** When the call could not be placed or connected (for example a Do Not Disturb number). */
  after_failed: 'send_link' | 'flag';
  /** After a missed call, tell the candidate by email (and WhatsApp when a chat is open) that the school tried to reach them. */
  missed_call_message: boolean;
  /** When the candidate asks to be called at another time, ring them then. At most this many times per candidate (0: never). */
  max_callbacks: number;
  /** Calls (including retries) only happen between these hours, India time. */
  window_start_hour: number;
  window_end_hour: number;
  /** No automatic calls on Sundays. */
  skip_sundays: boolean;
}

/** The kinds of post a school hires for, each of which may have its own call questions. */
export type ScreeningGroup = 'pre_primary' | 'primary' | 'middle' | 'secondary' | 'senior_secondary' | 'non_teaching';

/** How much a question's answer matters: rules the candidate out, sends them to HR, or is only asked. */
export type QuestionImportance = 'must' | 'prefer' | 'ask';

/** A list of call questions with, for each, how much it matters and what answer the school wants. */
export interface ScreeningQuestionSet {
  questions: string[];
  /** What the school wants to hear, per question (same order). Empty for "just ask". */
  requirements: string[];
  importance: QuestionImportance[];
}

export type ScreeningLanguage = 'auto' | 'English' | 'Hindi' | 'Telugu';

export interface ScreeningCallSettings {
  /** The main questions, used for every post without its own set. */
  questions: string[];
  /** A must-have for each question (same order as `questions`), written in words, e.g. "Notice period of 60 days or less". Empty means none. */
  requirements?: string[];
  /** How much each main question matters. Absent (older settings): a question with a requirement is a must-have. */
  importance?: QuestionImportance[];
  /** Posts with their own questions. A group not listed uses the main questions. */
  sets?: Partial<Record<ScreeningGroup, ScreeningQuestionSet>>;
  /** Posts (as written in the candidate's "subject") that count as non-teaching, such as "Front office" or "Accountant". */
  non_teaching_roles?: string[];
  auto_call_on_apply: boolean;
  /** Who is called automatically, and how soon. */
  auto_call?: {
    /** Minutes to wait after someone applies before ringing (0: straight away, inside calling hours). */
    delay_min: number;
    /** Tell the candidate a call is coming (email, and WhatsApp when a chat is open). */
    heads_up: boolean;
    /** Only call when the CV fit score (1–10) is at least this. 0: everyone. A CV not read yet does not stop the call. */
    min_cv_score: number;
    /** Only these kinds of post are called. Empty: every post. */
    groups: ScreeningGroup[];
  };
  /** The language the AI speaks. "auto" follows the languages the candidate gave. */
  language?: ScreeningLanguage;
  /** The school's own spending limits (0: no limit). */
  limits?: { monthly_cap_inr: number; daily_max_calls: number };
  /** Who at the school is told what. */
  notify?: { emails: string[]; good_fit_now: boolean; daily_digest: boolean };
  rules?: ScreeningRules;
  /** The school's own call script and variables. Absent: the standard script. See callScript.ts. */
  script?: CallScript;
}

export type CallTone = 'warm' | 'formal' | 'friendly';

/** How the AI caller sounds and what it says, written by the school. Any text may use {{variables}}. */
export interface CallScript {
  /** The name the AI caller gives, e.g. "Priya". */
  agent_name: string;
  tone: CallTone;
  /** The first thing said on the call. */
  greeting: string;
  /** The last thing said before hanging up. */
  closing: string;
  /** Facts the AI may share if the candidate asks: timings, salary range, address, transport. */
  school_info: string;
  /** Extra rules for the AI caller, e.g. "Never promise a salary". */
  instructions: string;
  /** The AI wraps up after about this many minutes. */
  max_minutes: number;
  /** The school's own details (a "fact" the school fills in once), used in texts as {{key}}. */
  variables: CallVariable[];
  /** Ready-made rules the school ticked (see RULE_PRESETS in callScript.ts). */
  rule_flags?: string[];
}

export interface CallVariable {
  key: string;
  /** The name the school sees, e.g. "Salary range". Absent: made from the key. */
  label?: string;
  value: string;
  /** May the AI tell a candidate this if they ask? Absent: yes. */
  share?: boolean;
}

/** A request for help sent to the Edcruiter team from the help bot. */
export interface SupportMessage {
  id: string;
  /** The school it came from; null for a candidate whose school is unknown or a platform user. */
  school_id: string | null;
  school_name?: string;
  from: { kind: 'staff' | 'candidate'; name: string; email?: string; role?: string };
  /** The page the person was on. */
  page: string;
  /** What the person wants help with, in their words or the bot's summary. */
  summary: string;
  transcript: { role: 'user' | 'assistant'; text: string }[];
  status: 'new' | 'resolved';
  created_at: string;
  resolved_at?: string;
  /** A note the team keeps, such as how it was solved. */
  note?: string;
}

export interface ScreeningCheck {
  question: string;
  requirement: string;
  result: 'met' | 'not_met' | 'unclear';
  note?: string;
  /** Absent (older calls): a must-have. */
  importance?: 'must' | 'prefer';
}

/** What was done after a call, so HR can see it. */
export interface ScreeningDecision {
  action:
    | 'link_sent' | 'would_send_link' | 'held' | 'flagged' | 'retry_scheduled' | 'none'
    | 'callback_scheduled' | 'decline_suggested' | 'declined' | 'withdrawn';
  at: string;
  detail: string;
  channels?: string[];
  retry_at?: string;
  /** When HR was last reminded about a result waiting for them. */
  reminded_at?: string;
}

/** scheduled: waiting for its time (calling hours, a delay, a call-back). skipped: never placed (for example the monthly limit was reached). */
export type ScreeningCallStatus = 'scheduled' | 'calling' | 'completed' | 'no_answer' | 'busy' | 'failed' | 'skipped';

/** One AI screening phone call to a candidate. */
export interface ScreeningCall {
  id: string;
  school_id: string;
  candidate_id: string;
  /** live: a real phone call through Sarvam. demo: no call was made; a sample conversation for showing the feature. */
  mode: 'live' | 'demo';
  status: ScreeningCallStatus;
  /** Sarvam's id for the call attempt (live calls). */
  attempt_id?: string;
  /** The school's questions as they were when the call was placed. */
  questions: string[];
  requested_by: string;
  trigger: 'manual' | 'auto' | 'retry' | 'callback';
  /** When a scheduled call is due. */
  scheduled_for?: string;
  /** The kind of post whose questions were asked. Absent: the main questions. */
  group?: ScreeningGroup;
  /** How much each question mattered, as it was when the call was placed. */
  importance?: QuestionImportance[];
  /** The language the AI was asked to speak. */
  language?: string;
  /** How many times this candidate has already been called back at a time they asked for. */
  callback_count?: number;
  /** What the candidate said about carrying on with the application. */
  interest?: 'interested' | 'not_interested' | 'unclear';
  /** The candidate asked to be called at another time instead of finishing the call. */
  callback?: { when_text: string; at: string };
  /** Which try this is for the candidate: 1 for the first call, 2 for the first retry, and so on. */
  attempt?: number;
  /** A must-have for each question, as it was when the call was placed. */
  requirements?: string[];
  checks?: ScreeningCheck[];
  decision?: ScreeningDecision;
  started_at: string;
  ended_at?: string;
  duration_sec?: number;
  transcript?: { role: 'agent' | 'user'; text: string }[];
  answers?: { question: string; answer: string }[];
  summary?: string;
  recommendation?: 'proceed' | 'maybe' | 'not_suitable';
  failure_reason?: string;
  /** What the school is charged for this call: started minutes × its rate (answered calls only). */
  price_inr?: number;
  /** What the call cost the platform (Sarvam minutes plus the phone line), for the owner. */
  cost_inr?: number;
}

/** One "Do you agree…?" question after the policy video. */
export interface PolicyQuestion {
  id: string;
  text: string;
}

/** A candidate's answer to one policy question, with the question as they saw it. */
export interface PolicyAnswer {
  question_id: string;
  question: string;
  agreed: boolean;
  /** Why not, when they did not agree. */
  reason?: string;
}

/** One review round a shortlisted teacher goes through. The last round is the final yes or no. */
export interface ReviewRound {
  id: string;
  name: string;
  /** Ids of the school's roles (RoleDef.id) whose holders may decide this round. */
  role_ids: string[];
}

/** What a reviewer decided at one round. */
export interface RoundResult {
  status: 'cleared' | 'rejected';
  notes: string;
  reviewer_id?: string;
  reviewer_name?: string;
  completed_at: string;
  gmeet_link?: string;
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
  /** Boards they have taught, each its own entry ("CBSE", "IB DP", …). See teacherProfile.ts. */
  boards_taught?: string[];
  /** Degrees and teacher training, kept apart. `qualification` holds a one-line summary of these. */
  education?: CandidateEducation;
  target_branch_id: string;
  /** The vacancy this person applied through, when they came from the job board. */
  job_id?: string;
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
    reviewer_name?: string;
    offer_letter?: OfferLetterDetails;
  };
  current_stage_key: StageKey;
  /** Taken in stage 1. Later stages are compared with it to notice a different person taking the test. */
  face_reference?: FaceReference;
  /** Extra goes at a stage that the school allowed, by stage. */
  extra_attempts?: Partial<Record<StageKey, number>>;
  /** The questions drawn for this candidate from the platform bank, so the same test is served and marked every time. */
  test_set?: { subject: string; ids: string[]; drawn_at: string };
  /** Worked out when the list is served (how many of the five test stages are done); never stored. */
  stages_completed?: number;
  interview_decisions?: InterviewDecision[];
  /** Each review round's outcome, by round id. Older candidates also carry rm/ih/coo_clearance; see reviewRounds.ts. */
  round_results?: Record<string, RoundResult>;
  created_at: string;
  updated_at: string;
}

/** A review round id (ReviewRound.id). The standard three are 'subject_lead', 'principal' and 'management'. */
export type InterviewRound = string;

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
export interface GoogleCalendarConnection {
  /** The Google account the events are created in. */
  email: string;
  /** Google's refresh token, encrypted at rest (secrets.ts). */
  refresh_token_encrypted: string;
  connected_at: string;
  connected_by_name: string;
}

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
  /** google_meet: made in the school's Google Calendar. pasted: HR's own link. jitsi: the free fallback room. Absent (older): pasted or jitsi. */
  meeting_provider?: 'google_meet' | 'pasted' | 'jitsi';
  /** The Google Calendar event, so a reschedule or cancel updates it. */
  calendar_event_id?: string;
  /** Who was told about it, for the HR screen. */
  notified?: { candidate_whatsapp: boolean; candidate_email: boolean; staff: string[]; problems?: string[] };
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
  /**
   * True when candidates take this test's own questions (in their own shuffled order)
   * instead of a draw from Edcruiter's question bank. Set by a school that has edited the questions.
   */
  use_own_questions?: boolean;
  /** When someone at the school last changed this test by hand. */
  edited_at?: string;
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
  /** The task wording this candidate was shown (it differs when a stage was restarted). */
  task_prompt?: string;
  /** Which go at the stage this answer came from. */
  attempt_number?: number;
  /** How the written answers were produced (typing pattern, answer pace). For the reviewer; never changes a score. */
  behaviour?: AnswerBehaviour;
  /** Stage 5: the answers to the school's policy questions. */
  policy_answers?: PolicyAnswer[];
  /** Stage 5: the policy video the candidate was shown, and whether it played to the end. */
  policy_video?: { id: string; title: string; watched_to_end: boolean };
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
  | 'TYPING_ANOMALY'
  /** The face on camera did not match the photo taken at the start. */
  | 'IDENTITY_MISMATCH'
  /** A stage was left unfinished and started again, with new questions. */
  | 'STAGE_RESTARTED';

export interface ProctoringEvent {
  id: string;
  school_id: string;
  candidate_id: string;
  stage_key: StageKey;
  event_type: ProctoringEventType;
  details: string;
  /** A small picture kept as evidence for the reviewer (for example the face that did not match). */
  snapshot_url?: string;
  timestamp: string;
}

/** One go at one stage. A stage left half done is closed and the next go gets new questions. */
export interface StageAttempt {
  id: string;
  school_id: string;
  candidate_id: string;
  stage_key: StageKey;
  /** 1 for the first go. */
  number: number;
  status: 'open' | 'submitted' | 'abandoned';
  started_at: string;
  /** Last time the page said it was still open. */
  last_seen_at: string;
  ended_at?: string;
  /** Bank question ids shown in this go (the subject test only). */
  test_ids?: string[];
  /**
   * The questions of a school's own test, exactly as shown in this go, with the answer key.
   * Kept so a later edit to the test never changes how a go already given is marked. Never sent to a browser.
   */
  own_questions?: {
    id: string;
    question_text: string;
    options: string[];
    correct_option: string;
    explanation?: string;
    category: 'subject' | 'pedagogy';
  }[];
  /** The task wording shown in this go (lesson plan, demo or scenario). */
  prompt?: string;
}

/** The photo and face measurements taken when the candidate began. */
export interface FaceReference {
  photo_url: string;
  descriptors: number[][];
  captured_at: string;
  /** Set on the copy sent to a browser, which never receives the measurements themselves. */
  measured?: boolean;
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

