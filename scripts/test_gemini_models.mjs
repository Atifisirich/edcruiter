import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function test() {
  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-flash-lite-latest', 'gemini-pro-latest'];
  for (const m of models) {
    try {
      console.log(`Testing model: ${m}...`);
      const response = await ai.models.generateContent({
        model: m,
        contents: 'Say hello and confirm you are online in 5 words.'
      });
      console.log(`SUCCESS [${m}]:`, response.text?.trim());
      return m;
    } catch (err) {
      console.error(`FAILED [${m}]:`, err.message || err);
    }
  }
}

test();
