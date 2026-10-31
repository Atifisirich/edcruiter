/**
 * What a candidate is told about each stage, in plain words. The stage names
 * and descriptions in a school's configuration are written for staff (and one
 * of them quotes a single school's working hours), so the candidate pages use
 * this instead.
 */

export interface StageGuide {
  /** Short name used in the progress bar. */
  short: string;
  /** Full heading shown above the stage. */
  title: string;
  /** How long it takes. */
  time: string;
  /** One sentence on what this stage is. */
  summary: string;
  /** What to do, in order. */
  steps: string[];
  /** Whether the camera is on during this stage. */
  camera: boolean;
}

export const STAGE_GUIDE: Record<string, StageGuide> = {
  identity_verification: {
    short: 'Your details',
    title: 'Your details and CV',
    time: '5–10 min',
    summary: 'Tell the school about yourself and upload your CV.',
    steps: [
      'Fill in your details. Fields marked * are needed.',
      'Upload your CV as a PDF.',
      'Save. You can take a break before the next stage.',
    ],
    camera: false,
  },
  written_theory: {
    short: 'Subject test',
    title: 'Subject test and lesson plan',
    time: '30–40 min',
    summary: 'Show what you know, then plan a lesson.',
    steps: [
      'Part A: answer every question. Choose one answer for each.',
      'Part B: write a lesson plan for the topic given.',
      'Submit both together. You will not see marks.',
    ],
    camera: true,
  },
  micro_teaching_demo: {
    short: 'Teaching demo',
    title: 'Teach a short lesson on camera',
    time: 'Up to 5 min',
    summary: 'Teach the topic below as if the camera were your class.',
    steps: [
      'Read the topic. You get 1 minute to prepare.',
      'Recording starts by itself, or tap Start when you are ready.',
      'Face the camera, speak clearly, and teach for up to 5 minutes.',
      'Tap Finish when you are done, then submit.',
    ],
    camera: true,
  },
  situational_scenario: {
    short: 'Classroom scenario',
    title: 'Handle a classroom situation',
    time: 'Up to 2 min',
    summary: 'Tell us what you would do in the situation below.',
    steps: [
      'Read the situation. You get 1 minute to prepare.',
      'Recording starts by itself, or tap Start when you are ready.',
      'Say out loud what you would do and why, for up to 2 minutes.',
      'Add written notes if you like, then submit.',
    ],
    camera: true,
  },
  hr_policy_briefing: {
    short: 'School policies',
    title: 'School policies and child safety',
    time: '2 min',
    summary: 'Read the school’s policies and confirm you agree. This stage is not scored.',
    steps: [
      'Read the policies below.',
      'Tick both boxes to confirm.',
      'Submit to finish your application.',
    ],
    camera: true,
  },
};

export const STAGE_ORDER = [
  'identity_verification',
  'written_theory',
  'micro_teaching_demo',
  'situational_scenario',
  'hr_policy_briefing',
] as const;
