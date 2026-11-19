'use client';

export interface ApplicationMessage {
  message: string;
  link: string;
  application_id: string | null;
  login_url: string;
  valid_days: number;
}

/** Fetches the ready-to-send message for a candidate (their sign-in link and application ID, each labelled). */
export async function fetchApplicationMessage(candidateId: string): Promise<ApplicationMessage> {
  const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}/invite-message`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.message) throw new Error(data.error || 'Could not make the message.');
  return data as ApplicationMessage;
}

/**
 * Copies the message. The clipboard is asked for straight away (before the
 * fetch finishes) so browsers that only allow copying right after a click,
 * like Safari, still allow it.
 */
export async function copyApplicationMessage(candidateId: string): Promise<ApplicationMessage> {
  const pending = fetchApplicationMessage(candidateId);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': pending.then((m) => new Blob([m.message], { type: 'text/plain' })) })]);
      return pending;
    } catch {
      /* fall back to writeText below */
    }
  }
  const m = await pending;
  await navigator.clipboard.writeText(m.message);
  return m;
}
