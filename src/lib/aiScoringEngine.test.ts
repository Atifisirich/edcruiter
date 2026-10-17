import { describe, expect, it } from 'vitest';
import { scanMisconductAndRefusal, evaluateStageWithAI } from './aiScoringEngine';

describe('scanMisconductAndRefusal', () => {
  // These eight sentences are ordinary things a teacher plausibly writes.
  // Before the fix, substring matching auto-zeroed six of them: "crap" hit
  // "scrap", "dick" hit "Dickens", "dumb" hit "dumbbells", "piss" hit
  // "pissed-off", "no idea" hit the classroom-rule sentence, and "garbage"
  // hit "garbage-in-garbage-out". None of these should ever be scored zero
  // without a human looking at them.
  const legitimateAnswers = [
    'I use scrap paper and recycled materials for the model-building activity.',
    'We read Charles Dickens in the Grade 9 literature unit.',
    'Students practise with dumbbells during the PE warm-up.',
    'A pissed-off tone is never appropriate; I stay calm with students.',
    'My classroom rule is: no idea is a bad idea, every guess gets discussed.',
    'I avoid garbage-in-garbage-out data sets in the science lab.',
    'I ask: what do you already know, and what do you not know yet?',
    'I let students choose whichever manipulative helps them understand fractions.',
  ];

  it.each(legitimateAnswers)('does not zero a legitimate answer: %s', (answer) => {
    const result = scanMisconductAndRefusal(answer);
    expect(result.isMisconduct).toBe(false);
  });

  it('still hard-fails unambiguous profanity', () => {
    const result = scanMisconductAndRefusal('This assignment is fucking stupid and I refuse to do it properly.');
    expect(result.isMisconduct).toBe(true);
  });

  it('still hard-fails an explicit refusal to attempt the task', () => {
    const result = scanMisconductAndRefusal('I refuse to answer this question, it is none of your business.');
    expect(result.isMisconduct).toBe(true);
  });

  it('still hard-fails a near-blank submission', () => {
    const result = scanMisconductAndRefusal('idk');
    expect(result.isMisconduct).toBe(true);
  });

  it('flags an ambiguous tone word for human review without zeroing the score', () => {
    const result = scanMisconductAndRefusal(
      'I never call a wrong answer stupid — I ask a follow-up question and let the student self-correct.'
    );
    expect(result.isMisconduct).toBe(false);
    expect(result.needsReview).toBe(true);
  });

  it('does not match a bad word that is merely a substring of a real word', () => {
    // "crap" inside "scrap", specifically — the bug that motivated the fix.
    const result = scanMisconductAndRefusal('We built the volcano model using scrap cardboard and paint.');
    expect(result.isMisconduct).toBe(false);
  });
});

describe('quiz stage with no real questionnaire configured', () => {
  it('flags for manual review instead of scoring against a hardcoded demo answer key', () => {
    // Regression: this used to fall back to a hand-typed 2-question answer
    // key and return a confident-looking score against content the
    // candidate was never shown. A missing question bank is a
    // school-configuration gap, not something to score silently.
    const result = evaluateStageWithAI({
      stage: 'subject_quiz',
      candidateName: 'Test Candidate',
      appliedSubject: 'Physics',
      appliedSegment: 'Secondary (Grades 9-10)',
      submissionText: '{"1":"Some answer","2":"Another answer"}',
      questionnaire: [],
    });

    expect(result.overall_flag).toBe('needs_review');
    expect(result.evidence_reference).toBe('NO_QUESTIONNAIRE_CONFIGURED');
  });

  it('scores normally once a real MCQ questionnaire is configured', () => {
    const result = evaluateStageWithAI({
      stage: 'subject_quiz',
      candidateName: 'Test Candidate',
      appliedSubject: 'Physics',
      appliedSegment: 'Secondary (Grades 9-10)',
      submissionText: '{"1":"Option A"}',
      questionnaire: [
        {
          id: 'q1',
          school_id: 'school_1',
          stage_key: 'subject_quiz',
          subject: 'Physics',
          segment: 'ALL',
          type: 'mcq',
          question_text: 'What is Newton\'s first law?',
          options: ['Option A', 'Option B'],
          correct_option: 'Option A',
          created_at: new Date().toISOString(),
        },
      ],
    });

    expect(result.evidence_reference).not.toBe('NO_QUESTIONNAIRE_CONFIGURED');
    expect(result.scores[0]?.score).toBeGreaterThan(0);
  });
});
