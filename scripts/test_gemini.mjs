import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function test() {
  console.log('Testing Gemini API with key...');
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
  for (const model of modelsToTry) {
    try {
      console.log(`Trying model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: 'Say hello in 5 words.'
      });
      console.log(`SUCCESS with ${model}:`, response.text);
      return model;
    } catch (err) {
      console.error(`Error with ${model}:`, err.message || err);
    }
  }
}

test();
