import { QuestionnaireItem, StageKey } from './types';
import { SLOKA_SCHOOL_ID } from './defaultData';

export interface SubjectMCQItem {
  id: string;
  question_text: string;
  options: string[];
  correct_option: string;
  explanation: string;
  blooms_level?: string;
}

export interface DynamicSubjectPacket {
  subject: string;
  segment: string;
  mcqs: SubjectMCQItem[];
  theoryPrompt: {
    question_text: string;
    rubric_hint: string;
  };
  demoPrompt: {
    question_text: string;
    rubric_hint: string;
  };
  situationalPrompt: {
    question_text: string;
    rubric_hint: string;
  };
}

// Comprehensive Matrix of Domain Questions and MCQs
export const SUBJECT_PACKETS: Record<string, Record<string, DynamicSubjectPacket>> = {
  // =========================================================================
  // BIOLOGY
  // =========================================================================
  biology: {
    primary: {
      subject: 'Biology',
      segment: 'Primary (Grades 1–5, 6–11 yrs)',
      mcqs: [
        {
          id: 'mcq_bio_pri_1',
          question_text: 'Which part of a plant is primarily responsible for absorbing water and dissolved minerals from the soil?',
          options: ['A. Leaves (via stomata)', 'B. Roots (via root hair cells)', 'C. Flower petals', 'D. Stem bark'],
          correct_option: 'B. Roots (via root hair cells)',
          explanation: 'Root hair cells provide high surface area to absorb water and minerals from the soil via osmosis and active transport.',
          blooms_level: 'Understanding'
        },
        {
          id: 'mcq_bio_pri_2',
          question_text: 'During photosynthesis, what gas do green leaves take in from the air to make food in the presence of sunlight?',
          options: ['A. Carbon Dioxide (CO2)', 'B. Oxygen (O2)', 'C. Nitrogen (N2)', 'D. Hydrogen (H2)'],
          correct_option: 'A. Carbon Dioxide (CO2)',
          explanation: 'Leaves absorb Carbon Dioxide through stomata and release Oxygen as a byproduct during photosynthesis.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for teaching "Plant Parts & Their Vital Functions (Roots, Stem, Leaves, Flower)" to Grade 3 students. Include: 1. A 5-min hands-on bean-sprouting inquiry hook, 2. How you diagnose and fix the misconception that plants "eat soil like food", 3. Tiered activities for mixed abilities, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates Foundational Science concepts, hands-on sensory engagement, concrete-to-abstract scaffolding, and misconception remediation.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the concept of "How Leaves Make Food (Photosynthesis Basics)" to Grade 3/4 students using a simple whiteboard diagram with sun, rain, and leaf arrows with lively storytelling pacing.',
        rubric_hint: 'Evaluates age-appropriate vocal energy, clear visual diagrams on board, and checking for understanding.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: During an outdoor school garden biology session, a Grade 3 student is terrified of earthworms and starts crying, causing other students to stop their activity. How do you comfort the child and turn this into a gentle, inclusive learning moment?',
        rubric_hint: 'Evaluates emotional containment, de-escalating childhood anxiety, and maintaining positive outdoor classroom safety.'
      }
    },
    middle: {
      subject: 'Biology',
      segment: 'Middle School (Grades 6–8, 11–14 yrs)',
      mcqs: [
        {
          id: 'mcq_bio_mid_1',
          question_text: 'Which organelle is known as the "Powerhouse of the Cell" because it generates ATP through cellular respiration?',
          options: ['A. Endoplasmic Reticulum', 'B. Mitochondria', 'C. Golgi Apparatus', 'D. Lysosome'],
          correct_option: 'B. Mitochondria',
          explanation: 'Mitochondria generate most of the chemical energy needed to power the cell’s biochemical reactions in the form of ATP.',
          blooms_level: 'Remembering'
        },
        {
          id: 'mcq_bio_mid_2',
          question_text: 'How do plant cells fundamentally differ from animal cells when viewed under a standard light microscope?',
          options: [
            'A. Plant cells possess a rigid cellulose cell wall and large central vacuole',
            'B. Animal cells possess chloroplasts and cell walls',
            'C. Plant cells lack a nucleus',
            'D. Animal cells have fixed rectangular shapes'
          ],
          correct_option: 'A. Plant cells possess a rigid cellulose cell wall and large central vacuole',
          explanation: 'Plant cells have a cellulose cell wall, chloroplasts, and a large central vacuole which give them a structured shape.',
          blooms_level: 'Analyzing'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Cell Organelles: Comparing Plant vs. Animal Cells" for Grade 7. Include: 1. SMART objectives mapped to CBSE/Cambridge, 2. A 5-min microscope/onion-peel inquiry hook, 3. How to address the misconception that "all cells are identical", 4. 3-tier differentiation, and 5. A 2-question exit ticket.',
        rubric_hint: 'Evaluates microscopic conceptual depth, structured comparative tables, and formative assessment.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Draw and compare a Plant Cell vs. Animal Cell on a whiteboard, clearly demonstrating the role of the Cell Wall, Cell Membrane, Nucleus, and Chloroplasts.',
        rubric_hint: 'Evaluates chalkboard diagramming precision, labeling speed, and active questioning.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: During a Grade 8 biology microscope lab, two students break a glass slide and argue over who is responsible. Explain your immediate safety and restorative discipline protocol.',
        rubric_hint: 'Evaluates lab safety enforcement, calm de-escalation, and objective conflict resolution.'
      }
    },
    secondary: {
      subject: 'Biology',
      segment: 'Secondary (Grades 9–10, 14–16 yrs)',
      mcqs: [
        {
          id: 'mcq_bio_sec_1',
          question_text: 'In Mendel\'s monohybrid cross of pure tall (TT) and pure dwarf (tt) pea plants, what is the phenotypic and genotypic ratio in the F2 generation?',
          options: [
            'A. Phenotypic 3:1, Genotypic 1:2:1 (1 TT : 2 Tt : 1 tt)',
            'B. Phenotypic 1:2:1, Genotypic 3:1',
            'C. Phenotypic 9:3:3:1, Genotypic 1:1',
            'D. Phenotypic 1:1, Genotypic 1:1'
          ],
          correct_option: 'A. Phenotypic 3:1, Genotypic 1:2:1 (1 TT : 2 Tt : 1 tt)',
          explanation: 'The F2 generation yields 3 Tall : 1 Dwarf phenotypically, and 1 TT : 2 Tt : 1 tt genotypically.',
          blooms_level: 'Applying'
        },
        {
          id: 'mcq_bio_sec_2',
          question_text: 'Which blood vessel carries oxygenated blood from the lungs directly into the left atrium of the human heart?',
          options: ['A. Pulmonary Artery', 'B. Pulmonary Vein', 'C. Vena Cava', 'D. Aorta'],
          correct_option: 'B. Pulmonary Vein',
          explanation: 'The pulmonary veins are unique veins that carry oxygen-rich blood from the lungs to the left atrium of the heart.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Mendelian Genetics: Monohybrid Cross & Law of Segregation" for Grade 10. Include: 1. SMART objectives, 2. A 5-min Punnett square gamete inquiry hook, 3. Remediation for why recessive traits reappear in F2, 4. Tiered worksheets, and 5. A 2-question exit ticket.',
        rubric_hint: 'Evaluates board exam genetics rigor, Punnett square scaffolding, and error analysis.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the pathway of Double Circulation in the Human Heart (Pulmonary vs. Systemic circulation) on a whiteboard using colored markers/schematic arrows.',
        rubric_hint: 'Evaluates board work clarity, anatomical accuracy, and clear vocal pacing.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: When discussing human reproductive health in Grade 10 biology, several students giggle and distract the class, while others feel embarrassed. How do you establish professional scientific decorum while maintaining a safe, open environment?',
        rubric_hint: 'Evaluates adolescent sensitivity, normalizing scientific terminology, and proactive boundary setting.'
      }
    },
    senior: {
      subject: 'Biology',
      segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
      mcqs: [
        {
          id: 'mcq_bio_sr_1',
          question_text: 'During DNA replication in eukaryotes, which enzyme is responsible for synthesizing short RNA primers required by DNA Polymerase III?',
          options: ['A. DNA Ligase', 'B. RNA Primase', 'C. DNA Helicase', 'D. Topoisomerase'],
          correct_option: 'B. RNA Primase',
          explanation: 'RNA Primase synthesizes short RNA primers that provide the 3\'-OH group needed for DNA Polymerase elongation.',
          blooms_level: 'Analyzing'
        },
        {
          id: 'mcq_bio_sr_2',
          question_text: 'In the lac operon of E. coli, what happens when lactose is present in the growth medium?',
          options: [
            'A. Allolactose binds to the repressor protein, inactivating it and allowing RNA polymerase to transcribe lacZ, lacY, lacA',
            'B. Repressor binds tightly to the operator, shutting down transcription',
            'C. Cyclic AMP levels drop to zero, blocking transcription',
            'D. Lactose directly cleaves the promoter DNA'
          ],
          correct_option: 'A. Allolactose binds to the repressor protein, inactivating it and allowing RNA polymerase to transcribe lacZ, lacY, lacA',
          explanation: 'Lactose isomer allolactose acts as an inducer, binding the lac repressor and causing an allosteric change that releases the operator.',
          blooms_level: 'Evaluating'
        }
      ],
      theoryPrompt: {
        question_text: 'Identify the single most common misconception students have in "Molecular Basis of Inheritance: Transcription vs Translation" OR "Chemiosmotic ATP synthesis in Chloroplasts". Write the exact diagnostic question and 35-minute competitive (NEET/Board) lesson plan.',
        rubric_hint: 'Evaluates competitive domain depth, molecular mechanisms, and diagnostic problem solving.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the molecular mechanism of the "Lac Operon System (Induction & Repression)" on a whiteboard as if addressing Grade 12 competitive aspirants.',
        rubric_hint: 'Evaluates advanced domain mastery, molecular schema drawings, and clear deductive explanation.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A Grade 12 NEET aspirant scores below 50% in the molecular genetics unit test and panics about their medical college prospects. How do you conduct an analytical error-log counselling session with them?',
        rubric_hint: 'Evaluates high-stakes academic mentoring, targeted data-driven error analysis, and building psychological resilience.'
      }
    }
  },

  // =========================================================================
  // MATHEMATICS
  // =========================================================================
  math: {
    primary: {
      subject: 'Math',
      segment: 'Primary (Grades 1–5, 6–11 yrs)',
      mcqs: [
        {
          id: 'mcq_math_pri_1',
          question_text: 'Which of the following fractions is strictly equivalent to 2/3?',
          options: ['A. 4/6', 'B. 3/4', 'C. 4/9', 'D. 2/6'],
          correct_option: 'A. 4/6',
          explanation: 'Multiplying both numerator and denominator by 2 gives (2*2)/(3*2) = 4/6.',
          blooms_level: 'Understanding'
        },
        {
          id: 'mcq_math_pri_2',
          question_text: 'In the number 4,782, what is the place value of the digit 7?',
          options: ['A. 7 Tens (70)', 'B. 7 Hundreds (700)', 'C. 7 Thousands (7,000)', 'D. 7 Units (7)'],
          correct_option: 'B. 7 Hundreds (700)',
          explanation: 'The digit 7 is in the hundreds position, representing 7 * 100 = 700.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for teaching "Equivalent Fractions & Area Models" to Grade 4 students using paper-folding and pizza-slice analogies. Include: 1. SMART objectives, 2. Concrete-to-abstract progression, 3. 3-tier differentiation, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates Foundational Numeracy (FLN), concrete manipulation before symbolic notation, and exit ticket design.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the concept of "Place Value & Carry-Over Addition (e.g. 48 + 27)" to 2nd graders using visual bundling sticks/blocks on a whiteboard.',
        rubric_hint: 'Evaluates board layout, positive reinforcement vocabulary, and interactive pacing.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A parent complains that their Grade 3 child has high math anxiety and cries before timed arithmetic quizzes. How do you collaborate with the parent and adapt classroom strategies?',
        rubric_hint: 'Evaluates math anxiety remediation, gamified formative checks, and empathetic parent communication.'
      }
    },
    secondary: {
      subject: 'Math',
      segment: 'Secondary (Grades 9–10, 14–16 yrs)',
      mcqs: [
        {
          id: 'mcq_math_sec_1',
          question_text: 'What are the roots of the quadratic equation 2x^2 - 7x + 3 = 0?',
          options: ['A. x = 3 and x = 1/2', 'B. x = -3 and x = -1/2', 'C. x = 2 and x = 3/2', 'D. x = 1 and x = 3'],
          correct_option: 'A. x = 3 and x = 1/2',
          explanation: 'Factoring gives (2x - 1)(x - 3) = 0 => x = 1/2 or x = 3.',
          blooms_level: 'Applying'
        },
        {
          id: 'mcq_math_sec_2',
          question_text: 'If sin(theta) = 3/5 in a right-angled triangle, what is the exact value of tan(theta)?',
          options: ['A. 3/4', 'B. 4/3', 'C. 4/5', 'D. 5/3'],
          correct_option: 'A. 3/4',
          explanation: 'Opposite = 3, Hypotenuse = 5 => Adjacent = sqrt(25-9) = 4. Therefore tan(theta) = Opp/Adj = 3/4.',
          blooms_level: 'Applying'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Quadratic Equations: Derivation of the Quadratic Formula via Completing the Square" for Grade 10. Include: 1. SMART objectives, 2. Visual geometric square-completing inquiry hook, 3. Tiered worksheets, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates algebraic deductive rigor, geometric analogies for algebraic identities, and error analysis.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Explain the geometric and algebraic derivation of the "Pythagorean Theorem" OR "Trigonometric Ratios in Right Triangles" on a chalkboard.',
        rubric_hint: 'Evaluates algebraic clarity, structured geometric diagrams, and board exam pacing.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: Half the class fails a Grade 10 Trigonometry diagnostic test. Explain how you conduct a 2-day spiraled remediation without falling behind the syllabus calendar.',
        rubric_hint: 'Evaluates data-driven remediation, error classification, and agile curriculum management.'
      }
    },
    senior: {
      subject: 'Math',
      segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
      mcqs: [
        {
          id: 'mcq_math_sr_1',
          question_text: 'Evaluate the definite integral: Integral from 0 to pi/2 of [sin(x) / (sin(x) + cos(x))] dx.',
          options: ['A. pi/4', 'B. pi/2', 'C. 1', 'D. 0'],
          correct_option: 'A. pi/4',
          explanation: 'Using King\'s property I = Integral(f(a+b-x)), 2I = Integral(1 dx) = pi/2 => I = pi/4.',
          blooms_level: 'Analyzing'
        },
        {
          id: 'mcq_math_sr_2',
          question_text: 'What is the derivative of f(x) = x^x with respect to x for all x > 0?',
          options: ['A. x^x * (1 + ln(x))', 'B. x * x^(x-1)', 'C. x^x * ln(x)', 'D. (x^x) / x'],
          correct_option: 'A. x^x * (1 + ln(x))',
          explanation: 'Let y = x^x => ln(y) = x*ln(x). Differentiating: (1/y)(dy/dx) = 1 + ln(x) => dy/dx = x^x(1 + ln(x)).',
          blooms_level: 'Analyzing'
        }
      ],
      theoryPrompt: {
        question_text: 'Identify the most common conceptual misconception students make in "Calculus: Application of Derivatives (Maxima & Minima / Inflection Points)". Write the exact diagnostic question and 35-minute JEE/Advanced lesson plan.',
        rubric_hint: 'Evaluates advanced calculus rigor, first vs second derivative test differentiation, and multi-tier problem sets.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the concept and graphical proof of "Integration by Parts: Integral(u v\' dx) = u*v - Integral(u\' v dx)" on a whiteboard.',
        rubric_hint: 'Evaluates advanced mathematical derivation flow, product rule reversal, and competitive pacing.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A top student refuses to write step-by-step mathematical working in board mock exams because they use fast mental shortcuts for competitive exams. How do you align them with CBSE/Board marking rubrics without dampening their enthusiasm?',
        rubric_hint: 'Evaluates balancing competitive speed with board step-marking discipline.'
      }
    }
  },

  // =========================================================================
  // PHYSICS / SCIENCE
  // =========================================================================
  physics: {
    primary: {
      subject: 'Physics',
      segment: 'Primary (Grades 1–5, 6–11 yrs)',
      mcqs: [
        {
          id: 'mcq_phy_pri_1',
          question_text: 'Which of the following materials is a good conductor of electricity?',
          options: ['A. Copper wire', 'B. Rubber eraser', 'C. Plastic ruler', 'D. Wooden stick'],
          correct_option: 'A. Copper wire',
          explanation: 'Metals like copper have free valence electrons that allow electrical current to flow easily.',
          blooms_level: 'Remembering'
        },
        {
          id: 'mcq_phy_pri_2',
          question_text: 'What force pulls objects toward the center of the Earth and causes dropped objects to fall?',
          options: ['A. Gravity', 'B. Friction', 'C. Magnetism', 'D. Static Electricity'],
          correct_option: 'A. Gravity',
          explanation: 'Gravity is the attractive force exerted by Earth that pulls objects toward its center.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for introducing "Magnets & Magnetic Attraction/Repulsion" to Grade 3/4 students using hands-on exploration stations. Include: 1. SMART objectives, 2. Inquiry hook with floating paperclips, 3. 3-tier differentiation, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates hands-on experiential physics for young learners and misconception remediation.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Demonstrate how simple electric circuits work (Battery + Wires + Bulb) using whiteboard drawings and physical analogies.',
        rubric_hint: 'Evaluates energetic storytelling, clear circuit diagrams, and interactive student engagement.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: During a classroom science activity, a student accidentally spills water on their team\'s circuit materials and bursts into tears. How do you handle safety and restore calm?',
        rubric_hint: 'Evaluates quick safety reflexes and comforting emotional containment.'
      }
    },
    secondary: {
      subject: 'Physics',
      segment: 'Secondary (Grades 9–10, 14–16 yrs)',
      mcqs: [
        {
          id: 'mcq_phy_sec_1',
          question_text: 'According to Newton\'s Third Law of Motion, action and reaction forces:',
          options: [
            'A. Act on two different bodies in opposite directions simultaneously',
            'B. Act on the same body and cancel each other out',
            'C. Act at different times with unequal magnitudes',
            'D. Only apply to stationary objects'
          ],
          correct_option: 'A. Act on two different bodies in opposite directions simultaneously',
          explanation: 'Action and reaction forces always act on two distinct objects, which is why they do not cancel each other out.',
          blooms_level: 'Analyzing'
        },
        {
          id: 'mcq_phy_sec_2',
          question_text: 'Three resistors of 6 ohms, 3 ohms, and 2 ohms are connected in parallel. What is the equivalent resistance of the circuit?',
          options: ['A. 1 ohm', 'B. 11 ohms', 'C. 2 ohms', 'D. 0.5 ohm'],
          correct_option: 'A. 1 ohm',
          explanation: '1/R = 1/6 + 1/3 + 1/2 = 1/6 + 2/6 + 3/6 = 6/6 = 1 => R = 1 ohm.',
          blooms_level: 'Applying'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Newton\'s Third Law & Momentum Conservation" for Grade 9/10. Include: 1. SMART objectives, 2. A 5-min inquiry hook addressing why action-reaction pairs don\'t cancel out, 3. 3-tier differentiation, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates board exam alignment, high-yield conceptual scaffolding, error analysis, and 3-tier differentiation.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Deliver a 5-minute teaching demo explaining the derivation and graphical interpretation of "Kinematic Equations of Motion (v=u+at, s=ut+1/2at^2)" on a chalkboard.',
        rubric_hint: 'Evaluates structured problem solving, clear graphical axes notation, and board exam pacing.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A student consistently performs poorly in Grade 10 physics mock exams and has severe exam panic. How do you structure a joint student-parent counselling meeting?',
        rubric_hint: 'Evaluates secondary counselling skills, structured remediation plans, and managing parental expectations.'
      }
    },
    senior: {
      subject: 'Physics',
      segment: 'Senior Secondary (Grades 11–12, 16–18 yrs)',
      mcqs: [
        {
          id: 'mcq_phy_sr_1',
          question_text: 'A solid cylinder and a hollow sphere of equal mass and radius roll down an inclined plane from rest without slipping. Which reaches the bottom first?',
          options: [
            'A. Solid Cylinder (smaller moment of inertia fraction 1/2 vs 2/3)',
            'B. Hollow Sphere',
            'C. Both reach at exactly the same time',
            'D. Depends on the angle of inclination'
          ],
          correct_option: 'A. Solid Cylinder (smaller moment of inertia fraction 1/2 vs 2/3)',
          explanation: 'Acceleration a = (g sin theta)/(1 + k^2/R^2). Since I(cylinder)=0.5MR^2 and I(hollow sphere)=0.67MR^2, the cylinder has greater acceleration.',
          blooms_level: 'Evaluating'
        },
        {
          id: 'mcq_phy_sr_2',
          question_text: 'According to Lenz\'s Law and Faraday\'s Law, the induced electromotive force (EMF) in a closed coil always:',
          options: [
            'A. Opposes the change in magnetic flux producing it (e = -dPhi/dt)',
            'B. Assists and amplifies the magnetic flux increase',
            'C. Is independent of the number of turns in the coil',
            'D. Generates an infinite electric current'
          ],
          correct_option: 'A. Opposes the change in magnetic flux producing it (e = -dPhi/dt)',
          explanation: 'Lenz\'s law is a consequence of conservation of energy; the induced current produces a magnetic field opposing the flux change.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Identify the single most common conceptual misconception students have in "Rotational Dynamics & Torque" OR "Electromagnetic Induction & Lenz\'s Law". Write the exact diagnostic question and step-by-step mathematical proof.',
        rubric_hint: 'Evaluates competitive domain rigor (JEE/NEET/Advanced Board), deductive mathematical proofs, and diagnostic precision.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the derivation and physical mechanism of "Lenz\'s Law & Electromagnetic Induction" on a whiteboard with clear direction vectors.',
        rubric_hint: 'Evaluates advanced domain rigor, mathematical derivations, clear sign convention explanation, and competitive problem-solving focus.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A top-performing Grade 12 JEE/NEET aspirant complains that your classroom pacing is too slow because you spend too much time clarifying foundational doubts for average students. How do you address the student privately and balance classroom pacing?',
        rubric_hint: 'Evaluates handling high-achievers: providing advanced extension problem sets while protecting foundational classroom equity.'
      }
    }
  },

  // =========================================================================
  // ENGLISH
  // =========================================================================
  english: {
    primary: {
      subject: 'English',
      segment: 'Primary (Grades 1–5, 6–11 yrs)',
      mcqs: [
        {
          id: 'mcq_eng_pri_1',
          question_text: 'Which sentence uses the correct plural form and subject-verb agreement?',
          options: [
            'A. The children are playing joyfully in the school park.',
            'B. The childs is playing joyfully in the school park.',
            'C. The childrens are playing joyfully in the school park.',
            'D. The children is playing joyfully in the school park.'
          ],
          correct_option: 'A. The children are playing joyfully in the school park.',
          explanation: '\'Children\' is the irregular plural of \'child\' and takes the plural verb \'are\'.',
          blooms_level: 'Understanding'
        },
        {
          id: 'mcq_eng_pri_2',
          question_text: 'In the sentence "The clever fox jumped over the lazy dog", which word is an adjective?',
          options: ['A. Clever', 'B. Jumped', 'C. Over', 'D. Fox'],
          correct_option: 'A. Clever',
          explanation: '\'Clever\' describes the noun \'fox\', making it an adjective.',
          blooms_level: 'Understanding'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Introduction to Adjectives & Sensory Vocabulary" for Grade 3. Include: 1. A mystery feely-bag inquiry hook, 2. Differentiated descriptive writing tasks, 3. Grammar misconception remediation, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates language acquisition techniques, vocabulary scaffolding, and interactive participation.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Deliver an expressive 5-minute teaching demo on "Action Verbs vs. Descriptive Adjectives" with dynamic vocal modulation and board sketches.',
        rubric_hint: 'Evaluates expressive vocal modulation, storytelling clarity, and visual board presence.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: A Grade 2 ESL child who speaks only their mother tongue at home is too shy to speak English in class and remains completely silent. How do you scaffold their communicative confidence?',
        rubric_hint: 'Evaluates ESL scaffolding, TPR (Total Physical Response), and creating a low-affective-filter classroom.'
      }
    },
    secondary: {
      subject: 'English',
      segment: 'Secondary (Grades 9–10, 14–16 yrs)',
      mcqs: [
        {
          id: 'mcq_eng_sec_1',
          question_text: 'Which literary device is employed in the phrase "The leaves danced playfully in the whispering wind"?',
          options: ['A. Personification', 'B. Oxymoron', 'C. Hyperbole', 'D. Irony'],
          correct_option: 'A. Personification',
          explanation: 'Giving human characteristics (dancing, whispering) to non-human elements (leaves, wind) is personification.',
          blooms_level: 'Analyzing'
        },
        {
          id: 'mcq_eng_sec_2',
          question_text: 'Choose the sentence that correctly transforms from Active to Passive voice: "The architect designed the magnificent library."',
          options: [
            'A. The magnificent library was designed by the architect.',
            'B. The magnificent library is designed by the architect.',
            'C. The architect was designing the magnificent library.',
            'D. The magnificent library had been designing by the architect.'
          ],
          correct_option: 'A. The magnificent library was designed by the architect.',
          explanation: 'Simple past active (\'designed\') converts to \'was/were + past participle\' (\'was designed\').',
          blooms_level: 'Applying'
        }
      ],
      theoryPrompt: {
        question_text: 'Design a 35-minute lesson plan for "Analyzing Poetic Devices & Symbolism in Literature" for Grade 10. Include: 1. SMART objectives, 2. A 5-min music lyrics inquiry hook, 3. Tiered annotation worksheets, and 4. A 2-question exit ticket.',
        rubric_hint: 'Evaluates literary analysis, Socratic questioning, and structured textual annotation.'
      },
      demoPrompt: {
        question_text: '5-Minute Micro-Teaching Demo: Teach the structural elements of a "Persuasive Essay Thesis Statement (Claim + Reasoning + Counterargument)" on a chalkboard.',
        rubric_hint: 'Evaluates rhetorical pedagogy, chalkboard writing structure, and engaging tone.'
      },
      situationalPrompt: {
        question_text: 'Situational Video Response: During a Grade 10 English debate on a sensitive social topic, an argument becomes personal and two students exchange disrespectful remarks. How do you intervene, de-escalate, and redirect to constructive academic debate?',
        rubric_hint: 'Evaluates restorative de-escalation, establishing classroom debate ground rules, and emotional containment.'
      }
    }
  }
};

/**
 * Classifies a free-text subject/segment string into the coarse buckets this
 * module organizes content by. Exported so callers outside this file (the
 * candidate assessment page, matching a school-generated AssessmentPack to a
 * candidate) classify subject and grade the same way resolveSubjectPacket
 * does internally — using two different heuristics for the same comparison
 * is how "Biology" and "Biology / Life Sciences" could end up looking like a
 * mismatch to one piece of code and a match to another.
 */
export function subjectBucket(subject?: string): keyof typeof SUBJECT_PACKETS {
  const s = (subject || '').toLowerCase().trim();
  if (s.includes('bio')) return 'biology';
  if (s.includes('math')) return 'math';
  if (s.includes('eng')) return 'english';
  return 'physics'; // chem/sci/physics, and anything unmapped (e.g. Social Studies) — same default resolveSubjectPacket always used
}

export function segmentTier(segment?: string): 'primary' | 'middle' | 'secondary' | 'senior' {
  const s = (segment || '').toLowerCase().trim();
  if (s.includes('pre') || s.includes('pri') || s.includes('1-5') || s.includes('3-6')) return 'primary';
  if (s.includes('mid') || s.includes('6-8')) return 'middle';
  if (s.includes('sr') || s.includes('senior') || s.includes('11-12')) return 'senior';
  return 'secondary';
}

// Fallback helper to normalize subject and segment keys
export function resolveSubjectPacket(subject: string, segment: string): DynamicSubjectPacket {
  const selectedSubjectGroup = SUBJECT_PACKETS[subjectBucket(subject)];

  // Prefer the classified tier, but fall back to a tier this subject group
  // actually has content for rather than returning nothing.
  let segTier: string = segmentTier(segment);
  if (segTier === 'middle' && !selectedSubjectGroup.middle) {
    segTier = selectedSubjectGroup.secondary ? 'secondary' : 'primary';
  } else if (segTier === 'secondary' && !selectedSubjectGroup.secondary) {
    segTier = 'primary';
  } else if (segTier === 'senior' && !selectedSubjectGroup.senior) {
    segTier = 'secondary';
  }

  const packet = selectedSubjectGroup[segTier] || Object.values(selectedSubjectGroup)[0];

  return {
    ...packet,
    subject: subject || packet.subject,
    segment: segment || packet.segment
  };
}
