import { db } from './db';
import { createCandidateMagicLinkToken } from './session';
import { sendTemplateMessage, type SendOutcome } from './whatsappClient';
import { sendEmail } from './emailClient';
import { appOrigin } from './googleOAuth';
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

/** The one link that opens this candidate's application on any device, good for a week. */
export function signInLinkFor(candidate: Pick<Candidate, 'id' | 'school_id'>): string {
  const token = createCandidateMagicLinkToken(candidate.id, candidate.school_id, INVITE_LINK_VALIDITY_SEC);
  return `${appOrigin()}/api/candidates/magic-login?token=${token}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Emails the candidate their link, if they gave a real address. Does nothing without an email service set up. */
export async function sendInviteEmail(school: School, candidate: Candidate): Promise<boolean> {
  if (!candidate.email || !candidate.email.includes('@') || candidate.email.endsWith('.local')) return false;
  const link = signInLinkFor(candidate);
  const text = [
    `Hello ${candidate.name},`,
    `Thank you for applying for the ${candidate.applied_subject} position at ${school.name}.`,
    `Open your application here, on any phone or computer. No password is needed:\n${link}`,
    candidate.invite_code ? `Your application ID is ${candidate.invite_code}.` : '',
    'The link works for 7 days. Please do not share it, because it opens your application.',
    `— ${school.name}, via Edcruiter`
  ].filter(Boolean).join('\n\n');
  const html = [
    `<p>Hello ${escapeHtml(candidate.name)},</p>`,
    `<p>Thank you for applying for the ${escapeHtml(candidate.applied_subject)} position at ${escapeHtml(school.name)}.</p>`,
    `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">Open my application</a></p>`,
    '<p>It opens on any phone or computer and needs no password. The link works for 7 days. Please do not share it.</p>',
    candidate.invite_code ? `<p>Your application ID: <strong>${escapeHtml(candidate.invite_code)}</strong></p>` : '',
    `<p>— ${escapeHtml(school.name)}, via Edcruiter</p>`
  ].join('');
  const result = await sendEmail({ to: candidate.email, subject: `Continue your application to ${school.name}`, text, html }).catch(() => null);
  return result?.ok === true;
}

/**
 * Sends a candidate who just applied from the job portal their way back in, on
 * both channels. Each is best-effort: WhatsApp only if they agreed and the
 * school's line is connected, email only with a real address and an email
 * service configured. Failing to send never blocks the application.
 */
export async function sendApplicationLinks(school: School, candidate: Candidate): Promise<{ whatsapp: boolean; email: boolean }> {
  const whatsapp = await sendAssessmentInvite(school, candidate).then((r) => r.ok === true).catch(() => false);
  const email = await sendInviteEmail(school, candidate).catch(() => false);
  return { whatsapp, email };
}
