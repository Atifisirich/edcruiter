/**
 * Fills the platform question bank (src/lib/bank/*.json) using Gemini, and
 * double-checks every question before keeping it.
 *
 *   node --env-file=.env.local scripts/generate-question-bank.mjs [options]
 *
 *   --max-calls N     stop after N Gemini calls this run (default 100). The bank is
 *                     saved after every batch, so the next run carries on from there.
 *   --only NAME       one subject only, for example mathematics
 *   --grades 6-8      only these grades, for example 6-8 or 4,9
 *   --target N        questions wanted per subject and grade (default 60)
 *   --pedagogy-target N  teaching-practice questions wanted in total (default 120)
 *   --pause MS        wait between calls (default 4500)
 *   --dry-run         show what would be done, call nothing
 *
 * How a question is kept:
 *   1. Gemini writes a batch of questions for one subject and grade.
 *   2. Anything malformed, or too like a question already in the bank, is dropped.
 *   3. A second, separate call answers every question without seeing the key.
 *      Only questions where it picks the same answer, and does not call the
 *      question ambiguous, are kept.
 * A human should still spot-check a sample before this goes in front of candidates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK_DIR = path.join(ROOT, 'src', 'lib', 'bank');
const REPORT = path.join(ROOT, 'scripts', 'bank-report.json');

// subject file -> what is taught, and in which grades
const PLAN = [
  { key: 'english', file: 'english', prefix: 'eng', name: 'English', grades: range(1, 12), note: 'grammar, vocabulary, spelling, punctuation, comprehension of a SHORT passage written inside the question (two sentences at most), literature and writing skills, as taught in Indian schools' },
  { key: 'mathematics', file: 'mathematics', prefix: 'mat', name: 'Mathematics', grades: range(1, 12), note: 'the NCERT-style syllabus for the grade; include worked numerical problems with a single numeric answer, and common student errors' },
  { key: 'hindi', file: 'hindi', prefix: 'hin', name: 'Hindi', grades: range(1, 12), language: 'Hindi, written in Devanagari script', note: 'vyakaran (grammar), shabd bhandar, muhavare, patan samajh of a short passage inside the question, and sahitya, as taught in Indian schools' },
  { key: 'environmental studies', file: 'environmental-studies', prefix: 'evs', name: 'Environmental Studies (EVS)', grades: range(1, 5), note: 'the EVS syllabus for the grade: plants, animals, food, water, family, community, shelter, our environment' },
  { key: 'general science', file: 'general-science', prefix: 'sci', name: 'General Science', grades: range(3, 8), note: 'the combined science syllabus (physics, chemistry and biology topics) for the grade' },
  { key: 'social studies', file: 'social-studies', prefix: 'sst', name: 'Social Studies / Social Science', grades: range(6, 10), note: 'history, geography, civics (political science) and economics topics for the grade, with an Indian focus, as in the NCERT syllabus' },
  { key: 'physics', file: 'physics', prefix: 'phy', name: 'Physics', grades: range(9, 12), note: 'the NCERT physics syllabus for the grade; include numerical problems with one numeric answer' },
  { key: 'chemistry', file: 'chemistry', prefix: 'che', name: 'Chemistry', grades: range(9, 12), note: 'the NCERT chemistry syllabus for the grade; include numerical problems with one numeric answer' },
  { key: 'biology', file: 'biology', prefix: 'bio', name: 'Biology', grades: range(9, 12), note: 'the NCERT biology syllabus for the grade' },
  { key: 'computer science', file: 'computer-science', prefix: 'cs', name: 'Computer Science / Computer Applications', grades: range(3, 12), note: 'computer basics, software, internet safety, algorithms, flowcharts, spreadsheets, databases and basic programming concepts suited to the grade; short code reading is fine, but no images' },
];

const PEDAGOGY_TOPICS = [
  'Classroom management and routines', 'Responding to student answers and misconceptions', 'Checking for understanding during a lesson',
  'Differentiation for mixed-ability classes', 'Inclusion and supporting students with learning difficulties', 'Child safeguarding and protection',
  'Working with parents', 'Giving feedback and assessing learning', 'Lesson planning and learning objectives', 'Professional ethics and conduct',
  'Using technology in teaching', 'Motivating students and building a positive culture',
];

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
}

// ---------------------------------------------------------------- options
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const MAX_CALLS = Number(opt('max-calls', 100));
const TARGET = Number(opt('target', 60));
const PED_TARGET = Number(opt('pedagogy-target', 120));
const PAUSE = Number(opt('pause', 4500));
const ONLY = opt('only', '');
const DRY = args.includes('--dry-run');
const GRADE_FILTER = (() => {
  const g = opt('grades', '');
  if (!g) return null;
  const m = /^(\d+)-(\d+)$/.exec(g);
  return m ? range(Number(m[1]), Number(m[2])) : g.split(',').map((x) => x.trim());
})();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && !DRY) {
  console.error('GEMINI_API_KEY is not set. Run with: node --env-file=.env.local scripts/generate-question-bank.mjs');
  process.exit(1);
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

let calls = 0;
const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : { runs: [], totals: { written: 0, kept: 0, dropped_invalid: 0, dropped_duplicate: 0, dropped_unverified: 0 } };
const run = { started: new Date().toISOString(), calls: 0, kept: 0, written: 0, stopped: '' };

class QuotaStop extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Gemini
async function ask(prompt, { temperature = 0.7 } = {}) {
  if (calls >= MAX_CALLS) throw new QuotaStop(`reached --max-calls ${MAX_CALLS}`);
  for (const model of ['gemini-3.5-flash', 'gemini-flash-lite-latest']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      calls += 1;
      run.calls = calls;
      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json', temperature },
        });
        await sleep(PAUSE);
        const text = (res.text || '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        return JSON.parse(text);
      } catch (err) {
        const msg = String(err?.message || err);
        const quota = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
        if (quota && /per day|daily|PerDay/i.test(msg)) throw new QuotaStop('the daily Gemini quota is used up');
        if (quota) {
          console.log('  Gemini asked us to slow down; waiting 40 seconds...');
          await sleep(40000);
          continue;
        }
        if (err instanceof SyntaxError) continue; // bad JSON: try again
        console.log(`  ${model} failed: ${msg.slice(0, 120)}`);
        break; // try the next model
      }
      if (calls >= MAX_CALLS) throw new QuotaStop(`reached --max-calls ${MAX_CALLS}`);
    }
  }
  throw new QuotaStop('Gemini is not answering');
}

// ---------------------------------------------------------------- helpers
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 2));
function tooSimilar(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 || wb.size === 0) return false;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / (wa.size + wb.size - both) >= 0.75;
}

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clean(item) {
  if (!item || typeof item !== 'object') return null;
  const q = typeof item.question === 'string' ? item.question.trim() : '';
  const a = typeof item.correct === 'string' ? item.correct.trim() : '';
  const w = Array.isArray(item.wrong) ? item.wrong.map((x) => String(x ?? '').trim()).filter(Boolean) : [];
  const topic = typeof item.topic === 'string' ? item.topic.trim().slice(0, 60) : '';
  if (q.length < 15 || !a || w.length !== 3 || !topic) return null;
  const all = [a, ...w].map((x) => x.toLowerCase());
  if (new Set(all).size !== 4) return null;
  if (/all of the above|none of the above|both a and b/i.test(all.join('|'))) return null;
  // The test screen shows plain text, so markup would appear as stray symbols.
  if (/<\/?[a-z][^>]*>|\*\*|```|!\[/i.test([q, a, ...w].join(' '))) return null;
  return { q, a, w, topic, e: typeof item.explanation === 'string' ? item.explanation.trim().slice(0, 240) : '' };
}

function loadBank(file) {
  const p = path.join(BANK_DIR, `${file}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
}
function saveBank(file, bank) {
  // One question per line, so a change shows up clearly when the file is reviewed.
  fs.writeFileSync(path.join(BANK_DIR, `${file}.json`), `[\n${bank.map((q) => '  ' + JSON.stringify(q)).join(',\n')}\n]\n`);
}
function nextNumber(bank, prefix) {
  let max = 0;
  for (const q of bank) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(q.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

// ---------------------------------------------------------------- prompts
function writePrompt({ name, note, language, grade, count, existing, topicsHint }) {
  const seen = existing.slice(-40).map((q) => `- ${q.q.slice(0, 110)}`).join('\n');
  return `You are an experienced Indian school examiner writing a bank of multiple-choice questions used to test TEACHERS applying for a ${name} teaching post.

Write exactly ${count} multiple-choice questions on ${name} for GRADE ${grade} (Indian CBSE/NCERT-style syllabus; ICSE and state boards cover the same ideas).
Content: ${note}.
${language ? `Language: ${language}.\n` : ''}
The questions test the teacher's own command of what they teach at this grade: about 70% apply the grade's content, and about 30% go slightly deeper or test common student misconceptions.

Rules:
- Exactly one option is correct and clearly correct to an expert. The other three are plausible but clearly wrong.
- No images, tables or diagrams. Plain text only: no HTML tags, no markdown, no underlines or bold. Every question must make sense as plain text.
- No "all of the above", "none of the above" or "both A and B".
- Do not make the correct option the longest one by habit. Keep options short.
- Cover many different chapters and topics for this grade. ${topicsHint ? `Topics to spread across: ${topicsHint}.` : ''}
- Do not repeat or closely rephrase these questions already in the bank:
${seen || '(none yet)'}

Reply with ONLY a JSON array of ${count} objects, each exactly:
{"topic": "chapter or topic name (max 5 words)", "question": "...", "correct": "...", "wrong": ["...", "...", "..."], "explanation": "one short sentence"}`;
}

function pedagogyPrompt({ count, existing, topic }) {
  const seen = existing.slice(-40).map((q) => `- ${q.q.slice(0, 110)}`).join('\n');
  return `You are an experienced school principal and teacher trainer in India writing situational multiple-choice questions to assess TEACHING PRACTICE and JUDGEMENT of teachers applying for any subject.

Write exactly ${count} questions on: ${topic}.
Each describes a short realistic classroom or school situation, or asks for the best practice, and has one clearly best answer that a good Indian school would accept (child-centred, safe, respectful, practical). Wrong options are tempting but poor practice.
${/safeguard/i.test(topic) ? 'The correct answer must always put the child\'s safety first, avoid promising secrecy, and use the school\'s designated safeguarding person or procedure. Never describe the child in detail.\n' : ''}
Rules: no images; no "all/none of the above"; do not make the correct option the longest by habit; keep every option to one sentence.
Do not repeat or closely rephrase these existing questions:
${seen || '(none yet)'}

Reply with ONLY a JSON array of ${count} objects, each exactly:
{"topic": "${topic.slice(0, 60)}", "question": "...", "correct": "...", "wrong": ["...", "...", "..."], "explanation": "one short sentence"}`;
}

function checkPrompt({ name, grade, language, items }) {
  const lines = items
    .map((it, i) => `${i + 1}. ${it.q}\n   ${it.letters.map((l, j) => `${'ABCD'[j]}) ${l}`).join('\n   ')}`)
    .join('\n\n');
  return `You are a careful subject expert in ${name}${grade ? ` (grade ${grade})` : ''}. Answer each multiple-choice question yourself. Work it out; do not guess.
${language ? `The questions are in ${language}.\n` : ''}
${lines}

Reply with ONLY a JSON array with one object per question, in order:
{"n": 1, "answer": "A", "ambiguous": false}
Set "ambiguous" to true if the question is unclear, has no single clearly correct option, has more than one defensible answer, or is factually wrong.`;
}

// ---------------------------------------------------------------- one batch
async function makeBatch({ name, note, language, grade, count, bank, prompt }) {
  const raw = await ask(prompt, { temperature: 0.8 });
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.questions) ? raw.questions : [];
  let invalid = 0;
  let duplicate = 0;
  const fresh = [];
  for (const item of list) {
    const c = clean(item);
    if (!c) { invalid++; continue; }
    if ([...bank, ...fresh].some((q) => tooSimilar(q.q, c.q))) { duplicate++; continue; }
    fresh.push(c);
  }
  if (fresh.length === 0) return { kept: [], invalid, duplicate, unverified: 0, asked: list.length };

  // A separate call answers every question without seeing the key.
  const presented = fresh.map((c) => {
    const options = shuffled([c.a, ...c.w]);
    return { ...c, letters: options, right: 'ABCD'[options.indexOf(c.a)] };
  });
  const verdicts = await ask(checkPrompt({ name, grade, language, items: presented }), { temperature: 0.1 });
  const byNumber = new Map((Array.isArray(verdicts) ? verdicts : []).map((v) => [Number(v.n), v]));
  const kept = [];
  let unverified = 0;
  presented.forEach((p, i) => {
    const v = byNumber.get(i + 1);
    if (v && String(v.answer).toUpperCase() === p.right && v.ambiguous !== true) kept.push(p);
    else unverified++;
  });
  return { kept, invalid, duplicate, unverified, asked: list.length };
}

function count(bank, grade) {
  return bank.filter((q) => q.g.includes('*') ? false : q.g.includes(grade)).length;
}

// ---------------------------------------------------------------- main
async function main() {
  fs.mkdirSync(BANK_DIR, { recursive: true });
  console.log(`Question bank: target ${TARGET} per subject and grade, up to ${MAX_CALLS} Gemini calls${DRY ? ' (dry run)' : ''}.`);

  try {
    for (const sub of PLAN) {
      if (ONLY && sub.key !== ONLY && sub.file !== ONLY) continue;
      const bank = loadBank(sub.file);
      for (const grade of sub.grades) {
        if (GRADE_FILTER && !GRADE_FILTER.includes(grade)) continue;
        let have = count(bank, grade);
        console.log(`${sub.name}, grade ${grade}: ${have} of ${TARGET}`);
        while (have < TARGET) {
          const need = Math.min(20, TARGET - have);
          if (DRY) { console.log(`  would ask for ${need} more`); break; }
          const sameGrade = bank.filter((q) => q.g.includes(grade));
          const prompt = writePrompt({ name: sub.name, note: sub.note, language: sub.language, grade, count: need, existing: sameGrade });
          const result = await makeBatch({ name: sub.name, note: sub.note, language: sub.language, grade, count: need, bank: sameGrade, prompt });
          let n = nextNumber(bank, sub.prefix);
          for (const k of result.kept) {
            bank.push({ id: `${sub.prefix}-${String(n++).padStart(4, '0')}`, g: [grade], t: k.topic, k: 's', q: k.q, a: k.a, w: k.w, e: k.e });
          }
          saveBank(sub.file, bank);
          have = count(bank, grade);
          run.kept += result.kept.length;
          report.totals.written += result.asked;
          report.totals.kept += result.kept.length;
          report.totals.dropped_invalid += result.invalid;
          report.totals.dropped_duplicate += result.duplicate;
          report.totals.dropped_unverified += result.unverified;
          console.log(`  kept ${result.kept.length} of ${result.asked} (malformed ${result.invalid}, repeated ${result.duplicate}, failed the check ${result.unverified})  now ${have}`);
          if (result.kept.length === 0 && result.asked === 0) break; // nothing usable came back; move on
        }
      }
    }

    if (!ONLY || ONLY === 'pedagogy') {
      const bank = loadBank('pedagogy');
      let have = bank.length;
      console.log(`Teaching practice: ${have} of ${PED_TARGET}`);
      let i = 0;
      while (have < PED_TARGET && !DRY) {
        const topic = PEDAGOGY_TOPICS[i++ % PEDAGOGY_TOPICS.length];
        const need = Math.min(10, PED_TARGET - have);
        const prompt = pedagogyPrompt({ count: need, existing: bank, topic });
        const result = await makeBatch({ name: 'teaching practice and school judgement', grade: '', count: need, bank, prompt });
        let n = nextNumber(bank, 'ped');
        for (const k of result.kept) {
          bank.push({ id: `ped-${String(n++).padStart(3, '0')}`, g: ['*'], t: k.topic, k: 'p', q: k.q, a: k.a, w: k.w, e: k.e });
        }
        saveBank('pedagogy', bank);
        have = bank.length;
        run.kept += result.kept.length;
        report.totals.written += result.asked;
        report.totals.kept += result.kept.length;
        report.totals.dropped_invalid += result.invalid;
        report.totals.dropped_duplicate += result.duplicate;
        report.totals.dropped_unverified += result.unverified;
        console.log(`  ${topic}: kept ${result.kept.length} of ${result.asked}  now ${have}`);
        if (i > PEDAGOGY_TOPICS.length * 6) break;
      }
    }
    run.stopped = 'finished';
  } catch (err) {
    if (err instanceof QuotaStop) {
      run.stopped = err.message;
      console.log(`Stopped: ${err.message}. Progress is saved. Run again to carry on.`);
    } else {
      run.stopped = `error: ${err?.message || err}`;
      console.error(err);
    }
  } finally {
    run.finished = new Date().toISOString();
    report.runs.push(run);
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    console.log(`Done this run: ${run.calls} calls, ${run.kept} questions kept. ${run.stopped}`);
  }
}

main();
