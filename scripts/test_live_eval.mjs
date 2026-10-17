import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function testLiveEvaluation() {
  const evalPrompt = `
You are a strict, distinguished academic evaluation director assessing a candidate for a faculty role at a prestigious school.
CRITICALLY grade the submission according to the candidate's actual depth. If the response is superficial or lacks concrete examples, DO NOT give high scores.

Candidate: Radhika Sharma
Role: Physics Teacher (Secondary Grade 9-10)
Stage: lesson_plan
Submission Text / Dialogue:
"Topic: Newton's Laws of Motion. 35 mins. Warmup (5m): Coin on index card inertia demo. Direct Instruction (10m): F=ma formula and real life car crash safety inertia demo. Guided Practice (10m): Pairs calculate force for diverse rocket masses. Exit Ticket (10m): 2 conceptual questions testing action-reaction pairs."

ADHERE STRICTLY TO THIS RUBRIC:
1. curriculum_alignment (Weight 30%): SMART objectives mapped to grade 9-10 Physics standards.
2. structure_pacing (Weight 40%): 35-minute pacing across Warmup, Instruction, Guided Practice, and Exit Ticket.
3. differentiation (Weight 30%): Accommodations for diverse learners.

Output ONLY valid JSON with this exact schema:
{
  "stage": "lesson_plan",
  "scores": [
    {
      "dimension": "curriculum_alignment",
      "score": 8,
      "justification": "Detailed evidence rationale..."
    }
  ],
  "overall_flag": "strong_candidate",
  "evidence_reference": "Quote"
}
  `;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: evalPrompt
    });
    console.log('LIVE GEMINI EVALUATION RESULT:');
    console.log(res.text);
  } catch (err) {
    console.error('Error during live eval:', err);
  }
}

testLiveEvaluation();
