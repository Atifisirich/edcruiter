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
    body: 'HR writes the role in Recruiter. Edcruiter drafts the JD and posts it live on the teaching jobs board.',
    Icon: Briefcase,
  },
  {
    n: 2,
    title: 'Add leads',
    body: 'HR uploads teacher leads into Recruiter workspace — name, subject, and contact.',
    Icon: UploadCloud,
  },
  {
    n: 3,
    title: 'WhatsApp invites',
    body: 'Each lead gets a test code on WhatsApp so they can open the assessment on their own time.',
    Icon: Send,
  },
  {
    n: 4,
    title: 'Five-stage AI test',
    body: 'Proctored test: profile, written + MCQs, live teaching demo, classroom scenario, then school policies.',
    Icon: Video,
  },
  {
    n: 5,
    title: 'AI-powered shortlist',
    body: 'Edcruiter ranks teachers from the scored stages (written, demo, scenario). HR reviews the AI shortlist and sends only the strongest profiles to leadership.',
    Icon: Award,
  },
  {
    n: 6,
    title: 'Principal interview',
    body: 'Subject lead, then the principal, then management. Each decision and reason stays on the teacher’s file.',
    Icon: UserRoundCheck,
  },
];
