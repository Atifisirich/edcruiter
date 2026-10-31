import { sendEmail, type EmailOutcome } from './emailClient';
import { escapeHtml } from './escapeHtml';
import { setPasswordLinkFor, type PasswordLinkKind } from './accountService';

type Wording = { subject: string; heading: string; lines: string[]; button: string; lifetime: string };

function wording(kind: PasswordLinkKind, extra: { schoolName?: string; inviterName?: string }): Wording {
  if (kind === 'invite') {
    const school = extra.schoolName || 'a school';
    const who = extra.inviterName ? `${extra.inviterName} added you` : 'You have been added';
    return {
      subject: `You have been added to ${school} on Edcruiter`,
      heading: `Join ${school} on Edcruiter`,
      lines: [
        `${who} to the hiring team at ${school}.`,
        'Choose a password to get in. If you would rather sign in with Google, use this same email address on the sign-in page.',
      ],
      button: 'Choose my password',
      lifetime: '7 days',
    };
  }
  if (kind === 'reset') {
    return {
      subject: 'Reset your Edcruiter password',
      heading: 'Reset your password',
      lines: ['Someone asked to reset the password for this Edcruiter account. If it was you, choose a new password below.', 'If it was not you, ignore this email. Your password stays as it is.'],
      button: 'Choose a new password',
      lifetime: '1 hour',
    };
  }
  return {
    subject: 'Confirm your email to finish creating your Edcruiter account',
    heading: 'Finish creating your account',
    lines: ['Confirm this is your email address and choose a password. That completes your Edcruiter account.', 'If you did not ask for this, ignore this email and nothing will be created.'],
    button: 'Confirm email and choose password',
    lifetime: '24 hours',
  };
}

/**
 * Sends the "choose your password" email. In development, where no email service
 * is set up, the link is written to the server log so the flow can still be tried.
 */
export async function sendSetPasswordEmail(params: {
  to: string;
  name: string;
  kind: PasswordLinkKind;
  schoolName?: string;
  inviterName?: string;
}): Promise<EmailOutcome & { devLink?: string }> {
  const link = setPasswordLinkFor(params.to, params.name, params.kind);
  const w = wording(params.kind, params);
  const greeting = params.name ? `Hello ${params.name},` : 'Hello,';

  const text = [greeting, ...w.lines, `${w.button}:\n${link}`, `This link works for ${w.lifetime} and can be used once.`, '— Edcruiter'].join('\n\n');
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    ...w.lines.map((l) => `<p>${escapeHtml(l)}</p>`),
    `<p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(w.button)}</a></p>`,
    `<p style="color:#64748b;font-size:13px">This link works for ${w.lifetime} and can be used once.</p>`,
    '<p>— Edcruiter</p>',
  ].join('');

  const outcome = await sendEmail({ to: params.to, subject: w.subject, text, html });
  if (!outcome.ok && outcome.reason === 'not_configured' && process.env.NODE_ENV !== 'production') {
    console.info(`[email:dev] ${w.subject} for ${params.to}\n${link}`);
    return { ...outcome, devLink: link };
  }
  return outcome;
}
