import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function test5Pillars() {
  console.log('Testing 5-Pillar Evaluation with Gemini AI...');

  const cotPrompt = `
You are a senior academic evaluation director assessing a candidate for Physics Teacher (Secondary Grade 9 – 10).
Adhere strictly to Danielson Domain 1 (Planning & Preparation) & Bloom's Taxonomy.

CANDIDATE SUBMISSION:
- Candidate Name: Dr. Priya Sharma
- Stage: lesson_plan
- Text:
"""
Topic: Newton's Third Law & Momentum Conservation in Collisions.
Duration: 35 Minutes.
Grade Level: Grade 9 CBSE/Cambridge.
SMART Objective: By end of lesson, students will mathematically calculate recoil velocity using F1=-F2 and predict velocity post-collision with 90% accuracy.
Warmup (5m): Visual inquiry video of skateboard recoil; pairs generate 1 physical analogy.
Direct Instruction (10m): Socratic derivation of action-reaction pairs acting on separate distinct free-body diagrams (addressing common misconception that they cancel out).
Guided Practice (10m): Differentiated tiered worksheets (Tier 1: scaffolded vector steps; Tier 2: multi-mass collision problem; Tier 3: extension rocket propulsion problem).
Exit Ticket (10m): 2 conceptual questions testing action-reaction pair identification in car bumper collisions.
"""

SCHOOL SPECIFIC CURRICULUM GUIDELINES:
- Board / Curriculum: CBSE & Cambridge IGCSE
- School Pedagogical Philosophy: Inquiry-Based Learning, Conceptual Rigor & Differentiated Instruction
- Focus Areas: Hands-on Demonstrations, Misconception Diagnosis, Socratic Scaffolding, Bloom Analysis Questions

CHAIN-OF-THOUGHT (CoT) EVALUATION INSTRUCTIONS:
Step 1. EVIDENCE: Extract 1-2 exact quotes or observable behaviors from the candidate.
Step 2. GAP ANALYSIS: Identify what specific pedagogical techniques were missing.
Step 3. BLOOM'S TAXONOMY: Determine the cognitive level demonstrated (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating).
Step 4. CALIBRATED SCORING (1-10):
  - 9-10: Master Teacher (Extensive scaffolding, inquiry hooks, differentiated tasks)
  - 7-8: Proficient (Solid concept delivery, standard pacing)
  - 4-6: Developing (Textbook definitions only, weak interaction)
  - 1-3: Ineffective (Incorrect subject facts, gibberish, or zero differentiation)

Output ONLY valid JSON with this exact schema:
{
  "stage": "lesson_plan",
  "pedagogical_framework": "Danielson Domain 1 & Bloom's Taxonomy",
  "blooms_taxonomy_level": "Creating",
  "evidence_quote": "Direct quote",
  "identified_gaps": ["gap 1"],
  "scores": [
    {
      "dimension": "curriculum_alignment",
      "score": 9,
      "justification": "Detailed justification...",
      "pedagogical_benchmark": "Danielson 1c"
    }
  ],
  "overall_flag": "strong_candidate",
  "evidence_reference": "Summary reference"
}
  `;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: cotPrompt
    });

    console.log('\n--- REAL GEMINI 5-PILLAR EVALUATION RESULT ---');
    console.log(res.text);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test5Pillars();
