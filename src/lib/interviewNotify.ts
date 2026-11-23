/**
 * Who is told what as a teacher moves through the review rounds.
 *
 *  - An interview is booked: the candidate (WhatsApp and email, with the Meet
 *    link), the interviewer, everyone else who reviews that round, and HR.
 *  - A round is passed: the people who review the next round, and HR, so
 *    someone books it. After the final round: HR and the admins, to send the offer.
 *
 * Everything here is best-effort: a missing email service or WhatsApp line
 * never stops a booking or a decision. The person who did the action is not
 * emailed about their own action.
 */

import { db } from './db';
import { sendEmail } from './emailClient';
import { escapeHtml } from './escapeHtml';
import { signInLinkFor } from './assessmentInvite';
import { appOrigin } from './googleOAuth';
import { accessOf } from './permissions';
import { sendFreeformMessage, sendTemplateMessage } from './whatsappClient';
import { createCandidateMagicLinkToken } from './session';
import type { Candidate, ReviewRound, School, ScheduledInterview, User } from './types';

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

const realEmail = (e: string | undefined) => !!e && e.includes('@') && !e.endsWith('.local');

/**
 * The people to tell about a round. `team` is everyone who holds one of the
 * round's roles; `hr` is HR (and admins when there is no HR). Each person is in
 * one list only, and `skipId` (whoever did the action) is in none.
 */
export function roundAudience(users: User[], round: ReviewRound, opts: { assignedId?: string; skipId?: string } = {}) {
  const usable = users.filter((u) => u.id !== opts.skipId && realEmail(u.email));
  const assigned = usable.find((u) => u.id === opts.assignedId);
  const team = usable.filter((u) => u.id !== assigned?.id && round.role_ids.includes(u.role_id ?? u.role));
  const taken = new Set([assigned?.id, ...team.map((u) => u.id)]);
  const hrPeople = usable.filter((u) => accessOf(u.role) === 'hr' && !taken.has(u.id));
  const hr = hrPeople.length ? hrPeople : usable.filter((u) => accessOf(u.role) === 'admin' && u.role !== 'SUPER_ADMIN' && !taken.has(u.id));
  return { assigned, team, hr };
}

function button(href: string, label: string): string {
  return `<p><a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

async function mail(to: User | { email: string; name: string }, subject: string, lines: string[], html: string, school: School | undefined, replyTo?: string): Promise<boolean> {
  const r = await sendEmail({ to: to.email, subject, text: lines.join('\n\n'), html, kind: 'interview', fromName: school?.name, replyTo }).catch(() => null);
  return r?.ok === true;
}

export interface ScheduledNotice {
  candidate_whatsapp: boolean;
  candidate_email: boolean;
  /** Names of the staff who were emailed. */
  staff: string[];
  /** Why the candidate was not reached on a channel, in plain words. */
  problems?: string[];
}

/** Tells everyone about a newly booked interview. */
export async function notifyInterviewScheduled(input: {
  school: School;
  candidate: Candidate;
  interview: ScheduledInterview;
  round: ReviewRound;
  scheduledBy: User;
}): Promise<ScheduledNotice> {
  const { school, candidate, interview, round, scheduledBy } = input;
  const when = formatWhen(interview.scheduled_at);
  const link = interview.meeting_link;
  const google = interview.meeting_provider === 'google_meet';

  // --- The candidate ---
  let candidate_whatsapp = false;
  const problems: string[] = [];
  if (!candidate.phone) problems.push('WhatsApp: the candidate has no phone number.');
  else if (!school.whatsapp_hiring || school.whatsapp_hiring.status === 'not_connected') problems.push('WhatsApp: your school has not connected WhatsApp.');
  if (candidate.phone && school.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected') {
    // Inside an open chat the Meet link itself can be sent. Otherwise only the
    // approved template, whose button signs them in to their page with the link.
    const text = [
      `Hello ${candidate.name}, your ${round.name} interview at ${school.name} is booked.`,
      `When: ${when} (${interview.duration_minutes} minutes)`,
      `With: ${interview.assigned_user_name}`,
      `Join here: ${link}`,
      'Please join on time from a quiet place with your camera on.',
    ].join('\n');
    const free = db.isWindowOpen(school.id, candidate.id)
      ? await sendFreeformMessage({ school, candidateId: candidate.id, toRaw: candidate.phone, text }).catch(() => null)
      : null;
    const sent = free?.ok ? free : await sendTemplateMessage({
      school,
      candidateId: candidate.id,
      toRaw: candidate.phone,
      template: 'round_scheduled',
      bodyParams: [candidate.name, round.name, interview.assigned_user_name, when],
      buttonParam: createCandidateMagicLinkToken(candidate.id, candidate.school_id, 7 * 24 * 60 * 60),
    }).catch(() => null);
    candidate_whatsapp = !!sent?.ok;
    if (!sent?.ok) {
      problems.push(sent && !sent.ok && sent.reason === 'no_consent'
        ? 'WhatsApp: the candidate has not agreed to WhatsApp messages.'
        : `WhatsApp: Meta refused the message${sent && !sent.ok && sent.detail ? ` (${sent.detail})` : ''}. Check the connection on the WhatsApp page.`);
    }
  }

  let candidate_email = false;
  if (!realEmail(candidate.email)) problems.push('Email: the candidate has no real email address.');
  if (realEmail(candidate.email)) {
    const portal = signInLinkFor(candidate);
    const lines = [
      `Hello ${candidate.name},`,
      `Your ${round.name} interview for the ${candidate.applied_subject} post at ${school.name} is booked.`,
      `When: ${when} (${interview.duration_minutes} minutes, India time)\nWith: ${interview.assigned_user_name}\nJoin the video call: ${link}`,
      google ? 'You will also get a Google Calendar invite for it.' : '',
      `Your application page, with these details: ${portal}`,
      'Please join on time from a quiet place, with your camera on. If you cannot make it, reply to this email.',
      `— ${school.name}`,
    ].filter(Boolean);
    const html = [
      `<p>Hello ${escapeHtml(candidate.name)},</p>`,
      `<p>Your <strong>${escapeHtml(round.name)}</strong> interview for the ${escapeHtml(candidate.applied_subject)} post at ${escapeHtml(school.name)} is booked.</p>`,
      `<p><strong>When:</strong> ${escapeHtml(when)} (${interview.duration_minutes} minutes, India time)<br/><strong>With:</strong> ${escapeHtml(interview.assigned_user_name)}</p>`,
      button(link, google ? 'Join Google Meet' : 'Join the video call'),
      `<p style="color:#64748b;font-size:13px">Link: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
      google ? '<p>You will also get a Google Calendar invite for it.</p>' : '',
      `<p><a href="${escapeHtml(portal)}">Open your application page</a> to see these details any time.</p>`,
      '<p>Please join on time from a quiet place, with your camera on. If you cannot make it, reply to this email.</p>',
      `<p>— ${escapeHtml(school.name)}</p>`,
    ].join('');
    candidate_email = await mail({ email: candidate.email, name: candidate.name }, `Your ${round.name} interview at ${school.name}: ${when}`, lines, html, school, school.primary_contact?.email || scheduledBy.email);
    if (!candidate_email) problems.push('Email: the email could not be sent (check the email service).');
  }

  // --- The school's people: in the app only (the bell), never WhatsApp or email ---
  const { assigned, team } = roundAudience(db.getUsersBySchool(school.id), round, { assignedId: interview.assigned_user_id, skipId: scheduledBy.id });
  const staff: string[] = [];
  const notice = (person: User, title: string, body: string) => {
    db.addNotification({
      id: `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: school.id,
      user_id: person.id,
      kind: 'interview_scheduled',
      title,
      body,
      href: accessOf(person.role) === 'reviewer' ? '/reviewer/home' : '/admin/interviews',
      created_at: new Date().toISOString(),
    });
    staff.push(person.name);
  };
  const details = `${when} (${interview.duration_minutes} min). Meeting link: ${link}`;
  if (assigned) {
    notice(
      assigned,
      `Interview booked: ${candidate.name} (${round.name})`,
      `${scheduledBy.name} booked you for the ${round.name} interview with ${candidate.name} (${candidate.applied_subject}). ${details}${interview.notes ? ` Note: ${interview.notes}` : ''}`
    );
  }
  for (const person of team) {
    notice(person, `Interview booked: ${candidate.name} (${round.name})`, `${candidate.name}'s ${round.name} interview is booked with ${interview.assigned_user_name}. ${details}`);
  }

  return { candidate_whatsapp, candidate_email, staff, ...(problems.length ? { problems } : {}) };
}

/**
 * A round was passed: tell whoever acts next. Before the last round, the next
 * round's reviewers and HR (to book it). After the last, HR (to send the offer).
 */
export async function notifyRoundCleared(input: {
  school: School;
  candidate: Candidate;
  round: ReviewRound;
  next: ReviewRound | null;
  decidedBy: User;
  note: string;
}): Promise<string[]> {
  const { school, candidate, round, next, decidedBy, note } = input;
  const users = db.getUsersBySchool(school.id);
  const page = next ? `${appOrigin()}/admin/interviews?round=${encodeURIComponent(next.id)}&candidate=${encodeURIComponent(candidate.id)}` : `${appOrigin()}/admin/candidates/${candidate.id}`;
  const people = next
    ? (() => { const a = roundAudience(users, next, { skipId: decidedBy.id }); return [...a.team, ...a.hr]; })()
    : (() => { const a = roundAudience(users, round, { skipId: decidedBy.id }); return a.hr; })();
  const told: string[] = [];
  for (const person of people) {
    const subject = next
      ? `${candidate.name} cleared ${round.name}: book the ${next.name} round`
      : `${candidate.name} is selected: send the offer`;
    const ok = await mail(person, subject, [
      `Hi ${person.name},`,
      `${decidedBy.name} said yes to ${candidate.name} (${candidate.applied_subject}) at the ${round.name} round.`,
      `Their opinion: ${note}`,
      next ? `Next is the ${next.name} round. Book it here: ${page}` : `That was the final round. Send the offer letter: ${page}`,
    ], [
      `<p>Hi ${escapeHtml(person.name)},</p>`,
      `<p>${escapeHtml(decidedBy.name)} said <strong>yes</strong> to <strong>${escapeHtml(candidate.name)}</strong> (${escapeHtml(candidate.applied_subject)}) at the ${escapeHtml(round.name)} round.</p>`,
      `<p style="color:#475569">“${escapeHtml(note)}”</p>`,
      button(page, next ? `Book the ${next.name} round` : 'Send the offer'),
    ].join(''), school, decidedBy.email);
    if (ok) told.push(person.name);
  }
  return told;
}

/**
 * The school invited a candidate to the spoken AI interview. The candidate is
 * told by email and, when their WhatsApp chat with the school is open, on
 * WhatsApp. Best effort: it never stops the invitation itself.
 */
export async function notifyAiInterviewInvite(input: { school: School; candidate: Candidate }): Promise<{ whatsapp: boolean; email: boolean }> {
  const { school, candidate } = input;
  const link = `${appOrigin()}/interview/${candidate.id}`;
  const portal = signInLinkFor(candidate);
  const first = candidate.name.split(' ')[0] || candidate.name;

  let whatsapp = false;
  if (candidate.phone && school.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected' && db.isWindowOpen(school.id, candidate.id)) {
    const text = [
      `Hello ${first}, ${school.name} has invited you to a short spoken interview.`,
      'It is about 18 minutes, by voice, with an AI interviewer. You need a quiet room and a microphone.',
      `Open your application to start it: ${portal}`,
    ].join('\n');
    const sent = await sendFreeformMessage({ school, candidateId: candidate.id, toRaw: candidate.phone, text }).catch(() => null);
    whatsapp = sent?.ok === true;
  }

  let email = false;
  if (realEmail(candidate.email)) {
    const lines = [
      `Hello ${first},`,
      `${school.name} has invited you to a short spoken interview for the ${candidate.applied_subject} post.`,
      'It takes about 18 minutes, by voice, with an AI interviewer. Find a quiet room and use a device with a microphone.',
      `Open your application and start it here: ${portal}`,
      `— ${school.name}`,
    ];
    const html = [
      `<p>Hello ${escapeHtml(first)},</p>`,
      `<p>${escapeHtml(school.name)} has invited you to a short spoken interview for the ${escapeHtml(candidate.applied_subject)} post.</p>`,
      '<p>It takes about 18 minutes, by voice, with an AI interviewer. Find a quiet room and use a device with a microphone.</p>',
      button(portal, 'Start your interview'),
      `<p style="color:#64748b;font-size:13px">Or open: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a> (you will be asked to sign in)</p>`,
      `<p>— ${escapeHtml(school.name)}</p>`,
    ].join('');
    email = await mail({ email: candidate.email, name: candidate.name }, `${school.name} has invited you to a spoken interview`, lines, html, school, school.primary_contact?.email);
  }
  return { whatsapp, email };
}
