import { AssessmentPack } from './types';

const TOPICS: Record<string, string[]> = {
  biology: [
    'photosynthesis', 'cell organelles', 'human digestion', 'plant tissues', 'food chains',
    'respiration', 'reproduction', 'ecosystems', 'microbes', 'nutrition',
    'nervous system', 'blood circulation', 'classification', 'Mendelian inheritance', 'natural selection',
    'excretion', 'water cycle', 'habitat adaptation', 'immunity', 'enzymes',
    'osmosis and diffusion', 'DNA and genes', 'hormones', 'pollution effects', 'biodiversity'
  ],
  physics: [
    'uniform motion', 'Newton laws', 'reflection of light', 'sound waves', 'Ohm law',
    'magnets', 'heat transfer', 'kinetic energy', 'gravity', 'pressure in fluids',
    'wave properties', 'work and power', 'simple machines', 'atomic structure', 'electric current',
    'mirror formula', 'refraction', 'friction', 'density', 'potential difference',
    'series and parallel circuits', 'electromagnetism', 'equations of motion', 'momentum', 'lenses'
  ],
  mathematics: [
    'place value', 'fractions', 'decimals', 'percentages', 'ratio and proportion',
    'linear equations', 'triangle properties', 'area of plane figures', 'volume of solids', 'coordinate graphs',
    'integers', 'factorisation', 'congruence', 'circle theorems', 'probability',
    'mean median mode', 'mensuration', 'quadratic equations', 'trigonometry ratios', 'number systems',
    'sequences', 'measurement units', 'symmetry', 'data interpretation', 'word problems'
  ],
  chemistry: [
    'atoms and molecules', 'periodic table', 'acids and bases', 'chemical bonding', 'states of matter',
    'mole concept', 'chemical equations', 'metals and non-metals', 'carbon compounds', 'electrolysis',
    'reaction types', 'pH scale', 'salts', 'oxidation reduction', 'solutions and concentration',
    'gas laws', 'thermodynamics basics', 'organic functional groups', 'lab safety symbols', 'indicators',
    'ionic vs covalent', 'combustion', 'water hardness', 'polymers', 'environmental chemistry'
  ],
  english: [
    'parts of speech', 'tenses', 'subject-verb agreement', 'active and passive voice', 'direct and indirect speech',
    'figurative language', 'theme vs plot', 'character analysis', 'poetry meter', 'essay structure',
    'punctuation', 'clauses', 'modals', 'prepositions', 'reading inference',
    'summary writing', 'letter formats', 'vocabulary roots', 'cohesion devices', 'tone and register',
    'argumentative writing', 'narrative voice', 'literary devices', 'comprehension skills', 'editing errors'
  ],
  default: [
    'core definitions', 'cause and effect', 'classification', 'measurement', 'evidence and claims',
    'problem solving steps', 'common misconceptions', 'real-world application', 'diagram reading', 'units and symbols',
    'compare and contrast', 'sequence of processes', 'safety rules', 'data tables', 'hypothesis testing',
    'key vocabulary', 'worked examples', 'error analysis', 'formulas', 'case examples',
    'local context links', 'assessment criteria', 'revision priorities', 'lab or field method', 'cross-topic links'
  ]
};

const PEDAGOGY_TOPICS = [
  'checking for understanding mid-lesson',
  'addressing a common student misconception',
  'differentiating for mixed-ability learners',
  'designing a quick exit ticket',
  'opening a lesson with an inquiry hook',
  'using board work to scaffold a concept',
  'giving actionable feedback on student work',
  'managing off-task behaviour calmly',
  'planning formative vs summative checks',
  'including learners who need extra support'
];

function topicList(subject: string): string[] {
  const s = subject.toLowerCase();
  if (s.includes('bio')) return TOPICS.biology;
  if (s.includes('physic')) return TOPICS.physics;
  if (s.includes('math')) return TOPICS.mathematics;
  if (s.includes('chem')) return TOPICS.chemistry;
  if (s.includes('english') || s.includes('literature')) return TOPICS.english;
  return TOPICS.default;
}

/** 25 subject-knowledge MCQs (content depth — not pedagogy). */
export function buildFallbackMcqs(subject: string, segment: string, board: string, count = 25) {
  const topics = topicList(subject);
  return Array.from({ length: count }, (_, i) => {
    const topic = topics[i % topics.length];
    const n = i + 1;
    const options = [
      `The accurate ${board}-aligned explanation of ${topic} for ${segment}`,
      `A common student misconception about ${topic} stated as if it were correct`,
      `An unrelated fact from a different topic presented as the answer for ${topic}`,
      `A partially true statement about ${topic} that misses the key mechanism or definition`
    ];
    return {
      id: `mcq_subj_${n}`,
      question_text: `Q${n}. [${subject} · subject knowledge] Which statement about ${topic} is most accurate for ${segment} under ${board}?`,
      options,
      correct_option: options[0],
      explanation: `Teachers must know the correct ${topic} content for this grade and board before they can teach it.`,
      category: 'subject' as const
    };
  });
}

/** 5–10 pedagogy MCQs after the subject block. */
export function buildPedagogyMcqs(subject: string, segment: string, board: string, count = 8) {
  return Array.from({ length: count }, (_, i) => {
    const topic = PEDAGOGY_TOPICS[i % PEDAGOGY_TOPICS.length];
    const n = i + 1;
    const options = [
      `Use a concrete classroom strategy for ${topic} in a ${segment} ${subject} lesson (${board})`,
      `Ignore ${topic} and only deliver a long lecture`,
      `Punish students instead of adjusting the teaching approach`,
      `Skip checking understanding and move to the next chapter immediately`
    ];
    return {
      id: `mcq_ped_${n}`,
      question_text: `P${n}. [${subject} · pedagogy] For ${segment}, which approach best supports ${topic}?`,
      options,
      correct_option: options[0],
      explanation: `Strong pedagogy pairs subject accuracy with ${topic}.`,
      category: 'pedagogy' as const
    };
  });
}

export function buildFallbackPack(input: {
  school_id: string;
  subject: string;
  segment: string;
  board: string;
}): Omit<AssessmentPack, 'id' | 'created_at' | 'status'> {
  const { school_id, subject, segment, board } = input;
  const subjectMcqs = buildFallbackMcqs(subject, segment, board, 25);
  const pedagogyMcqs = buildPedagogyMcqs(subject, segment, board, 8);
  return {
    school_id,
    title: `${subject} · ${segment}`,
    subject,
    segment,
    board,
    mcqs: [...subjectMcqs, ...pedagogyMcqs],
    pedagogy_mcqs: pedagogyMcqs,
    lesson_prompt: `Design a 35-minute ${board} lesson in ${subject} for ${segment}. Include a 5-minute hook, one common misconception and how you will correct it, mixed-ability tasks, and a 2-question exit ticket.`,
    lesson_rubric: `Score 1–10 on: (1) clear learning outcome, (2) misconception diagnosis, (3) age-appropriate tasks, (4) checking for understanding, (5) realistic timing. Do not award high scores for vague or copied plans.`,
    demo_prompt: `Record a 5-minute teaching demo for ${segment} ${subject} (${board}). Open with a real-world hook, draw or show one clear visual, ask at least one check question, and close with a one-line summary.`,
    demo_rubric: `Score 1–10 on: voice clarity, visual/board work, conceptual accuracy for this grade, student-facing language, and a clear close. Penalise reading from a script and off-topic talk.`,
    scenario_prompt: `A ${segment} student is upset during a ${subject} activity and the class starts to lose focus. In 2 minutes, explain what you would say and do in the first 60 seconds, then how you would restart learning.`,
    scenario_rubric: `Score 1–10 on: calm de-escalation, student dignity, restoring the lesson, and age-appropriate language. Do not reward punishment-first answers.`
  };
}
