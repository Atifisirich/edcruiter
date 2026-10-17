import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function listModels() {
  try {
    const list = await ai.models.list();
    console.log('Available models:');
    for await (const m of list) {
      console.log(`- ${m.name}`);
    }
  } catch (err) {
    console.error('List models error:', err);
  }
}

listModels();
