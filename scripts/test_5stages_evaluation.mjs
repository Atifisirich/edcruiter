import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function test5StageArchitecture() {
  console.log('--- Testing 5-Stage Universal Pedagogical Assessment Architecture ---');

  // Test Stage 2: Written / Theory for Pre-Primary English
  console.log('\nEvaluating Stage 2 (Pre-Primary English b/d confusion remediation)...');
  const stage2Prompt = `
You are an expert Academic Director evaluating a Pre-Primary English teacher candidate.

TASK: "A 4-year-old child consistently confuses the sounds of 'b' and 'd'. Outline a 3-step multisensory activity (tactile/visual/auditory) using play-way or Montessori principles to correct this confusion without causing frustration."

CANDIDATE SUBMISSION:
"1. Tactile: Sandpaper letter tracing with blindfold guessing to feel the directional curve of 'b' (bat before ball) vs 'd' (donut before stick).
2. Auditory/Kinesthetic: Phonics hopscotch where jumping right corresponds to /b/ sound and jumping left to /d/ sound.
3. Visual/Play: Color-coded tactile flashcards with animal mnemonic associations (B for Bear tummy, D for Duck tail)."

Output JSON with dimension scores (1-10), Danielson benchmark, and evidence:
{
  "scores": [
    { "dimension": "subject_depth", "score": 9, "justification": "...", "pedagogical_benchmark": "Danielson 1a" },
    { "dimension": "lesson_design", "score": 9, "justification": "...", "pedagogical_benchmark": "Danielson 1e" }
  ],
  "overall_flag": "strong",
  "evidence_quote": "..."
}
  `;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: stage2Prompt
    });
    console.log('Gemini Stage 2 Evaluation Output:');
    console.log(res.text);
  } catch (err) {
    console.error('Stage 2 Test error:', err);
  }
}

test5StageArchitecture();
