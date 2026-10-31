import { db } from './db';
import { sendTemplateMessage } from './whatsappClient';
import { sendEmail } from './emailClient';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export type OutcomeNotice = { whatsapp: boolean; email: boolean; skipped?: 'not_found' | 'already_notified' };

/**
 * Tells a declined candidate the outcome instead of leaving them waiting
 * forever. Best-effort on both channels: WhatsApp only goes out if the
 * candidate agreed to it (sendTemplateMessage checks), and email only to a
 * real address. Sends at most once per candidate, so a second decline in
 * another round, or a retried request, never messages them twice. The reason
 * the school recorded stays internal — candidates get a kind, generic note.
 */
export async function notifyCandidateDeclined(schoolId: string, candidateId: string): Promise<OutcomeNotice> {
  const candidate = db.getCandidateById(schoolId, candidateId);
  if (!candidate) return { whatsapp: false, email: false, skipped: 'not_found' };
  if (candidate.outcome_notified_at) return { whatsapp: false, email: false, skipped: 'already_notified' };

  const school = db.getSchoolById(schoolId);
  const schoolName = school?.name || 'the school';
  const role = candidate.applied_subject || 'teaching';

  let whatsapp = false;
  if (school && candidate.phone && school.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected') {
    const result = await sendTemplateMessage({
      school,
      candidateId: candidate.id,
      toRaw: candidate.phone,
      template: 'application_outcome',
      bodyParams: [candidate.name, schoolName, role],
    }).catch(() => null);
    whatsapp = !!result?.ok;
  }

  let email = false;
  // Lead imports without an email get a placeholder ending in .local.
  if (candidate.email && candidate.email.includes('@') && !candidate.email.endsWith('.local')) {
    const text = `Hello ${candidate.name},\n\nThank you for applying for the ${role} position at ${schoolName}, and for the time you gave to the assessment.\n\nAfter careful review, the school will not be moving ahead with your application this time. We wish you every success in your teaching career.\n\n— ${schoolName}, via Edcruiter`;
    const result = await sendEmail({
      to: candidate.email,
      subject: `Your application to ${schoolName}`,
      text,
      html: text.split('\n\n').map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join(''),
      kind: 'interview',
      fromName: schoolName,
      replyTo: school?.primary_contact?.email,
    }).catch(() => null);
    email = result?.ok === true;
  }

  if (whatsapp || email) {
    db.updateCandidate(schoolId, candidate.id, { outcome_notified_at: new Date().toISOString() });
  }
  return { whatsapp, email };
}
