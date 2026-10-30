import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { QuestionnaireItem, StageKey } from '@/lib/types';
import { authErrorResponse, requireSchoolAccess, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Rich Domain Fallback Generators for Educator Assessments
interface GeneratedQuestion {
  id?: string;
  stage_key: StageKey;
  subject: string;
  segment: string;
  type: 'mcq' | 'case_study' | 'video_prompt';
  question_text: string;
  options?: string[];
  correct_option?: string;
  rubric_hint?: string;
  blooms_level?: string;
  difficulty?: string;
}

function generateFallbackQuestions(
  classSegment: string,
  subject: string,
  difficulty: string,
  testType: string,
  board: string,
  count: number = 3
): GeneratedQuestion[] {
  const isPrimary = classSegment.toLowerCase().includes('primary') || classSegment.toLowerCase().includes('early');
  const isSenior = classSegment.toLowerCase().includes('senior') || classSegment.toLowerCase().includes('11') || classSegment.toLowerCase().includes('12');
  
  const pool: GeneratedQuestion[] = [];

  // 1. Subject Knowledge & Concept Rigor MCQ
  if (testType === 'subject_mcq' || testType === 'comprehensive_blend') {
    if (subject.toLowerCase().includes('physics')) {
      pool.push({
        stage_key: 'written_theory',
        subject,
        segment: classSegment,
        type: 'mcq',
        question_text: isSenior 
          ? `A dielectric slab (κ = 4.5) is inserted into a capacitor connected to a constant voltage DC power supply. Which statement accurately describes the resulting physical changes?`
          : `A student argues that when a horse pulls a cart, Newton's 3rd Law means the cart pulls back with equal force, so no movement can occur. How do you explain why acceleration occurs?`,
        options: isSenior 
          ? [
              'Charge on plates increases by factor κ; Electric field remains constant; Stored energy increases',
              'Charge remains constant; Electric field decreases by factor κ; Stored energy decreases',
              'Potential difference across plates increases; Stored energy decreases',
              'Capacitance decreases; Stored energy remains invariant'
            ]
          : [
              'Action and reaction forces act on two completely different objects, so net force on the cart alone is unbalanced',
              'The horse exerts a larger internal force than the cart can exert in return',
              'Newton\'s 3rd Law only applies once the object has reached terminal velocity',
              'Frictional force on the cart cancel out the reaction force on the horse'
            ],
        correct_option: isSenior 
          ? 'Charge on plates increases by factor κ; Electric field remains constant; Stored energy increases'
          : 'Action and reaction forces act on two completely different objects, so net force on the cart alone is unbalanced',
        rubric_hint: 'Evaluates conceptual rigor in Newton\'s laws vs common student vector misunderstandings',
        blooms_level: 'Analyzing'
      });
    } else if (subject.toLowerCase().includes('math')) {
      pool.push({
        stage_key: 'written_theory',
        subject,
        segment: classSegment,
        type: 'mcq',
        question_text: isPrimary
          ? `When teaching place value to Grade 3 students, why is using base-ten manipulatives conceptually superior to teaching the traditional carry-over algorithm first?`
          : `When solving the quadratic inequality (x - 3)(x + 5) < 0, what is the most robust graphical or sign-chart representation you use to prevent sign confusion?`,
        options: isPrimary
          ? [
              'It provides concrete visual grounding that 10 units physically group into 1 ten before abstract symbol manipulation',
              'It helps students memorize standard multiplication tables faster',
              'It eliminates the need for students to write down mathematical symbols entirely',
              'It prepares them directly for algebraic factorizations'
            ]
          : [
              'Testing critical test intervals on a continuous number line showing roots at -5 and 3 with alternating parabola concavity',
              'Multiplying both sides by (x - 3) to isolate x without verifying interval positivity',
              'Setting each factor < 0 independently and taking their algebraic union',
              'Directly substituting random large integers into the quadratic formula'
            ],
        correct_option: isPrimary
          ? 'It provides concrete visual grounding that 10 units physically group into 1 ten before abstract symbol manipulation'
          : 'Testing critical test intervals on a continuous number line showing roots at -5 and 3 with alternating parabola concavity',
        rubric_hint: 'Assesses instructional clarity in bridging concrete models to abstract mathematical logic',
        blooms_level: 'Understanding'
      });
    } else if (subject.toLowerCase().includes('computer') || subject.toLowerCase().includes('ai')) {
      pool.push({
        stage_key: 'written_theory',
        subject,
        segment: classSegment,
        type: 'mcq',
        question_text: `When introducing Object-Oriented Programming (OOP) principles to ${classSegment} students, what real-world analogy best contrasts 'Class' versus 'Object Instance'?`,
        options: [
          'Blueprint of a house (Class) vs Actual physical houses constructed in a neighborhood (Object Instances)',
          'Variable name (Class) vs Memory address hex pointer (Object)',
          'Hard drive storage (Class) vs RAM cache bus (Object)',
          'Compiler bytecode (Class) vs Python interpreter binary (Object)'
        ],
        correct_option: 'Blueprint of a house (Class) vs Actual physical houses constructed in a neighborhood (Object Instances)',
        rubric_hint: 'Tests ability to demystify abstract CS architecture for students',
        blooms_level: 'Understanding'
      });
    } else {
      pool.push({
        stage_key: 'written_theory',
        subject,
        segment: classSegment,
        type: 'mcq',
        question_text: `Under ${board} curriculum guidelines for ${subject} (${classSegment}), what is the primary pedagogical purpose of a Formative Diagnostic Entry Ticket?`,
        options: [
          'To identify prior knowledge gaps and common student misconceptions before initiating direct instruction',
          'To calculate weighted grading scores for end-of-term report cards',
          'To rank student percentiles in ascending order for classroom seating arrangements',
          'To satisfy annual administrative board compliance checklists'
        ],
        correct_option: 'To identify prior knowledge gaps and common student misconceptions before initiating direct instruction',
        rubric_hint: 'Assesses modern formative assessment mastery and NEP 2020 competency focus',
        blooms_level: 'Applying'
      });
    }
  }

  // 2. Pedagogical Misconception & Socratic Inquiry Case Study
  if (testType === 'pedagogy_case_study' || testType === 'comprehensive_blend') {
    pool.push({
      stage_key: 'written_theory',
      subject,
      segment: classSegment,
      type: 'case_study',
      question_text: `[Case Study]: During a 40-minute ${subject} lesson in ${classSegment}, half the class makes a persistent conceptual error on today's core learning objective. Outline your exact 3-step intervention plan: (1) Socratic diagnostic questions to make students discover the contradiction themselves, (2) Differentiated scaffolding for struggling vs advanced learners, and (3) Formative exit check to verify 100% mastery before class ends.`,
      rubric_hint: 'Evaluate for: (a) Clear diagnostic questioning rather than lecturing, (b) Actionable differentiation strategies, (c) Time-bound exit ticket methodology.',
      blooms_level: 'Evaluating'
    });
  }

  // 3. Classroom Crisis & Situational Judgment
  if (testType === 'situational_crisis' || testType === 'comprehensive_blend') {
    pool.push({
      stage_key: 'situational_scenario',
      subject,
      segment: classSegment,
      type: 'case_study',
      question_text: `[Classroom Management Scenario]: While conducting a collaborative group activity in ${classSegment}, two students enter a heated disagreement over group roles and refuse to participate, distracting neighboring tables. Simultaneously, a parent sends an urgent message questioning their child's recent grade. How do you de-escalate the immediate classroom disruption within 60 seconds while preserving an emotionally safe learning environment?`,
      rubric_hint: 'Check for: Restorative justice techniques, non-punitive de-escalation, clear classroom norms, professional boundary management.',
      blooms_level: 'Applying'
    });
  }

  // 4. Micro-Teaching Demo Video Prompt
  if (testType === 'micro_teaching_prompt' || testType === 'comprehensive_blend') {
    pool.push({
      stage_key: 'micro_teaching_demo',
      subject,
      segment: classSegment,
      type: 'video_prompt',
      question_text: `[5-Minute Micro-Teaching Demo]: Deliver a concise, energetic 5-minute teaching demonstration on a challenging core topic in ${subject} for ${classSegment} students (${board} aligned). Assume the camera is your classroom of 30 curious students. Your demo MUST include: (1) An inquiry-driven 60-second real-world hook, (2) Dual coding (drawing/visual chalkboard diagram), (3) Socratic student engagement check.`,
      rubric_hint: 'Assessed on: Vocal projection & modulation (120-140 WPM), screen/board utilization, pedagogical hook power, and conceptual precision.',
      blooms_level: 'Creating'
    });
  }

  return pool.slice(0, count);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ctx = await requireSchoolAccess(body.school_id, { minRole: 'SCHOOL_ADMIN' });
    assertSchoolActive(ctx.schoolId);
    const rl = checkRateLimit(req, 'generate-test', { max: 30, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Generation limit reached for this hour.' }, { status: 429 });
    }

    const school_id = ctx.schoolId;
    const {
      classSegment = 'Secondary (Grades 9-10)',
      subject = 'Physics',
      difficulty = 'Experienced TGT (3-5 yrs)',
      testType = 'comprehensive_blend',
      board = 'CBSE',
      numQuestions = 4,
      customFocus = '',
      autoSave = false
    } = body;

    let generatedQuestions: GeneratedQuestion[] = [];

    // Attempt Gemini AI generation if API key is available
    if (ai) {
      try {
        const prompt = `
You are an expert Academic Director, K-12 Curriculum Specialist, and AI Teacher Recruitment Evaluator.
Generate a structured, rigorous assessment test for hiring an educator with the following parameters:

- Class / Grade Bracket: ${classSegment}
- Subject: ${subject}
- Target Board / Curriculum: ${board}
- Experience & Difficulty Level: ${difficulty}
- Assessment Format / Focus: ${testType}
${customFocus ? `- Specific Topic / Focus Areas: ${customFocus}` : ''}
- Total Questions to Generate: ${numQuestions}

REQUIREMENTS:
1. Generate high-quality pedagogical and subject-matter assessment items tailored to this exact grade level and subject.
2. Include appropriate question types:
   - 'mcq' (Multiple Choice with 4 options, clear correct_option, and explanation rubric)
   - 'case_study' (Open-ended realistic teaching scenario requiring pedagogical depth)
   - 'video_prompt' (5-minute micro-teaching prompt with structured delivery expectations)
3. Return STRICTLY a valid JSON array of question objects with NO surrounding markdown or extra text.

JSON Schema format:
[
  {
    "stage_key": "written_theory",
    "subject": "${subject}",
    "segment": "${classSegment}",
    "type": "mcq" | "case_study" | "video_prompt",
    "question_text": "...",
    "options": ["Option A", "Option B", "Option C", "Option D"], // required for mcq only
    "correct_option": "Option A", // required for mcq only
    "rubric_hint": "Criteria used by AI and HOD to evaluate the response",
    "blooms_level": "Remembering" | "Understanding" | "Applying" | "Analyzing" | "Evaluating" | "Creating",
    "difficulty": "${difficulty}"
  }
]
`;

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt
          });
        } catch (e) {
          response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt
          });
        }

        const rawText = response.text || '';
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedQuestions = parsed.map((item, idx) => ({
              ...item,
              stage_key: item.type === 'video_prompt' ? 'micro_teaching_demo' : (item.stage_key || 'written_theory'),
              subject: item.subject || subject,
              segment: item.segment || classSegment
            }));
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini generation fallback triggered:', geminiErr);
      }
    }

    // If Gemini was offline or didn't generate enough questions, use curated domain fallback
    if (generatedQuestions.length === 0) {
      generatedQuestions = generateFallbackQuestions(
        classSegment,
        subject,
        difficulty,
        testType,
        board,
        numQuestions
      );
    }

    // Auto-save to school database if requested
    let savedItems: QuestionnaireItem[] = [];
    if (autoSave) {
      savedItems = generatedQuestions.map(q => {
        return db.addOrUpdateQuestionnaire({
          id: `q_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          school_id,
          stage_key: q.stage_key,
          subject: q.subject,
          segment: q.segment,
          type: q.type,
          question_text: q.question_text,
          options: q.options,
          correct_option: q.correct_option,
          rubric_hint: q.rubric_hint ? `[Bloom: ${q.blooms_level || 'Applying'}] ${q.rubric_hint}` : undefined,
          created_at: new Date().toISOString()
        });
      });
    }

    return NextResponse.json({
      success: true,
      questions: generatedQuestions,
      savedCount: savedItems.length,
      savedItems,
      meta: {
        classSegment,
        subject,
        difficulty,
        testType,
        board,
        generatedWithAi: !!ai
      }
    });

  } catch (err) {
    const authResponse = authErrorResponse(err);
    if (authResponse) return authResponse;
    console.error('Error generating AI test:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to generate assessment test' }, { status: 500 });
  }
}
