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
