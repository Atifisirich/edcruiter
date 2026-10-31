import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PublicVacancy } from '@/lib/types';
import { cleanGrades, segmentFromGrades } from '@/lib/grades';
import { authErrorResponse, requireSchoolAccess, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'generate-job', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Generation limit reached for this hour.' }, { status: 429 });
    }

    const { title, subject, board, branch, target_branch_id, experience, salary_range } = body;
    // Exact grades, when given, decide the segment text.
    const grades = cleanGrades(body.grades);
    const segment = grades.length ? segmentFromGrades(grades) : body.segment;
    const schoolId = ctx.schoolId;
    const school = db.getSchoolById(schoolId);
    const schoolName = school?.name || 'this school';
    const branchRecord = school?.branches?.find((b) => b.id === target_branch_id);

    const subjectName = subject || 'Physics';
    const roleTitle = title || `${subjectName} Faculty`;
    const boardType = board || 'CBSE & Cambridge IGCSE';
    const segmentLevel = segment || 'Secondary (Grades 9-10)';
    const expBand = experience || '3 - 6 Years';
    // No more Manneguda-style fallback — a school with no branch selected
    // (or none configured yet) gets an honest blank rather than a campus
    // that belongs to a different school entirely.
    const campus = branchRecord?.name || branch || '';
    const campusLocation = branchRecord?.location || '';
    const ctcRange = salary_range || '₹7.5 LPA – ₹9.5 LPA';
    const jobId = `job_${Date.now()}`;

    // Structured AI Job Description & Assessment Generation
    const jobDescription = {
      id: jobId,
      title: roleTitle,
      subject: subjectName,
      segment: segmentLevel,
      ...(grades.length ? { grades } : {}),
      board: boardType,
      branch: campus,
      experience_required: expBand,
      salary_range: ctcRange,
      status: 'active',
      created_at: new Date().toISOString(),
      summary: `We are seeking an outstanding ${subjectName} Educator for our ${campus} to teach ${segmentLevel} aligned with ${boardType} standards. The ideal faculty possesses deep conceptual mastery, inquiry-based pedagogical techniques, and strong laboratory/visual scaffolding skills.`,
      responsibilities: [
        `Deliver high-impact daily classroom lessons adhering to ${boardType} curriculum frameworks.`,
        `Diagnose student conceptual misconceptions and implement 3-tier differentiated learning plans.`,
        `Conduct 5-minute diagnostic checks, formative exit tickets, and continuous board exam remediation.`,
        `Maintain modern laboratory safety protocols and integrate smartboard/digital learning simulations.`,
        `Participate in weekly Department Head (RM) curriculum pacing syncs and parent-teacher conferences.`
      ],
      requirements: [
        `Master's Degree (M.Sc / M.A.) in ${subjectName} from an accredited university.`,
        `B.Ed / M.Ed degree is mandatory; CTET / State TET certification preferred.`,
        `Minimum ${expBand} of demonstrated teaching success in reputed ${boardType} schools.`,
        `Demonstrated expertise in Bloom's Taxonomy, SMART lesson objectives, and Danielson Domain 3.`,
        `Fluency in English communication with strong voice projection and classroom leadership.`
      ],
      ai_assessment_rubric: {
        stage_1_mcqs: [
          {
            question: `Which pedagogical strategy is most effective for remediating core ${subjectName} misconceptions in Grade 10?`,
            options: [
              'Rote formula repetition and speed drills',
              'Concrete dual-concept free-body diagrams and Socratic counter-examples',
              'Skipping foundational theory and moving to advanced numericals',
              'Assigning extra textbook homework without in-class debrief'
            ],
            correct_answer: 1,
            rationale: 'Socratic counter-examples force cognitive dissonance to correct misconceptions.'
          },
          {
            question: `In a 35-minute ${boardType} lesson, what is the recommended time allocation for student inquiry vs direct instruction?`,
            options: [
              '30 min direct lecture, 5 min summary',
              '10 min hook/inquiry, 15 min guided practice, 10 min formative exit evaluation',
              '35 min continuous student silent reading',
              '25 min administrative roll call, 10 min quiz'
            ],
            correct_answer: 1,
            rationale: 'Active learning frameworks mandate balanced scaffolding and immediate formative assessment.'
          }
        ],
        stage_2_lesson_plan_topic: `${subjectName}: Core Foundations & Misconception Scaffolding`,
        stage_3_micro_teaching_prompt: `Deliver a 5-Minute Chalkboard Micro-Teaching Demo on introducing a foundational ${subjectName} concept to Grade 10 students. Address at least one common student misconception and conclude with a diagnostic check.`,
        proctoring_policy: 'MediaPipe 3D eye gaze mesh, secondary device detection, and fullscreen lockdown enforced.'
      },
      // The real, working job-board URL — not a fake per-subject "demo_"
      // candidate id that never corresponded to an actual record. This is
      // the link an admin copy-pastes straight into a message to a real
      // candidate, so it has to actually go somewhere.
      shareable_candidate_link: `/jobs/${jobId}`,
      whatsapp_invite_template: `*Teaching Opportunity at ${schoolName}*\n\nDear Candidate,\n\nWe have an opening for *${roleTitle}*${campus ? ` at our *${campus}*` : ''}.\n\nPlease complete your assessment here:\n\n👉 ${process.env.NEXT_PUBLIC_APP_URL || 'https://edcruiter.ai'}/jobs/${jobId}\n\nRequirements: Quiet room, working webcam & microphone.\nDuration: approximately 30 minutes.`
    };

    const vacancy: PublicVacancy = {
      id: jobDescription.id,
      school_id: schoolId,
      school_name: schoolName,
      school_type: school?.curriculum_guidelines?.board || boardType,
      title: roleTitle,
      subject: subjectName,
      segment: segmentLevel,
      ...(grades.length ? { grades } : {}),
      board: boardType,
      // Left blank rather than a hardcoded 'Hyderabad, Telangana' when the
      // selected branch has no location on file — a school outside
      // Hyderabad should never see that city on their own job posting.
      location: campusLocation,
      branch: campus,
      target_branch_id: target_branch_id || undefined,
      experience_required: expBand,
      salary_range: ctcRange,
      posted_date: 'Just now',
      description: jobDescription.summary,
      responsibilities: jobDescription.responsibilities,
      requirements: jobDescription.requirements,
      // No hardcoded perks list — 'Campus Housing', 'Child Tuition Waiver'
      // etc. were claimed on every posting regardless of whether a given
      // school actually offers them. A school can add real ones by editing
      // the description directly.
      is_verified: true,
      status: 'active',
      created_at: jobDescription.created_at
    };

    const saved = db.createJob(vacancy);

    return NextResponse.json({ success: true, job: { ...jobDescription, ...saved } });
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate job description' },
      { status: 500 }
    );
  }
}
