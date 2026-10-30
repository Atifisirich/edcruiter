import { db } from './db';
import { createCandidateMagicLinkToken } from './session';
import { sendTemplateMessage, type SendOutcome } from './whatsappClient';
import type { Candidate, School } from './types';

// The invite's sign-in button works for a week. Anything shorter and a
// teacher who taps it the next day lands on a login screen that needs a code.
export const INVITE_LINK_VALIDITY_SEC = 7 * 24 * 60 * 60;

/**
 * Sends the approved `assessment_invite` template to one candidate and, if it
 * went out, records when. Consent, daily-limit and template checks all happen
 * inside sendTemplateMessage. Template variables, in the order the approved
 * wording expects: name, school, subject, application ID (the invite code).
 */
export async function sendAssessmentInvite(school: School, candidate: Candidate): Promise<SendOutcome> {
  const result = await sendTemplateMessage({
    school,
    candidateId: candidate.id,
    toRaw: candidate.phone,
    template: 'assessment_invite',
    bodyParams: [candidate.name, school.name, candidate.applied_subject, candidate.invite_code || candidate.id],
    buttonParam: createCandidateMagicLinkToken(candidate.id, candidate.school_id, INVITE_LINK_VALIDITY_SEC),
  });
  if (result.ok) {
    db.updateCandidate(candidate.school_id, candidate.id, { whatsapp_invite_sent_at: new Date().toISOString() });
  }
  return result;
}
