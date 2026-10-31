import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Briefcase,
  Send,
  UploadCloud,
  UserRoundCheck,
  Video,
} from 'lucide-react';

export type HiringFlowStep = {
  n: number;
  title: string;
  body: string;
  Icon: LucideIcon;
};

/** Shared hiring sequence for the hero flowchart and the How hiring works section. */
export const HIRING_FLOW_STEPS: HiringFlowStep[] = [
  {
    n: 1,
    title: 'Create & post vacancy',
    body: 'AI drafts the job post. Publish it on your jobs page.',
    Icon: Briefcase,
  },
  {
    n: 2,
    title: 'Add leads',
    body: 'Upload your leads: name, subject and phone.',
    Icon: UploadCloud,
  },
  {
    n: 3,
    title: 'WhatsApp invites',
    body: 'Each teacher gets a test link on WhatsApp.',
    Icon: Send,
  },
  {
    n: 4,
    title: 'Five-stage AI test',
    body: 'Written test, teaching video and a classroom scenario, with camera checks.',
    Icon: Video,
  },
  {
    n: 5,
    title: 'AI-powered shortlist',
    body: 'Teachers are ranked, with a reason for every score.',
    Icon: Award,
  },
  {
    n: 6,
    title: 'Principal interview',
    body: 'Subject lead, principal, then management. Every decision stays on file.',
    Icon: UserRoundCheck,
  },
];
