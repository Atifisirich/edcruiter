import { School, User, HRPolicyDocument, RubricTemplate, StageConfig, QuestionnaireItem } from './types';

export const SLOKA_SCHOOL_ID = 'school_sloka_group';

export const SLOKA_DEFAULT_STAGES: StageConfig[] = [
  {
    key: 'identity_verification',
    name: '1. Basic Identity & PDF CV Upload',
    phase: 1,
    required: true,
    order: 1,
    description: 'Personal details, salary fitment, campus branches & PDF resume upload with Edcruiter AI forensic audit'
  },
  {
    key: 'written_theory',
    name: '2. Written / Theory (Core Depth & Lesson Design)',
    phase: 2,
    required: true,
    order: 2,
    description: 'Core subject depth, misconception remediation, SMART lesson design & grade-specific pedagogical tasks'
  },
  {
    key: 'micro_teaching_demo',
    name: '3. Micro-Teaching Demo (5-Minute Video)',
    phase: 2,
    required: true,
    order: 3,
    description: '5-minute recorded video teaching demo delivering core concept with board work, pacing, and voice modulation'
  },
  {
    key: 'situational_scenario',
    name: '4. Situational Scenario & Classroom Dynamics',
    phase: 2,
    required: true,
    order: 4,
    description: 'Recorded video response for situational judgment, classroom conflict, parent dynamics, and differentiation'
  },
  {
    key: 'hr_policy_briefing',
    name: '5. HR Policy Briefing & Code of Conduct',
    phase: 3,
    required: true,
    order: 5,
    description: 'Interactive AI briefing on working hours (7:45 AM), notice period (60 days), and zero-tolerance child safeguarding policies'
  }
];

export const SLOKA_DEFAULT_SCHOOL: School = {
  id: SLOKA_SCHOOL_ID,
  name: 'Sample School',
  code: 'SAMPLE-SCH',
  logo_url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=200&q=80',
  primary_contact: {
    name: 'School HR Lead',
    email: 'hr@edcruiter.ai',
    phone: '+91 98765 43210'
  },
  branches: [
    { id: 'branch_manneguda', name: 'Manneguda Campus', code: 'MNG', location: 'Manneguda, TG' },
    { id: 'branch_tukkuguda', name: 'Tukkuguda Campus', code: 'TKG', location: 'Tukkuguda, TG' },
    { id: 'branch_vikarabad', name: 'Vikarabad Campus', code: 'VKB', location: 'Vikarabad, TG' },
    { id: 'branch_hyd_main', name: 'Hyderabad Main Campus', code: 'HYD-MAIN', location: 'Banjara Hills, Hyderabad' }
  ],
  subjects: [
    'English', 'Math', 'Science', 'Social', 'Hindi', 'Telugu', 'French',
    'Computer Sciences', 'GK/ Life skills/ Value education', 'Art & Craft',
    'Business Studies', 'Economics', 'Accounts', 'Physics', 'Chemistry', 'Biology'
  ],
  segments: [
    'Pre-primary (3–6 yrs)',
    'Primary (Grades 1–5, 6–11 yrs)',
    'Middle School (Grades 6–8, 11–14 yrs)',
    'Secondary (Grades 9–10, 14–16 yrs)',
    'Senior Secondary (Grades 11–12, 16–18 yrs)'
  ],
  curricula: ['CBSE', 'Cambridge IGCSE & A-Levels', 'ICSE / ISC', 'IB (International Baccalaureate)', 'State Board'],
  stages_config: SLOKA_DEFAULT_STAGES,
  curriculum_guidelines: {
    board: 'CBSE & Cambridge IGCSE',
    pedagogical_philosophy: 'Inquiry-Based Learning, Conceptual Rigor & Differentiated Instruction',
    focus_areas: ['Hands-on Demonstrations', 'Misconception Diagnosis', 'Socratic Scaffolding', 'Bloom Analysis Questions'],
    custom_syllabus_notes: 'Mandatory 5-min exit ticket, 3-tier differentiation for mixed-ability classrooms, smartboard interactive software usage.'
  },
  created_at: new Date('2026-01-15').toISOString(),
  status: 'active',
  whatsapp_hiring: {
    display_number: '+91 98765 43210',
    e164: '919876543210',
    display_name: 'Sample School Hiring',
    provider: 'platform_shared',
    status: 'not_connected',
    saved_at: new Date('2026-01-15').toISOString()
  }
};

export const DEFAULT_USERS: User[] = [
  {
    id: 'user_super_admin',
    school_id: null,
    name: 'Platform Administrator',
    email: 'superadmin@edcruiter.ai',
    role: 'SUPER_ADMIN'
  },
  {
    id: 'user_sloka_admin',
    school_id: SLOKA_SCHOOL_ID,
    name: 'School HR Director',
    email: 'admin@edcruiter.ai',
    role: 'SCHOOL_ADMIN'
  },
  {
    id: 'user_sloka_rm',
    school_id: SLOKA_SCHOOL_ID,
    name: 'Department Reporting Manager',
    email: 'rm@edcruiter.ai',
    role: 'REPORTING_MANAGER'
  },
  {
    id: 'user_sloka_ih',
    school_id: SLOKA_SCHOOL_ID,
    name: 'Campus Principal & Institute Head',
    email: 'principal@edcruiter.ai',
    role: 'INSTITUTE_HEAD'
  },
  {
    id: 'user_sloka_coo',
    school_id: SLOKA_SCHOOL_ID,
    name: 'Chief Operating Officer',
    email: 'coo@edcruiter.ai',
    role: 'FINAL_DECISION_MAKER'
  }
];

export const SLOKA_HR_POLICIES: HRPolicyDocument[] = [
  {
    id: 'policy_code_conduct',
    school_id: SLOKA_SCHOOL_ID,
    title: 'Teacher Code of Conduct & Child Safeguarding',
    content: `1. ZERO TOLERANCE FOR HARASSMENT & ABUSE: Strict zero tolerance for verbal, physical, or emotional abuse towards students.
2. WORKING HOURS: School hours are 7:45 AM to 3:45 PM Monday through Friday. Teachers report 15 mins prior to morning assembly.
3. PROBATION & NOTICE PERIOD: 6-month probation. Mandatory 60-day notice period post-confirmation. Resignations cannot occur mid-academic term.
4. LEAVE & CPD: Casual leaves and continuous professional development workshops are mandatory.`,
    category: 'safeguarding',
    uploaded_at: new Date().toISOString()
  }
];

export const DEFAULT_HR_POLICIES = SLOKA_HR_POLICIES;

export const DEFAULT_RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    id: 'rubric_written_theory',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    role_type: 'Teacher',
    subject: 'ALL',
    segment: 'ALL',
    dimensions: [
      { id: 'subject_depth', name: 'Core Subject Depth & Remediation', description: 'Degree of conceptual accuracy, identifying student misconceptions, and designing remedial scaffolding.', weight: 50 },
      { id: 'lesson_design', name: 'SMART Lesson Plan Design', description: '35-minute breakdown with clear learning outcomes, differentiation, and exit tickets.', weight: 50 }
    ]
  },
  {
    id: 'rubric_micro_demo',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    role_type: 'Teacher',
    subject: 'ALL',
    segment: 'ALL',
    dimensions: [
      { id: 'teaching_delivery', name: 'Teaching Delivery & Board Work', description: 'Vocal projection, screen/board presence, pacing, and clear pedagogical explanation.', weight: 50 },
      { id: 'student_engagement', name: 'Concept Scaffolding & Engagement', description: 'Active inquiry hooks, checking for understanding, and Socratic questioning.', weight: 50 }
    ]
  },
  {
    id: 'rubric_situational',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    role_type: 'Teacher',
    subject: 'ALL',
    segment: 'ALL',
    dimensions: [
      { id: 'situational_judgment', name: 'Situational Judgment & Conflict Resolution', description: 'Structured 3-step de-escalation protocol for classroom and parent management.', weight: 50 },
      { id: 'student_empathy', name: 'Empathy & Adolescent Containment', description: 'Active listening, emotional validation, and supporting distressed or anxious students.', weight: 50 }
    ]
  }
];

// MODULAR QUESTION BANK STRUCTURED BY 5 GRADE TIERS AND SUBJECTS
export const DEFAULT_QUESTIONNAIRES: QuestionnaireItem[] = [
  // ==========================================
  // 1. PRE-PRIMARY (3-6 yrs)
  // ==========================================
  {
    id: 'q_pre_written_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    subject: 'English',
    segment: 'Pre-primary (3–6 yrs)',
    type: 'case_study',
    question_text: 'A 4-year-old child consistently confuses the sounds of "b" and "d". Outline a 3-step multisensory activity (tactile/visual/auditory) using play-way or Montessori principles to correct this confusion without causing frustration.',
    rubric_hint: 'Candidate should outline tactile sand-tracing, auditory phonics songs, and visual color-coded flashcards.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_pre_demo_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    subject: 'English',
    segment: 'Pre-primary (3–6 yrs)',
    type: 'video_prompt',
    question_text: '5-Minute Micro-Teaching Demo: Teach the concept of "Rhyming Words" using a short rhyme, physical gestures, and expressive voice modulation as if directly facing a circle of 4-year-olds.',
    rubric_hint: 'Evaluates high energy, expressive voice modulation, TPR (Total Physical Response) gestures, and patience.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_pre_sit_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    subject: 'ALL',
    segment: 'Pre-primary (3–6 yrs)',
    type: 'video_prompt',
    question_text: 'Situational Video Response: During circle time, a child experiences intense separation anxiety, has a meltdown, and refuses to sit, causing two other children to start crying. Demonstrate and explain how you de-escalate and resume circle time within 2 minutes.',
    rubric_hint: 'Evaluates emotional containment, gentle physical reassuring stance, redirecting attention with a sensory toy, and calm tone.',
    created_at: new Date().toISOString()
  },

  // ==========================================
  // 2. PRIMARY (Grades 1-5, 6-11 yrs)
  // ==========================================
  {
    id: 'q_pri_written_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    subject: 'Math',
    segment: 'Primary (Grades 1–5, 6–11 yrs)',
    type: 'case_study',
    question_text: 'When introducing "Equivalent Fractions" to Grade 4 students, outline a concrete-to-abstract lesson progression using a hands-on activity (e.g. paper folding / pizza slice model) followed by a 2-question exit ticket.',
    rubric_hint: 'Evaluates Foundational Numeracy (FLN), gamified learning, concrete manipulation before algebraic notation.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_pri_demo_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    subject: 'Math',
    segment: 'Primary (Grades 1–5, 6–11 yrs)',
    type: 'video_prompt',
    question_text: '5-Minute Micro-Teaching Demo: Deliver a 5-minute teaching demo explaining the concept of "Place Value & Carry-Over Addition" to 2nd graders using visual board work and real-life analogies (e.g. bundling sticks/blocks).',
    rubric_hint: 'Evaluates board work clarity, positive reinforcement vocabulary, and engaging pacing for 7-year-olds.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_pri_sit_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    subject: 'ALL',
    segment: 'Primary (Grades 1–5, 6–11 yrs)',
    type: 'video_prompt',
    question_text: 'Situational Video Response: A parent approaches you angrily at dismissal, claiming their child is being excluded during playground games and that you are not paying sufficient attention. How do you respond empathetically while maintaining professional boundaries?',
    rubric_hint: 'Evaluates parent handling protocols: active listening without defensiveness, validating concern, proposing a 3-day observational log.',
    created_at: new Date().toISOString()
  },

  // ==========================================
  // 3. MIDDLE SCHOOL (Grades 6-8, 11-14 yrs)
  // ==========================================
  {
    id: 'q_mid_written_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    subject: 'Science',
    segment: 'Middle School (Grades 6–8, 11–14 yrs)',
    type: 'case_study',
    question_text: 'Explain how you would introduce the concept of "Photosynthesis & Cellular Respiration" (or "Variables & Loops" in Computer Science) to Grade 8 students using a real-life analogy from daily home life. Provide 1 diagnostic question targeting a common misconception.',
    rubric_hint: 'Evaluates inquiry-based framing, daily life analogies, and Bloom’s Taxonomy (Apply/Analyze) diagnostic checks.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_mid_demo_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    subject: 'Science',
    segment: 'Middle School (Grades 6–8, 11–14 yrs)',
    type: 'video_prompt',
    question_text: '5-Minute Micro-Teaching Demo: Demonstrate the conceptual difference between "Conductors vs. Insulators" (Science) OR "If-Else Conditional Logic" (Computer Science) on a whiteboard, assuming students have zero prior background.',
    rubric_hint: 'Evaluates board diagramming, Socratic questioning, and scaffolded progression.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_mid_sit_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    subject: 'ALL',
    segment: 'Middle School (Grades 6–8, 11–14 yrs)',
    type: 'video_prompt',
    question_text: 'Situational Video Response: During a collaborative lab project, two Grade 8 students accuse each other of not contributing, and one student slams their book and refuses to participate further. How do you resolve this conflict and restore group momentum?',
    rubric_hint: 'Evaluates adolescent behavioral containment, restorative conflict resolution, and objective task restructuring.',
    created_at: new Date().toISOString()
  },

  // ==========================================
  // 4. SECONDARY (Grades 9-10, 14-16 yrs)
  // ==========================================
  {
    id: 'q_sec_written_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    subject: 'Physics',
    segment: 'Secondary (Grades 9–10, 14–16 yrs)',
    type: 'case_study',
    question_text: 'Design a 35-minute lesson plan for "Newton\'s Third Law & Momentum Conservation". Include: 1. SMART learning objective mapped to CBSE/Cambridge standards, 2. A 5-min inquiry hook addressing why action-reaction pairs don\'t cancel out, 3. Tiered differentiation for struggling vs advanced learners, and 4. A 2-question exit ticket.',
    rubric_hint: 'Evaluates board exam alignment, high-yield conceptual scaffolding, error analysis, and 3-tier differentiation.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_sec_demo_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    subject: 'Physics',
    segment: 'Secondary (Grades 9–10, 14–16 yrs)',
    type: 'video_prompt',
    question_text: '5-Minute Micro-Teaching Demo: Deliver a 5-minute teaching demo explaining the derivation and graphical interpretation of "Kinematic Equations of Motion (v=u+at, s=ut+1/2at^2)" using chalkboard/smartboard presentation.',
    rubric_hint: 'Evaluates structured problem solving, clear graphical axes notation, and board exam pacing.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_sec_sit_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    subject: 'ALL',
    segment: 'Secondary (Grades 9–10, 14–16 yrs)',
    type: 'video_prompt',
    question_text: 'Situational Video Response: A student consistently performs poorly in Grade 10 mock exams and shows signs of severe exam anxiety, while their parents put extreme pressure on them for a 95%+ board score. How do you structure a joint student-parent counselling meeting to establish realistic academic remediation?',
    rubric_hint: 'Evaluates secondary counselling skills, structured remediation plans, managing parental expectations with objective data.',
    created_at: new Date().toISOString()
  },

  // ==========================================
  // 5. SENIOR SECONDARY (Grades 11-12, 16-18 yrs)
  // ==========================================
  {
    id: 'q_sr_written_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'written_theory',
    subject: 'Physics',
    segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
    type: 'case_study',
    question_text: 'Identify the single most common conceptual misconception students have in "Rotational Dynamics & Torque" (Physics) OR "Cash Flow from Operating Activities" (Accounts). Write the exact diagnostic question and step-by-step mathematical proof you would use to expose and resolve this misconception.',
    rubric_hint: 'Evaluates competitive domain rigor (JEE/NEET/Advanced Board), deductive mathematical proofs, and diagnostic precision.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_sr_demo_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'micro_teaching_demo',
    subject: 'Physics',
    segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
    type: 'video_prompt',
    question_text: '5-Minute Micro-Teaching Demo: Teach the derivation and physical mechanism of either "Lenz\'s Law & Electromagnetic Induction" (Physics), "Reaction Kinetics Rate Law" (Chemistry), or "Elasticity of Demand" (Economics) on a whiteboard.',
    rubric_hint: 'Evaluates advanced domain rigor, mathematical derivations, clear sign convention explanation, and competitive problem-solving focus.',
    created_at: new Date().toISOString()
  },
  {
    id: 'q_sr_sit_01',
    school_id: SLOKA_SCHOOL_ID,
    stage_key: 'situational_scenario',
    subject: 'ALL',
    segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
    type: 'video_prompt',
    question_text: 'Situational Video Response: A top-performing Grade 12 JEE/NEET aspirant complains that your classroom pacing is too slow because you spend too much time clarifying foundational doubts for average students. How do you address the student privately and balance classroom pacing?',
    rubric_hint: 'Evaluates handling high-achievers: providing advanced extension problem sets/mentoring while protecting foundational classroom equity.',
    created_at: new Date().toISOString()
  }
];
