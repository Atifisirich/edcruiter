import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY; // run with: node --env-file=.env.local scripts/<file>.mjs
const ai = new GoogleGenAI({ apiKey });

async function testResumeAnalyzer() {
  console.log('Testing Forensic AI Resume Analyzer with Gemini...');

  const sampleResume = `
Dr. Rajesh K. Varma
Email: rajesh.varma@gmail.com | Phone: +91 98765 11223
Applied Role: Secondary Physics Teacher (Grades 9-10)

EDUCATION:
- M.Sc Physics, Osmania University (2015) - 78% First Class
- B.Ed, Osmania College of Education (2017) - NCTE Approved
- CTET Paper 2 Qualified (2018)

WORK EXPERIENCE:
1. Delhi Public School, Hyderabad (Jun 2017 – May 2020) - 3 Years
   Role: TGT General Science & Physics (Grades 6-8)
   Responsibilities: Designed hands-on physics experiments, mentored 4 students to State Science Fair awards.

2. [CAREER BREAK / UNLISTED]: (Jun 2020 – Jul 2021) - 13 Months Gap during Covid

3. Oakridge International School (Aug 2021 – Present) - 4.5 Years
   Role: Senior PGT Physics & Head of Department (Grades 9-11)
   Responsibilities: Physics curriculum planning for IGCSE/CBSE, Vernier data logger lab implementation, 100% distinction rate in Class 10 Board exams.
  `;

  const prompt = `
You are an expert Chief Human Resources Officer and School Academic Director specializing in faculty background verification and career dossier auditing.
Perform an exhaustive, highly critical forensic analysis of the following candidate's resume for Physics Teacher (Secondary Grades 9-10).

RESUME:
"""
${sampleResume}
"""

ANALYSIS REQUIREMENTS:
1. CAREER GAPS: Detect any employment gaps >= 4 months.
2. CAREER TRAJECTORY & ROLE SENIORITY: Trace upward promotions (e.g. TGT -> PGT -> HOD) or downward shifts.
3. TENURE & JOB HOPPING RISK: Calculate total experience and average tenure per school.
4. QUALIFICATIONS & B.Ed / TET CHECK: Identify degrees and alignment with Physics.
5. RED FLAGS & GREEN FLAGS: List specific anomalies vs standout achievements.
6. RECOMMENDED INTERVIEW PROBES: 3 specific probing questions.

Output ONLY valid JSON:
{
  "overall_fitment_score": 8.5,
  "career_stability_index": "High",
  "total_experience_years": 7.5,
  "average_tenure_years": 3.7,
  "job_hopping_risk": "Low",
  "career_gaps": [
    {
      "period": "Jun 2020 – Jul 2021",
      "duration_months": 13,
      "description": "13-month career gap between DPS and Oakridge International.",
      "flagged": true
    }
  ],
  "career_trajectory": {
    "trend": "Upward",
    "summary": "Clear progression from Middle School TGT to Senior Secondary PGT and Head of Department.",
    "milestones": ["2017: TGT DPS", "2021: PGT Oakridge", "2023: HOD Physics"]
  },
  "qualifications_match": {
    "degrees_found": ["M.Sc Physics", "B.Ed", "CTET"],
    "alignment_with_subject": "Direct high alignment",
    "b_ed_status": "Completed (2017)",
    "ctet_tet_status": "CTET Paper 2 Qualified"
  },
  "pedagogical_highlights": ["Vernier sensor labs", "100% board distinction"],
  "red_flags": ["13-month break in 2020-2021"],
  "green_flags": ["3+ year average tenure", "B.Ed + CTET + M.Sc qualified", "Promotion to HOD"],
  "recommended_interview_probes": ["Question 1", "Question 2", "Question 3"]
}
  `;

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    console.log('\n--- GEMINI AI FORENSIC RESUME REPORT ---');
    console.log(res.text);
  } catch (err) {
    console.error('Error during test:', err);
  }
}

testResumeAnalyzer();
