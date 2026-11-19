/** Pulls an invite code like EDC-PHYS-A4K2 out of whatever was pasted around it. */
export function extractInviteCode(text: string): string {
  const match = (text || '').match(/EDC-[A-Za-z0-9]{2,8}-[A-Za-z0-9]{2,8}/i);
  return match ? match[0].toUpperCase() : (text || '').trim();
}

/**
 * If the text contains a sign-in link, returns the path on this site that
 * opens it. Only the token is taken from what was pasted: the host is ignored,
 * so a pasted link can never send the candidate to another website.
 */
export function signInPathFromPastedText(text: string): string | null {
  const t = (text || '').trim();
  if (!/magic-login/i.test(t)) return null;
  const token = t.match(/[?&]token=([^\s&#"'<>]+)/i);
  return token ? `/api/candidates/magic-login?token=${token[1]}` : null;
}

/** Digits only for a phone, trimmed otherwise, so "+91 98765 43210" and "9876543210" both work. */
export function cleanIdentifier(text: string): string {
  const t = (text || '').trim();
  if (t.includes('@')) return t.toLowerCase();
  const digits = t.replace(/[\s()-]/g, '');
  return /^\+?\d{8,15}$/.test(digits) ? digits : t;
}

/**
 * The message staff copy and send a candidate. It says plainly what each part
 * is: the link that opens their application, and, if that stops working, where
 * to go and the two things to type there (the mobile or email they applied
 * with, and their application ID).
 */
export function applicationMessage(input: {
  firstName: string;
  schoolName: string;
  post: string;
  link: string;
  loginUrl: string;
  applicationId?: string;
  validDays: number;
}): string {
  const lines = [
    `Hello ${input.firstName},`,
    `Here is how to continue your application to ${input.schoolName}${input.post ? ` for the ${input.post} post` : ''}.`,
    '',
    `1. Tap this link. It opens your application straight away, no password needed. It works for ${input.validDays} days:`,
    input.link,
  ];
  if (input.applicationId) {
    lines.push(
      '',
      `2. If the link has stopped working, open ${input.loginUrl} and type:`,
      '   - Mobile number or email: the one you applied with',
      `   - Application ID: ${input.applicationId}`,
    );
  }
  lines.push('', 'Please keep this message private: the link opens your application.');
  return lines.join('\n');
}

export type EntryKind = 'empty' | 'link' | 'phone' | 'email' | 'application_id' | 'unknown';

/** What a candidate typed into a sign-in box, so the page can say whether it is the right thing for that box. */
export function entryKind(text: string): EntryKind {
  const t = (text || '').trim();
  if (!t) return 'empty';
  if (signInPathFromPastedText(t) || /^https?:\/\//i.test(t)) return 'link';
  if (/EDC-[A-Za-z0-9]{2,8}-[A-Za-z0-9]{2,8}/i.test(t)) return 'application_id';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'email';
  if (/^\+?\d{10,13}$/.test(t.replace(/[\s()-]/g, ''))) return 'phone';
  return 'unknown';
}
