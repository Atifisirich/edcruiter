import fs from 'fs';
import path from 'path';
import { School, User, Candidate, StageResult, ProctoringEvent, AuditLogEntry, HRPolicyDocument, RubricTemplate, QuestionnaireItem, StageKey, EvaluationRecord, PublicVacancy, AssessmentPack, WhatsAppMessageLog, MessagingConsent, MessageWindow, UploadOwner, DeletionRequest, ScheduledInterview } from './types';
import { candidateMatchesIdentifier } from './candidateMatch';
import { createCoalescedWriter } from './coalescedWriter';
import { SLOKA_DEFAULT_SCHOOL, DEFAULT_USERS, SLOKA_HR_POLICIES, DEFAULT_RUBRIC_TEMPLATES, DEFAULT_QUESTIONNAIRES, SLOKA_SCHOOL_ID } from './defaultData';

interface DatabaseSchema {
  schools: School[];
  users: User[];
  candidates: Candidate[];
  stageResults: StageResult[];
  proctoringEvents: ProctoringEvent[];
  hrPolicies: HRPolicyDocument[];
  rubrics: RubricTemplate[];
  questionnaires: QuestionnaireItem[];
  auditLogs: AuditLogEntry[];
  evaluations?: EvaluationRecord[];
  jobs?: PublicVacancy[];
  assessmentPacks?: AssessmentPack[];
  whatsappMessages?: WhatsAppMessageLog[];
  messagingConsents?: MessagingConsent[];
  messageWindows?: MessageWindow[];
  uploadOwners?: UploadOwner[];
  deletionRequests?: DeletionRequest[];
  scheduledInterviews?: ScheduledInterview[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
// Duplicated from uploads.ts (not imported) to avoid a circular dependency —
// uploads.ts imports the `db` singleton from this file for /api/media auth.
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

function ensureDataDirExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// A real deployment starts empty. The demo school, its staff accounts
// (superadmin@edcruiter.ai and friends) and fake audit entries exist for local
// development only — on a live site they would be seeded accounts that
// whoever controls those email addresses could sign in as. Set
// SEED_DEMO_DATA=true to get the demo content anywhere else.
function shouldSeedDemoData(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true';
}

function getInitialDatabase(): DatabaseSchema {
  if (!shouldSeedDemoData()) {
    return {
      schools: [], users: [], candidates: [], stageResults: [], proctoringEvents: [],
      hrPolicies: [], rubrics: DEFAULT_RUBRIC_TEMPLATES, questionnaires: [], auditLogs: [],
      jobs: [], assessmentPacks: [], whatsappMessages: [], messagingConsents: [],
      messageWindows: [], uploadOwners: [], deletionRequests: [], scheduledInterviews: []
    };
  }
  const sampleCandidates: Candidate[] = [];
  const sampleStageResults: StageResult[] = [];
  const sampleProctoringEvents: ProctoringEvent[] = [];

  const sampleAuditLogs: AuditLogEntry[] = [
    {
      id: 'audit_001',
      school_id: SLOKA_SCHOOL_ID,
      actor_id: 'user_sloka_admin',
      actor_name: 'Radhika Rao',
      actor_role: 'SCHOOL_ADMIN',
      action: 'TENANT_CONFIG_UPDATE',
      resource: 'School: Sample School',
      details: 'Updated branch list and added Cambridge IGCSE curriculum template.',
      timestamp: new Date('2026-01-20T09:00:00Z').toISOString()
    },
    {
      id: 'audit_002',
      school_id: SLOKA_SCHOOL_ID,
      actor_id: 'user_rm_math',
      actor_name: 'Dr. Vikramaditya Sen',
      actor_role: 'REPORTING_MANAGER',
      action: 'HUMAN_REVIEW_SUBMIT',
      resource: 'Candidate: Dr. Sneha Kulkarni',
      details: 'Submitted pass decision in Reporting Manager Round.',
      timestamp: new Date('2026-02-04T15:00:00Z').toISOString()
    }
  ];

  return {
    schools: [SLOKA_DEFAULT_SCHOOL],
    users: DEFAULT_USERS,
    candidates: sampleCandidates,
    stageResults: sampleStageResults,
    proctoringEvents: sampleProctoringEvents,
    hrPolicies: SLOKA_HR_POLICIES,
    rubrics: DEFAULT_RUBRIC_TEMPLATES,
    questionnaires: DEFAULT_QUESTIONNAIRES,
    auditLogs: sampleAuditLogs,
    jobs: [],
    assessmentPacks: [],
    whatsappMessages: [],
    messagingConsents: [],
    messageWindows: [],
    uploadOwners: [],
    deletionRequests: [],
    scheduledInterviews: []
  };
}

class DB {
  private data: DatabaseSchema;

  constructor() {
    ensureDataDirExists();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.jobs) this.data.jobs = [];
        if (!this.data.evaluations) this.data.evaluations = [];
        if (!this.data.assessmentPacks) this.data.assessmentPacks = [];
        if (!this.data.whatsappMessages) this.data.whatsappMessages = [];
        if (!this.data.messagingConsents) this.data.messagingConsents = [];
        if (!this.data.messageWindows) this.data.messageWindows = [];
        if (!this.data.uploadOwners) this.data.uploadOwners = [];
        if (!this.data.deletionRequests) this.data.deletionRequests = [];
        if (!this.data.scheduledInterviews) this.data.scheduledInterviews = [];
      } catch (err) {
        // Never overwrite a store we could not read: set it aside so the data
        // can still be recovered, then start fresh.
        console.error('Failed to parse db store file, setting it aside and starting fresh:', err);
        try { fs.renameSync(DB_FILE, `${DB_FILE}.unreadable.${Date.now()}`); } catch { /* best effort */ }
        this.data = getInitialDatabase();
        this.save();
      }
    } else {
      this.data = getInitialDatabase();
      this.save();
    }
    this.ensureBootstrapSuperAdmin();
  }

  // A live site starts with no accounts, so the platform owner is named by
  // environment variable. Idempotent: does nothing once that user exists.
  private ensureBootstrapSuperAdmin() {
    const email = (process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!email) return;
    if (this.data.users.some((u) => u.email.toLowerCase() === email)) return;
    this.data.users.push({
      id: `user_super_${Date.now()}`,
      school_id: null,
      name: 'Platform Administrator',
      email,
      role: 'SUPER_ADMIN'
    } as User);
    this.save();
  }

  // One write at a time, and changes made during a write are folded into a
  // single follow-up write of the latest state (see coalescedWriter.ts) —
  // important when the data folder is cloud storage, which can't take a full
  // rewrite per change.
  private save = createCoalescedWriter(() => this.writeNow());

  private async writeNow() {
    ensureDataDirExists();
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      await fs.promises.writeFile(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      await fs.promises.rename(tmpFile, DB_FILE);
    } catch (e) {
      console.error('Failed to persist store.json:', e);
      try { await fs.promises.unlink(tmpFile); } catch { /* tmp file never got created */ }
    }
  }

  // --- Strict Multi-Tenant Enforcement Methods ---

  getSchools(): School[] {
    return this.data.schools;
  }

  getSchoolById(schoolId: string): School | undefined {
    return this.data.schools.find(s => s.id === schoolId);
  }

  createSchool(school: School): School {
    this.data.schools.push(school);
    this.save();
    return school;
  }

  /**
   * Resolves the tenant that owns a given WhatsApp Business Account, used by
   * the webhook (one callback URL, many possible schools) to route a
   * delivery-status event to the right tenant. Only meaningful for a school
   * on its own dedicated WABA — for the platform's shared WABA, many schools
   * share the same id, so this alone can never disambiguate them; use
   * `findCandidateOnSharedWaba` for that case instead (see its comment).
   */
  getSchoolByWabaId(wabaId: string): School | undefined {
    return this.data.schools.find((s) => s.whatsapp_hiring?.waba_id === wabaId);
  }

  /** True when `wabaId` is the platform's own shared account, not a school-owned one. */
  isPlatformSharedWaba(wabaId: string): boolean {
    return !!wabaId && wabaId === process.env.WHATSAPP_WABA_ID;
  }

  /**
   * For an inbound message arriving on the platform's shared number: every
   * school using `platform_shared` sends from the same WABA, so the WABA id
   * alone cannot say which school a reply belongs to — only the candidate's
   * phone number can. This searches every platform_shared school for a
   * candidate matching that number and returns the one that actually has
   * one. (getWhatsAppMessageByWaId can't help here either — an inbound
   * message is not a delivery receipt for something this platform sent, so
   * there is no prior outbound row carrying the right school_id.)
   */
  findCandidateOnSharedWaba(fromPhone: string): { candidate: Candidate; school: School } | undefined {
    const sharedSchools = this.data.schools.filter((s) => s.whatsapp_hiring?.provider === 'platform_shared');
    for (const school of sharedSchools) {
      const candidate = this.findCandidateByIdentifier(fromPhone, school.id);
      if (candidate) return { candidate, school };
    }
    return undefined;
  }

  updateSchool(schoolId: string, updates: Partial<School>): School | undefined {
    const idx = this.data.schools.findIndex(s => s.id === schoolId);
    if (idx === -1) return undefined;
    this.data.schools[idx] = { ...this.data.schools[idx], ...updates };
    this.save();
    return this.data.schools[idx];
  }

  getUsersBySchool(schoolId: string | null): User[] {
    if (schoolId === null) {
      return this.data.users.filter(u => u.role === 'SUPER_ADMIN');
    }
    return this.data.users.filter(u => u.school_id === schoolId);
  }

  getUserById(userId: string): User | undefined {
    return this.data.users.find(u => u.id === userId);
  }

  getUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    return this.data.users.find(u => u.email.toLowerCase() === clean);
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.save();
    return user;
  }

  // Calculate dynamic aggregate AI score (0-100) across all stages
  calculateCandidateTotalScore(schoolId: string, candidateId: string): number {
    const results = this.getStageResultsByCandidate(schoolId, candidateId);
    if (!results || results.length === 0) return 0;

    // written_theory / micro_teaching_demo / situational_scenario are the
    // current stage keys (see SLOKA_DEFAULT_STAGES). lesson_plan, lesson_demo,
    // behavioural_assessment and subject_quiz are legacy StageKey aliases
    // (types.ts) kept only so historical stageResults records that predate
    // the current pipeline still score correctly — don't configure a *new*
    // stage against one of these when the current-generation key above means
    // the same thing.
    const weights: Record<string, number> = {
      written_theory: 0.34,
      lesson_plan: 0.34,
      micro_teaching_demo: 0.38,
      lesson_demo: 0.38,
      situational_scenario: 0.28,
      behavioural_assessment: 0.28,
      subject_quiz: 0.34
    };

    let totalWeightedScore = 0;
    let totalWeightApplied = 0;

    for (const res of results) {
      const w = weights[res.stage_key] || 0.15;
      if (res.ai_scores?.scores && res.ai_scores.scores.length > 0) {
        const stageAvg = res.ai_scores.scores.reduce((acc, s) => acc + s.score, 0) / res.ai_scores.scores.length;
        totalWeightedScore += stageAvg * 10 * w; // Scale 1-10 to 10-100
        totalWeightApplied += w;
      }
    }

    if (totalWeightApplied === 0) return 0;
    return Math.min(100, Math.round((totalWeightedScore / totalWeightApplied)));
  }

  // Candidates - Tenant Scoped
  getCandidatesBySchool(schoolId: string, filters?: { branchId?: string; subject?: string; segment?: string; status?: string }): Candidate[] {
    let list = this.data.candidates.filter(c => c.school_id === schoolId);
    if (filters?.branchId) {
      const bId = filters.branchId;
      list = list.filter(c => c.target_branch_id === bId || c.relocation_branches.includes(bId));
    }
    if (filters?.subject) list = list.filter(c => c.applied_subject.toLowerCase() === filters.subject!.toLowerCase());
    if (filters?.segment) list = list.filter(c => c.applied_segment.toLowerCase().includes(filters.segment!.toLowerCase()));
    if (filters?.status) list = list.filter(c => c.status === filters.status);

    return list.map(c => ({
      ...c,
      total_ai_score: c.total_ai_score !== undefined ? c.total_ai_score : this.calculateCandidateTotalScore(schoolId, c.id),
      shortlist_status: c.shortlist_status || (c.status === 'passed' || c.status === 'hired' ? 'shortlisted' : 'pending')
    }));
  }

  getCandidateById(schoolId: string, candidateId: string): Candidate | undefined {
    const c = this.data.candidates.find(cand => cand.school_id === schoolId && cand.id === candidateId);
    if (!c) return undefined;
    return {
      ...c,
      total_ai_score: c.total_ai_score !== undefined ? c.total_ai_score : this.calculateCandidateTotalScore(schoolId, candidateId),
      shortlist_status: c.shortlist_status || (c.status === 'passed' || c.status === 'hired' ? 'shortlisted' : 'pending')
    };
  }

  // For candidate portal self-serve flow where candidate token/ID is provided
  getCandidateByIdPublic(candidateId: string): Candidate | undefined {
    return this.data.candidates.find(c => c.id === candidateId);
  }

  /** Every candidate record with this email, across every school — used to resolve a deletion request. */
  findCandidatesByEmail(email: string): Candidate[] {
    const clean = email.trim().toLowerCase();
    return this.data.candidates.filter((c) => c.email && c.email.toLowerCase() === clean);
  }

  /**
   * Resolves which candidate a stored resume or stage-media URL belongs to,
   * for /api/media auth. Checked in three places, most authoritative last:
   * the direct upload-ownership record (works immediately after upload,
   * before the file is attached to anything), then the candidate's own
   * resume_url, then any stage result's media_url.
   */
  findCandidateByMediaUrl(urlPath: string): { candidateId: string; schoolId: string } | undefined {
    const filename = urlPath.split('/').pop() || '';
    const byUpload = this.data.uploadOwners?.find((u) => u.filename === filename);
    if (byUpload) return { candidateId: byUpload.candidate_id, schoolId: byUpload.school_id };

    const byResume = this.data.candidates.find((c) => c.resume_url === urlPath);
    if (byResume) return { candidateId: byResume.id, schoolId: byResume.school_id };

    const byStage = this.data.stageResults.find((sr) => sr.media_url === urlPath);
    if (byStage) return { candidateId: byStage.candidate_id, schoolId: byStage.school_id };

    return undefined;
  }

  recordUploadOwner(owner: UploadOwner) {
    if (!this.data.uploadOwners) this.data.uploadOwners = [];
    this.data.uploadOwners.push(owner);
    this.save();
  }

  /**
   * Matches on ID, email, or phone only — exact match after normalisation.
   * The matching predicate itself lives in candidateMatch.ts (pure, unit
   * tested); this alone is still not a login — callers must additionally
   * verify the candidate's invite_code before issuing a session, see
   * POST /api/candidates/login.
   */
  findCandidateByIdentifier(identifier: string, schoolId?: string): Candidate | undefined {
    return this.data.candidates.find(
      (c) => (!schoolId || c.school_id === schoolId) && candidateMatchesIdentifier(identifier, c)
    );
  }

  /**
   * Two-factor candidate login lookup, used when the caller has no school_id
   * to scope by (the public login page — a candidate has no way to know
   * their internal school_id, and this route has no staff session to derive
   * one from). Requires identifier AND invite_code to match on the SAME
   * record, rather than finding the first identifier match and checking its
   * code afterwards: test/lead data routinely reuses one phone number across
   * several candidates (siblings, or a WhatsApp lead captured before the
   * candidate's own details are known), including across different schools,
   * so an identifier-only lookup can land on the wrong record even though
   * some other candidate's identifier+code pair is exactly right.
   */
  findCandidateByIdentifierAndCode(identifier: string, inviteCode: string): Candidate | undefined {
    const code = inviteCode.trim().toUpperCase();
    return this.data.candidates.find(
      (c) => candidateMatchesIdentifier(identifier, c) && (c.invite_code || '').trim().toUpperCase() === code
    );
  }

  createCandidate(candidate: Candidate): Candidate {
    this.data.candidates.push(candidate);
    this.save();
    return candidate;
  }

  updateCandidate(schoolId: string, candidateId: string, updates: Partial<Candidate>): Candidate | undefined {
    const idx = this.data.candidates.findIndex(c => c.school_id === schoolId && c.id === candidateId);
    if (idx === -1) return undefined;
    this.data.candidates[idx] = { ...this.data.candidates[idx], ...updates, updated_at: new Date().toISOString() };
    this.save();
    return this.data.candidates[idx];
  }

  // Stage Results - Tenant Scoped
  getStageResultsByCandidate(schoolId: string, candidateId: string): StageResult[] {
    return this.data.stageResults.filter(sr => sr.school_id === schoolId && sr.candidate_id === candidateId);
  }

  saveStageResult(result: StageResult): StageResult {
    const existingIdx = this.data.stageResults.findIndex(
      sr => sr.school_id === result.school_id && sr.candidate_id === result.candidate_id && sr.stage_key === result.stage_key
    );
    if (existingIdx >= 0) {
      this.data.stageResults[existingIdx] = result;
    } else {
      this.data.stageResults.push(result);
    }
    this.save();
    return result;
  }

  // Proctoring Events - Tenant Scoped
  getProctoringEventsByCandidate(schoolId: string, candidateId: string): ProctoringEvent[] {
    return this.data.proctoringEvents.filter(pe => pe.school_id === schoolId && pe.candidate_id === candidateId);
  }

  addProctoringEvent(event: ProctoringEvent): ProctoringEvent {
    this.data.proctoringEvents.push(event);
    this.save();
    return event;
  }

  // HR Policies - Tenant Scoped
  getHRPoliciesBySchool(schoolId: string): HRPolicyDocument[] {
    return this.data.hrPolicies.filter(p => p.school_id === schoolId);
  }

  addHRPolicy(doc: HRPolicyDocument): HRPolicyDocument {
    this.data.hrPolicies.push(doc);
    this.save();
    return doc;
  }

  updateHRPolicy(schoolId: string, policyId: string, updates: Partial<HRPolicyDocument>): HRPolicyDocument | undefined {
    const idx = this.data.hrPolicies.findIndex((p) => p.school_id === schoolId && p.id === policyId);
    if (idx === -1) return undefined;
    this.data.hrPolicies[idx] = { ...this.data.hrPolicies[idx], ...updates, updated_at: new Date().toISOString() };
    this.save();
    return this.data.hrPolicies[idx];
  }

  deleteHRPolicy(schoolId: string, policyId: string): boolean {
    const before = this.data.hrPolicies.length;
    this.data.hrPolicies = this.data.hrPolicies.filter((p) => !(p.school_id === schoolId && p.id === policyId));
    if (this.data.hrPolicies.length === before) return false;
    this.save();
    return true;
  }

  // Rubrics - Tenant Scoped
  getRubricsBySchool(schoolId: string): RubricTemplate[] {
    return this.data.rubrics ? this.data.rubrics.filter(r => r.school_id === schoolId) : DEFAULT_RUBRIC_TEMPLATES;
  }

  addOrUpdateRubric(rubric: RubricTemplate): RubricTemplate {
    if (!this.data.rubrics) this.data.rubrics = [];
    const idx = this.data.rubrics.findIndex(r => r.school_id === rubric.school_id && r.id === rubric.id);
    if (idx >= 0) {
      this.data.rubrics[idx] = rubric;
    } else {
      this.data.rubrics.push(rubric);
    }
    this.save();
    return rubric;
  }

  deleteRubric(schoolId: string, rubricId: string): boolean {
    if (!this.data.rubrics) return false;
    this.data.rubrics = this.data.rubrics.filter(r => !(r.school_id === schoolId && r.id === rubricId));
    this.save();
    return true;
  }

  // Questionnaires - Tenant Scoped
  getQuestionnairesBySchool(schoolId: string, subject?: string, segment?: string): QuestionnaireItem[] {
    let list = this.data.questionnaires ? this.data.questionnaires.filter(q => q.school_id === schoolId) : DEFAULT_QUESTIONNAIRES;
    if (subject && subject !== 'ALL') {
      list = list.filter(q => q.subject === 'ALL' || q.subject.toLowerCase() === subject.toLowerCase());
    }
    if (segment && segment !== 'ALL') {
      list = list.filter(q => q.segment === 'ALL' || q.segment.toLowerCase().includes(segment.toLowerCase()));
    }
    return list;
  }

  addOrUpdateQuestionnaire(item: QuestionnaireItem): QuestionnaireItem {
    if (!this.data.questionnaires) this.data.questionnaires = [];
    const idx = this.data.questionnaires.findIndex(q => q.school_id === item.school_id && q.id === item.id);
    if (idx >= 0) {
      this.data.questionnaires[idx] = item;
    } else {
      this.data.questionnaires.push(item);
    }
    this.save();
    return item;
  }

  deleteQuestionnaire(schoolId: string, itemId: string): boolean {
    if (!this.data.questionnaires) return false;
    this.data.questionnaires = this.data.questionnaires.filter(q => !(q.school_id === schoolId && q.id === itemId));
    this.save();
    return true;
  }

  /**
   * Deletes a candidate and every record that references them, including
   * the actual uploaded files on disk (resume PDF, stage recordings) — not
   * just the database rows pointing at them. Used both by the ordinary
   * admin "remove candidate" action and by fulfilling a right-to-erasure
   * request (see DeletionRequest / /api/account/delete-request).
   */
  deleteCandidate(schoolId: string, candidateId: string): boolean {
    const initialLen = this.data.candidates.length;
    this.data.candidates = this.data.candidates.filter(c => !(c.school_id === schoolId && c.id === candidateId));
    if (this.data.candidates.length !== initialLen) {
      this.data.stageResults = this.data.stageResults.filter(sr => sr.candidate_id !== candidateId);
      this.data.proctoringEvents = this.data.proctoringEvents.filter(pe => pe.candidate_id !== candidateId);
      if (this.data.evaluations) {
        this.data.evaluations = this.data.evaluations.filter(ev => ev.candidate_id !== candidateId);
      }
      if (this.data.whatsappMessages) {
        this.data.whatsappMessages = this.data.whatsappMessages.filter(m => m.candidate_id !== candidateId);
      }
      if (this.data.messagingConsents) {
        this.data.messagingConsents = this.data.messagingConsents.filter(c => c.candidate_id !== candidateId);
      }
      if (this.data.messageWindows) {
        this.data.messageWindows = this.data.messageWindows.filter(w => w.candidate_id !== candidateId);
      }
      if (this.data.uploadOwners) {
        const owned = this.data.uploadOwners.filter(u => u.candidate_id === candidateId);
        for (const file of owned) {
          this.deleteUploadedFile(file.filename);
        }
        this.data.uploadOwners = this.data.uploadOwners.filter(u => u.candidate_id !== candidateId);
      }
      this.save();
      return true;
    }
    return false;
  }

  /** Removes an uploaded file from disk, refusing to resolve outside the uploads directory. */
  private deleteUploadedFile(filename: string) {
    const decoded = decodeURIComponent(filename);
    if (decoded.includes('\0')) return;
    const resolved = path.resolve(UPLOADS_DIR, decoded);
    const withSep = UPLOADS_DIR.endsWith(path.sep) ? UPLOADS_DIR : UPLOADS_DIR + path.sep;
    if (!resolved.startsWith(withSep)) return;
    try {
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch (e) {
      console.error(`Failed to delete uploaded file ${filename}:`, e);
    }
  }

  // Evaluations - Multi-Tier Decision Records
  addEvaluation(evaluation: EvaluationRecord): EvaluationRecord {
    if (!this.data.evaluations) this.data.evaluations = [];
    const existingIdx = this.data.evaluations.findIndex(
      e => e.candidate_id === evaluation.candidate_id && e.reviewer_role === evaluation.reviewer_role
    );
    if (existingIdx >= 0) {
      this.data.evaluations[existingIdx] = evaluation;
    } else {
      this.data.evaluations.push(evaluation);
    }
    this.save();
    return evaluation;
  }

  getEvaluationsByCandidate(schoolId: string, candidateId: string): EvaluationRecord[] {
    if (!this.data.evaluations) return [];
    return this.data.evaluations.filter(e => e.school_id === schoolId && e.candidate_id === candidateId);
  }

  // Audit Logging
  addAuditLog(entry: AuditLogEntry): AuditLogEntry {
    this.data.auditLogs.push(entry);
    this.save();
    return entry;
  }

  getAuditLogs(schoolId?: string | null): AuditLogEntry[] {
    if (schoolId === null || schoolId === undefined) {
      return this.data.auditLogs;
    }
    return this.data.auditLogs.filter(a => a.school_id === schoolId);
  }

  createJob(job: PublicVacancy): PublicVacancy {
    if (!this.data.jobs) this.data.jobs = [];
    this.data.jobs.unshift(job);
    this.save();
    return job;
  }

  isSchoolActive(schoolId: string): boolean {
    return this.data.schools.find(s => s.id === schoolId)?.status === 'active';
  }

  getPublicJobs(): PublicVacancy[] {
    if (!this.data.jobs) return [];
    return this.data.jobs.filter(j => j.status === 'active' && this.isSchoolActive(j.school_id));
  }

  getJobsBySchool(schoolId: string): PublicVacancy[] {
    if (!this.data.jobs) return [];
    return this.data.jobs.filter(j => j.school_id === schoolId);
  }

  getJobById(jobId: string): PublicVacancy | undefined {
    if (!this.data.jobs) return undefined;
    return this.data.jobs.find(j => j.id === jobId);
  }

  createAssessmentPack(pack: AssessmentPack): AssessmentPack {
    if (!this.data.assessmentPacks) this.data.assessmentPacks = [];
    this.data.assessmentPacks.unshift(pack);
    this.save();
    return pack;
  }

  getAssessmentPacksBySchool(schoolId: string): AssessmentPack[] {
    if (!this.data.assessmentPacks) return [];
    return this.data.assessmentPacks.filter(p => p.school_id === schoolId);
  }

  getAssessmentPackById(packId: string): AssessmentPack | undefined {
    if (!this.data.assessmentPacks) return undefined;
    return this.data.assessmentPacks.find(p => p.id === packId);
  }

  getActiveAssessmentPack(schoolId: string, subject?: string, segment?: string): AssessmentPack | undefined {
    const packs = this.getAssessmentPacksBySchool(schoolId).filter(p => p.status === 'active');
    const sub = (subject || '').toLowerCase();
    const seg = (segment || '').toLowerCase();
    return packs.find(p =>
      (!sub || p.subject.toLowerCase().includes(sub) || sub.includes(p.subject.toLowerCase())) &&
      (!seg || p.segment.toLowerCase().includes(seg.split(' ')[0]) || seg.includes(p.segment.toLowerCase().slice(0, 8)))
    ) || packs[0];
  }

  updateAssessmentPack(packId: string, updates: Partial<AssessmentPack>): AssessmentPack | undefined {
    if (!this.data.assessmentPacks) return undefined;
    const idx = this.data.assessmentPacks.findIndex(p => p.id === packId);
    if (idx < 0) return undefined;
    this.data.assessmentPacks[idx] = { ...this.data.assessmentPacks[idx], ...updates };
    const next = this.data.assessmentPacks[idx];
    if (next.status === 'active') {
      this.data.assessmentPacks = this.data.assessmentPacks.map((p) => {
        if (p.id === next.id) return next;
        if (p.school_id === next.school_id && p.subject === next.subject && p.segment === next.segment) {
          return { ...p, status: 'archived' as const };
        }
        return p;
      });
    }
    this.save();
    return this.data.assessmentPacks.find((p) => p.id === packId);
  }

  deleteAssessmentPack(packId: string): boolean {
    if (!this.data.assessmentPacks) return false;
    const before = this.data.assessmentPacks.length;
    this.data.assessmentPacks = this.data.assessmentPacks.filter((p) => p.id !== packId);
    if (this.data.assessmentPacks.length === before) return false;
    this.save();
    return true;
  }

  // --- WhatsApp message log ---
  // Written before every send attempt, updated after — see src/lib/whatsappClient.ts.
  // This is what replaces a boolean "did the fetch succeed" guess with a real,
  // queryable record of what was sent, to whom, and why it failed.

  createWhatsAppMessage(msg: WhatsAppMessageLog): WhatsAppMessageLog {
    if (!this.data.whatsappMessages) this.data.whatsappMessages = [];
    this.data.whatsappMessages.push(msg);
    this.save();
    return msg;
  }

  updateWhatsAppMessage(id: string, updates: Partial<WhatsAppMessageLog>): WhatsAppMessageLog | undefined {
    if (!this.data.whatsappMessages) return undefined;
    const idx = this.data.whatsappMessages.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    this.data.whatsappMessages[idx] = {
      ...this.data.whatsappMessages[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.save();
    return this.data.whatsappMessages[idx];
  }

  getWhatsAppMessageByWaId(waMessageId: string): WhatsAppMessageLog | undefined {
    return this.data.whatsappMessages?.find((m) => m.wa_message_id === waMessageId);
  }

  getWhatsAppMessagesByCandidate(schoolId: string, candidateId: string): WhatsAppMessageLog[] {
    return (this.data.whatsappMessages || [])
      .filter((m) => m.school_id === schoolId && m.candidate_id === candidateId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  /** Unique recipients this school has messaged in the trailing 24h — for tier-cap enforcement. */
  countRecentUniqueRecipients(schoolId: string, sinceMs: number): number {
    const cutoff = Date.now() - sinceMs;
    const recipients = new Set<string>();
    for (const m of this.data.whatsappMessages || []) {
      if (m.school_id !== schoolId) continue;
      if (new Date(m.created_at).getTime() < cutoff) continue;
      if (m.status === 'skipped_no_consent') continue;
      recipients.add(m.to_e164);
    }
    return recipients.size;
  }

  // --- Messaging consent ---
  // One row per candidate per channel. `granted:false` after a revoke is kept
  // (not deleted) so a re-import cannot silently re-message someone who opted out.

  getConsent(candidateId: string, channel: MessagingConsent['channel']): MessagingConsent | undefined {
    return this.data.messagingConsents?.find((c) => c.candidate_id === candidateId && c.channel === channel);
  }

  setConsent(consent: MessagingConsent): MessagingConsent {
    if (!this.data.messagingConsents) this.data.messagingConsents = [];
    const idx = this.data.messagingConsents.findIndex(
      (c) => c.candidate_id === consent.candidate_id && c.channel === consent.channel
    );
    if (idx >= 0) {
      this.data.messagingConsents[idx] = consent;
    } else {
      this.data.messagingConsents.push(consent);
    }
    this.save();
    return consent;
  }

  revokeConsent(candidateId: string, channel: MessagingConsent['channel']) {
    const existing = this.getConsent(candidateId, channel);
    if (!existing) return;
    this.setConsent({ ...existing, granted: false, revoked_at: new Date().toISOString() });
  }

  // --- Open messaging window (WhatsApp's 24h free-form allowance) ---

  openMessageWindow(schoolId: string, candidateId: string, expiresAtIso: string) {
    if (!this.data.messageWindows) this.data.messageWindows = [];
    const idx = this.data.messageWindows.findIndex(
      (w) => w.school_id === schoolId && w.candidate_id === candidateId && w.channel === 'whatsapp'
    );
    const row: MessageWindow = { school_id: schoolId, candidate_id: candidateId, channel: 'whatsapp', expires_at: expiresAtIso };
    if (idx >= 0) this.data.messageWindows[idx] = row;
    else this.data.messageWindows.push(row);
    this.save();
  }

  isWindowOpen(schoolId: string, candidateId: string): boolean {
    const row = this.data.messageWindows?.find(
      (w) => w.school_id === schoolId && w.candidate_id === candidateId && w.channel === 'whatsapp'
    );
    if (!row) return false;
    return new Date(row.expires_at).getTime() > Date.now();
  }

  // --- Right-to-erasure requests ---

  createDeletionRequest(request: DeletionRequest): DeletionRequest {
    if (!this.data.deletionRequests) this.data.deletionRequests = [];
    this.data.deletionRequests.push(request);
    this.save();
    return request;
  }

  getDeletionRequestById(id: string): DeletionRequest | undefined {
    return this.data.deletionRequests?.find((r) => r.id === id);
  }

  /** Pending requests, optionally narrowed to ones with a matched candidate at `schoolId`. */
  getPendingDeletionRequests(schoolId?: string): DeletionRequest[] {
    const all = (this.data.deletionRequests || []).filter((r) => r.status === 'pending');
    if (!schoolId) return all;
    return all.filter((r) => r.matched_candidates.some((m) => m.school_id === schoolId));
  }

  updateDeletionRequest(id: string, updates: Partial<DeletionRequest>): DeletionRequest | undefined {
    if (!this.data.deletionRequests) return undefined;
    const idx = this.data.deletionRequests.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    this.data.deletionRequests[idx] = { ...this.data.deletionRequests[idx], ...updates };
    this.save();
    return this.data.deletionRequests[idx];
  }

  // --- Scheduled interviews ---
  // HR allots a real slot (candidate, round, a specific staff member, a
  // time, a link); this is separate from a candidate's stageResults and
  // from InterviewDecision, which records what was decided afterward.

  createScheduledInterview(interview: ScheduledInterview): ScheduledInterview {
    if (!this.data.scheduledInterviews) this.data.scheduledInterviews = [];
    this.data.scheduledInterviews.push(interview);
    this.save();
    return interview;
  }

  getScheduledInterviewById(id: string): ScheduledInterview | undefined {
    return this.data.scheduledInterviews?.find((i) => i.id === id);
  }

  getScheduledInterviewsByCandidate(schoolId: string, candidateId: string): ScheduledInterview[] {
    return (this.data.scheduledInterviews || [])
      .filter((i) => i.school_id === schoolId && i.candidate_id === candidateId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  /** Every interview HR has scheduled for the school, most recent first — the coordination view. */
  getScheduledInterviewsBySchool(schoolId: string): ScheduledInterview[] {
    return (this.data.scheduledInterviews || [])
      .filter((i) => i.school_id === schoolId)
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  }

  /** A specific staff member's own assigned interviews — the "My interviews" panel. */
  getScheduledInterviewsForUser(schoolId: string, userId: string): ScheduledInterview[] {
    return (this.data.scheduledInterviews || [])
      .filter((i) => i.school_id === schoolId && i.assigned_user_id === userId)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }

  updateScheduledInterview(id: string, updates: Partial<ScheduledInterview>): ScheduledInterview | undefined {
    if (!this.data.scheduledInterviews) return undefined;
    const idx = this.data.scheduledInterviews.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    this.data.scheduledInterviews[idx] = {
      ...this.data.scheduledInterviews[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.save();
    return this.data.scheduledInterviews[idx];
  }
}

// Global Singleton DB instance
export const db = new DB();

