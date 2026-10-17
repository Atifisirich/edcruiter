import { randomBytes } from 'crypto';

/**
 * Generates a working video-meeting link with no external API key and no
 * account required — jit.si rooms exist the moment two people open the same
 * URL. Used as the default when HR schedules an interview without pasting
 * their own Google Meet link. The room name is unguessable (not just the
 * candidate id) so a room can't be found by someone iterating candidate IDs.
 */
export function generateMeetingLink(candidateId: string, round: string): string {
  const suffix = randomBytes(5).toString('hex');
  const room = `Edcruiter-${candidateId}-${round}-${suffix}`.replace(/[^a-zA-Z0-9-]/g, '');
  return `https://meet.jit.si/${room}`;
}
