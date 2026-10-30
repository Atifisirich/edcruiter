import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { authErrorResponse, requireCandidate, assertSchoolActive } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Heuristic check for nonsensical, evasive, or disrespectful answers
function evaluateAnswerSeriousness(answer: string): { isSerious: boolean; feedbackReason?: string } {
  const clean = answer.trim().toLowerCase();
  
  if (clean.length < 15) {
    return { isSerious: false, feedbackReason: 'Your answer is extremely brief and lacks explanation.' };
  }

  const profanities = ['bullshit', 'shit', 'fuck', 'damn', 'bitch', 'asshole', 'crap', 'garbage', 'stupid'];
  if (profanities.some(p => clean.includes(p))) {
    return { isSerious: false, feedbackReason: 'Your response contained unprofessional language.' };
  }

  const gibberishKeywords = ['asdf', 'qwerty', 'idk', 'dont know', 'no idea', 'nothing', 'bla bla', 'whatever', 'test'];
  if (gibberishKeywords.some(g => clean.includes(g))) {
    return { isSerious: false, feedbackReason: 'Your response appears evasive or placeholder text.' };
  }

  // Check for repeated single character sequences (e.g. "aaaaaa", "zzzzz")
  if (/(.)\1{4,}/.test(clean)) {
    return { isSerious: false, feedbackReason: 'Your answer contains repeated character gibberish.' };
  }

  return { isSerious: true };
}

// 4 Structured Pedagogical Interview Rounds
const ROUND_QUESTIONS: Record<number, (subject: string, segment: string) => string> = {
  1: (subject, segment) =>
    `When introducing a challenging new concept in ${subject}, what specific inquiry-based demonstration, real-world hook, or manipulative do you use to engage ${segment} students from minute one?`,

  2: (subject, segment) =>
    `In ${subject} for ${segment}, what is one persistent student misconception you encounter, and what exact step-by-step Socratic questioning do you use to help students discover their own error?`,

  3: (subject, segment) =>
    `In a mixed-ability ${segment} classroom, how do you differentiate your instruction in ${subject} so that students with foundational learning gaps receive scaffolding while advanced learners remain challenged?`,

  4: (subject, segment) =>
    `How do you conduct rapid, continuous formative assessment during a 35-minute ${subject} period to verify every student has mastered the learning objective before the bell rings?`
};

export async function POST(req: NextRequest) {
  try {
    // Requires a live candidate session — this route makes a paid Gemini
    // call per turn and previously had no auth at all.
    const access = await requireCandidate();
    assertSchoolActive(access.schoolId);
    const rl = checkRateLimit(req, 'ai-interview', { max: 40, windowMs: 60 * 60_000 });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many interview turns this hour.' }, { status: 429 });
    }

    const body = await req.json();
    const {
      candidateName = 'Candidate',
      appliedSubject = 'Physics',
      appliedSegment = 'Secondary (Grades 9-10)',
      roundIndex = 1,
      history = []
    } = body;

    const currentRound = Math.min(Math.max(1, Number(roundIndex)), 4);
    const lastMessage = history[history.length - 1]?.text || '';
    const { isSerious, feedbackReason } = evaluateAnswerSeriousness(lastMessage);

    // If candidate gave a non-serious / gibberish answer, challenge them directly!
    if (!isSerious && history.length > 1) {
      const critique = `Candidate, ${feedbackReason} In an academic faculty evaluation, genuine pedagogical rigor is required. Let us refocus: ${ROUND_QUESTIONS[currentRound](appliedSubject, appliedSegment)}`;
      return NextResponse.json({
        nextQuestion: critique,
        roundIndex: currentRound,
        isAiGenerated: false,
        wasFlagged: true
      });
    }

    // If Gemini AI API key is configured, generate dynamic contextual follow-up
    if (ai) {
      try {
        const roundTopics = [
          'Pedagogical Engagement & Hook Strategy',
          'Addressing Subject Misconceptions & Conceptual Depth',
          'Scaffolding & Differentiated Instruction',
          'Formative Assessment & Real-World Application'
        ];

        const targetTopic = roundTopics[currentRound - 1] || roundTopics[0];

        const prompt = `
You are a rigorous, distinguished School Principal & AI Teacher Evaluator at a top accredited school.
You are evaluating a candidate applying for the position of ${appliedSubject} Faculty (${appliedSegment}).

Candidate Name: ${candidateName}
Current Stage: Round ${currentRound} of 4: "${targetTopic}"

Candidate's Latest Response: "${lastMessage}"

Conversation History:
${JSON.stringify(history)}

Instructions:
1. CRITICALLY ANALYZE what the candidate said.
   - If they gave strong, specific pedagogical strategies, acknowledge the specific technique they mentioned in 1 sharp sentence.
   - If their answer was generic, superficial, or lacked subject depth, critically point out what was missing in 1 sentence.
2. Formulate 1 probing, high-impact interview question specifically focused on "${targetTopic}" for ${appliedSubject} students in ${appliedSegment}.
3. Keep the total response between 35 and 60 words.
4. Output plain conversational text only. Do NOT use bullet points or markdown headings.
        `;

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt
          });
        } catch (mErr) {
          response = await ai.models.generateContent({
            model: 'gemini-flash-lite-latest',
            contents: prompt
          });
        }

        const generatedText = response.text?.trim();
        if (generatedText && generatedText.length > 15) {
          return NextResponse.json({
            nextQuestion: generatedText,
            roundIndex: currentRound,
            isAiGenerated: true
          });
        }
      } catch (geminiErr) {
        console.warn('Gemini API query error, using structured fallback:', geminiErr);
      }
    }

    // Structured Fallback with intelligent candidate reflection
    const nextQPrompt = ROUND_QUESTIONS[currentRound] ? ROUND_QUESTIONS[currentRound](appliedSubject, appliedSegment) : ROUND_QUESTIONS[1](appliedSubject, appliedSegment);
    
    let acknowledgment = '';
    if (currentRound === 2) {
      acknowledgment = `Noted regarding your engagement approach. Moving to conceptual clarity: `;
    } else if (currentRound === 3) {
      acknowledgment = `Regarding addressing student misconceptions, let's examine mixed-ability classrooms: `;
    } else if (currentRound === 4) {
      acknowledgment = `Understood on your scaffolding strategy. For our final round on real-time evaluation: `;
    }

    return NextResponse.json({
      nextQuestion: `${acknowledgment}${nextQPrompt}`,
      roundIndex: currentRound,
      isAiGenerated: false
    });

  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    console.error('AI interview error:', error);
    return NextResponse.json({
      nextQuestion: `Please share how you ensure student understanding in your subject.`,
      roundIndex: 1,
      isAiGenerated: false
    });
  }
}
