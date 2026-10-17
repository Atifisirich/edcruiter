import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function test() {
  const models = ['gemini-3.5-flash', 'gemini-3.7-flash', 'gemini-pro-latest', 'gemini-flash-lite-latest'];
  for (const m of models) {
    try {
      console.log(`Testing model: ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: 'Evaluate this candidate statement: "I use inquiry experiments to teach inertia". Output 1 sentence evaluation.'
      });
      console.log(`SUCCESS [${m}]:`, response.text?.trim());
    } catch (err) {
      console.error(`FAILED [${m}]:`, err.message || err);
    }
  }
}

test();
