import { describe, expect, it } from 'vitest';
import {
  FACTOR_DEFS, MISCONDUCT_AREA_CAP, MISCONDUCT_OVERALL_CAP, applyMisconduct, buildFactor, buildFactors,
  computeOverall, defsInGroup, factorDef, lessonPlanText, observationLabel, parseMcqMarks, quoteAppearsIn,
  recommendationFor, reportSettingsOf, scoreTone, stars, type ProfileFactor,
} from './teachingProfile';

const ANSWER = 'I would first stay calm, move close to the student, and ask what happened before I speak to the class.';

describe('the factor list', () => {
  it('has the six core areas, whose weights leave room for the CV', () => {
    const areas = defsInGroup('area');
    expect(areas.map((a) => a.key)).toEqual([
      'professionalism', 'communication', 'teaching_excellence', 'classroom_management', 'subject_knowledge', 'inclusive_modern_teaching',
    ]);
    expect(areas.reduce((sum, a) => sum + (a.weight ?? 0), 0)).toBe(90);
  });

  it('has no duplicate keys', () => {
    const keys = FACTOR_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('covers every factor in the sample report: nine communication parts, five CV parts, delivery and presentation', () => {
    expect(defsInGroup('communication')).toHaveLength(9);
    expect(defsInGroup('resume')).toHaveLength(5);
    expect(defsInGroup('delivery').map((d) => d.key)).toEqual(['eye_contact', 'body_language', 'facial_expression', 'energy_level', 'voice_modulation']);
    expect(defsInGroup('appearance').map((d) => d.key)).toEqual(['attire', 'grooming']);
    expect(factorDef('pedagogy')).toBeTruthy();
  });
});

describe('quoteAppearsIn', () => {
  it('accepts a quote copied from the answer, ignoring case and punctuation', () => {
    expect(quoteAppearsIn('stay calm, MOVE close to the student', [ANSWER])).toBe(true);
  });

  it('rejects a quote the candidate never wrote', () => {
    expect(quoteAppearsIn('I would immediately call the parents and the principal', [ANSWER])).toBe(false);
  });

  it('rejects a quote that is too short to prove anything', () => {
    expect(quoteAppearsIn('stay calm', [ANSWER])).toBe(false);
    expect(quoteAppearsIn('', [ANSWER])).toBe(false);
  });
});

describe('buildFactor', () => {
  const def = factorDef('classroom_management')!;

  it('counts a score whose quote is really in the answer, with high confidence', () => {
    const f = buildFactor(def, { score: 72, reason: 'Calm, specific steps.', quote: 'stay calm, move close to the student' }, [ANSWER], true);
    expect(f).toMatchObject({ score: 72, confidence: 'high', counted: true, quote: 'stay calm, move close to the student' });
  });

  it('shows but does not count a score whose quote cannot be found', () => {
    const f = buildFactor(def, { score: 90, reason: 'Excellent.', quote: 'I run my class like a well-oiled machine' }, [ANSWER], true);
    expect(f).toMatchObject({ score: 90, confidence: 'low', counted: false });
    expect(f.quote).toBeUndefined();
  });

  it('says there is not enough evidence when the model gives no score or no reason', () => {
    expect(buildFactor(def, { score: null, reason: 'Not enough evidence', quote: '' }, [ANSWER], true)).toMatchObject({ score: null, confidence: 'none', counted: false });
    expect(buildFactor(def, { score: 70, reason: '' }, [ANSWER], true)).toMatchObject({ score: null, confidence: 'none' });
    expect(buildFactor(def, undefined, [ANSWER], true)).toMatchObject({ score: null, confidence: 'none' });
  });

  it('clamps a wild score into 0-100', () => {
    expect(buildFactor(def, { score: 400, reason: 'x', quote: 'stay calm, move close to the student' }, [ANSWER], true).score).toBe(100);
    expect(buildFactor(def, { score: -5, reason: 'x', quote: 'stay calm, move close to the student' }, [ANSWER], true).score).toBe(0);
  });

  it('never counts a video impression, and caps its confidence at medium', () => {
    const f = buildFactor(factorDef('eye_contact')!, { score: 88, reason: 'Looks at the camera.' }, [], true);
    expect(f).toMatchObject({ score: 88, confidence: 'medium', counted: false });
  });

  it('gives no video impression when the video could not be analysed', () => {
    const f = buildFactor(factorDef('eye_contact')!, { score: 88, reason: 'Looks at the camera.' }, [], false);
    expect(f).toMatchObject({ score: null, confidence: 'none' });
  });
});

function counted(key: string, score: number): ProfileFactor {
  const def = factorDef(key)!;
  return { key, label: def.label, group: def.group, source: def.source, definition: def.definition, score, reason: 'r', confidence: 'high', counted: true };
}

describe('computeOverall', () => {
  const allAreas = (score: number) => defsInGroup('area').map((d) => counted(d.key, score));

  it('is the weighted average of the counted areas', () => {
    expect(computeOverall(allAreas(70)).score).toBe(70);
    const mixed = [counted('subject_knowledge', 100), counted('teaching_excellence', 100), counted('communication', 0), counted('professionalism', 0), counted('classroom_management', 0), counted('inclusive_modern_teaching', 0)];
    // 20*100 + 20*100 over 90
    expect(computeOverall(mixed).score).toBe(44);
  });

  it('adds the CV review when at least three CV parts are counted', () => {
    const cv = defsInGroup('resume').map((d) => counted(d.key, 100));
    const out = computeOverall([...allAreas(50), ...cv]);
    expect(out.score).toBe(55); // (50*90 + 100*10) / 100
    expect(out.counted_weight).toBe(100);
  });

  it('is "not enough evidence" when too little is counted', () => {
    const out = computeOverall([counted('subject_knowledge', 80), counted('communication', 80)]);
    expect(out.score).toBeNull();
  });

  it('ignores low-confidence and video factors', () => {
    const lowConfidence = { ...counted('teaching_excellence', 10), confidence: 'low' as const, counted: false };
    const out = computeOverall([...allAreas(80).filter((f) => f.key !== 'teaching_excellence'), lowConfidence, counted('eye_contact', 0)]);
    expect(out.score).toBe(80);
  });

  it('caps the overall when the candidate was abusive or refused to answer', () => {
    const out = computeOverall(allAreas(85), 'Abusive language found.');
    expect(out.score).toBe(MISCONDUCT_OVERALL_CAP);
    expect(out.capped_reason).toBe('Abusive language found.');
  });
});

describe('applyMisconduct', () => {
  it('pulls professionalism and tone down to the cap and leaves the rest alone', () => {
    const factors = [counted('professionalism', 80), counted('formality', 70), counted('pedagogy', 75)];
    const out = applyMisconduct(factors, 'Abusive language found.');
    expect(out.find((f) => f.key === 'professionalism')!.score).toBe(MISCONDUCT_AREA_CAP);
    expect(out.find((f) => f.key === 'formality')!.score).toBe(MISCONDUCT_AREA_CAP);
    expect(out.find((f) => f.key === 'pedagogy')!.score).toBe(75);
  });

  it('changes nothing when there was no misconduct', () => {
    const factors = [counted('professionalism', 80)];
    expect(applyMisconduct(factors, undefined)).toEqual(factors);
  });
});

describe('labels', () => {
  it('uses the red, yellow, green ranges 0-40, 41-79, 80-100', () => {
    expect([0, 40].map(scoreTone)).toEqual(['red', 'red']);
    expect([41, 79].map(scoreTone)).toEqual(['yellow', 'yellow']);
    expect([80, 100].map(scoreTone)).toEqual(['green', 'green']);
  });

  it('shows an observation as a word and never as a number', () => {
    expect(observationLabel({ score: 80, confidence: 'medium' })).toBe('Strong');
    expect(observationLabel({ score: 60, confidence: 'medium' })).toBe('Adequate');
    expect(observationLabel({ score: 30, confidence: 'medium' })).toBe('Needs attention');
    expect(observationLabel({ score: null, confidence: 'none' })).toBe('Not enough evidence');
  });

  it('turns a score into half-star steps', () => {
    expect(stars(100)).toBe(5);
    expect(stars(70)).toBe(3.5);
    expect(stars(0)).toBe(0);
  });

  it('names the recommendation from the school bands', () => {
    expect(recommendationFor(75)?.label).toBe('Strong shortlist');
    expect(recommendationFor(45)?.label).toBe('Borderline / review');
    expect(recommendationFor(null)).toBeNull();
  });
});

describe('reportSettingsOf', () => {
  it('shows delivery notes but not appearance notes unless the school asks', () => {
    expect(reportSettingsOf(undefined)).toEqual({ delivery: true, appearance: false });
    expect(reportSettingsOf({ delivery_observations: false, appearance_observations: true })).toEqual({ delivery: false, appearance: true });
  });
});

describe('reading the stored test answers', () => {
  const stored = 'MCQ TEST\n\nQ: a\nSelected: x\nKey: x (Correct)\n\nQ: b\nSelected: y\nKey: z (Incorrect)\n\nQ: c\nSelected: z\nKey: z (Correct)\n\n--- LESSON PLAN ---\n\nStep one. Step two (Correct) is mentioned here.';

  it('counts the marks only from the test part', () => {
    expect(parseMcqMarks(stored)).toEqual({ correct: 2, total: 3 });
    expect(parseMcqMarks(undefined)).toBeNull();
  });

  it('returns just the lesson plan', () => {
    expect(lessonPlanText(stored)).toBe('Step one. Step two (Correct) is mentioned here.');
    expect(lessonPlanText('no plan here')).toBe('');
  });
});

describe('buildFactors', () => {
  it('keeps the model\'s answers in the order of the definitions and checks CV factors against the CV only', () => {
    const defs = [factorDef('subject_knowledge')!, factorDef('education')!];
    const out = buildFactors(
      defs,
      {
        subject_knowledge: { score: 60, reason: 'ok', quote: 'stay calm, move close to the student' },
        education: { score: 60, reason: 'ok', quote: 'stay calm, move close to the student' },
      },
      { answers: [ANSWER], cv: ['M.Sc Botany, B.Ed from Osmania University, CTET qualified'] },
      true
    );
    expect(out.map((f) => f.key)).toEqual(['subject_knowledge', 'education']);
    expect(out[0].confidence).toBe('high');
    expect(out[1].confidence).toBe('low');
  });
});
