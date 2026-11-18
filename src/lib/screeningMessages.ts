/**
 * The messages around an AI screening call that are not the test link: a
 * heads-up before the call, a "we tried to reach you" after a missed call,
 * and the emails the school's HR gets (a good fit right now, a reminder about
 * results waiting for them, the daily summary, the monthly limit reached).
 *
 * Candidates get email, and WhatsApp only while a chat with them is open
 * (they wrote to the school's line in the last 24 hours): these messages have
 * no approved WhatsApp template, and Meta allows free text only inside that
 * window. Every send is best-effort and never throws.
 */

import { db } from './db';
import { sendEmail } from './emailClient';
import { sendFreeformMessage } from './whatsappClient';
import { appOrigin } from './googleOAuth';
import { escapeHtml } from './escapeHtml';
import type { Candidate, School } from './types';
import type { FullScreeningSettings } from './screeningCall';

const realEmail = (e: string | undefined) => !!e && e.includes('@') && !e.endsWith('.local');

/** "today at 4:00 pm", "tomorrow at 9:00 am", "Monday 23 Nov at 9:00 am", India time. */
export function whenText(at: Date, now: Date = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const time = at.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (day(at) === day(now)) return at.getTime() - now.getTime() < 15 * 60_000 ? 'in the next few minutes' : `today at ${time}`;
  if (day(at) === day(tomorrow)) return `tomorrow at ${time}`;
  return `${at.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' })} at ${time}`;
}

function paragraphsHtml(paras: string[]): string {
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('');
}

/** Tells the candidate something about the call, by email and (when a chat is open) WhatsApp. Returns the channels used. */
async function tellCandidate(school: School, candidate: Candidate, subject: string, paras: string[]): Promise<string[]> {
  const channels: string[] = [];
  if (candidate.phone && school.whatsapp_hiring && school.whatsapp_hiring.status !== 'not_connected') {
    const wa = await sendFreeformMessage({ school, candidateId: candidate.id, toRaw: candidate.phone, text: paras.join('\n\n') }).catch(() => null);
    if (wa?.ok) channels.push('WhatsApp');
  }
  if (realEmail(candidate.email)) {
    const r = await sendEmail({
      to: candidate.email,
      subject,
      text: paras.join('\n\n'),
      html: paragraphsHtml(paras),
      kind: 'interview',
      fromName: school.name,
      replyTo: school.primary_contact?.email,
    }).catch(() => null);
    if (r?.ok) channels.push('email');
  }
  return channels;
}

const agentNumber = () => process.env.SARVAM_AGENT_NUMBER || '';

/** Before an automatic call: so the candidate picks up a number they do not know. */
export function sendHeadsUp(school: School, candidate: Candidate, at: Date): Promise<string[]> {
  const role = candidate.applied_subject || 'teaching';
  const num = agentNumber();
  return tellCandidate(school, candidate, `A short call about your application to ${school.name}`, [
    `Hello ${candidate.name},`,
    `Thank you for applying for the ${role} position at ${school.name}.`,
    `Our AI assistant will call you ${whenText(at)}${num ? ` from ${num}` : ''} for a short chat of about three minutes about your application. Please keep your phone with you.`,
    'If it is not a good time when we call, just say when to call back.',
    `— ${school.name}, via Edcruiter`,
  ]);
}

/** After a missed call: so the candidate knows who called and picks up next time. */
export function sendMissedCall(school: School, candidate: Candidate, nextTry: Date | null): Promise<string[]> {
  const role = candidate.applied_subject || 'teaching';
  const num = agentNumber();
  return tellCandidate(school, candidate, `We tried to call you about your application to ${school.name}`, [
    `Hello ${candidate.name},`,
    `We tried to call you${num ? ` from ${num}` : ''} about your application for the ${role} position at ${school.name}, but could not reach you.`,
    nextTry ? `We will try again ${whenText(nextTry)}. It is a short chat of about three minutes.` : 'The school will be in touch with you about the next step.',
    `— ${school.name}, via Edcruiter`,
  ]);
}

// --- To the school ------------------------------------------------------------

/** Who at the school gets the call emails: the addresses the school gave, or its main contact. */
export function hrRecipients(school: School, settings: FullScreeningSettings): string[] {
  const list = settings.notify.emails.length ? settings.notify.emails : [school.primary_contact?.email].filter(realEmail) as string[];
  return [...new Set(list)];
}

export const candidateUrl = (candidateId: string) => `${appOrigin()}/admin/candidates/${encodeURIComponent(candidateId)}`;

async function emailSchool(school: School, settings: FullScreeningSettings, subject: string, paras: string[], links: { label: string; url: string }[] = []): Promise<boolean> {
  const to = hrRecipients(school, settings);
  if (!to.length) return false;
  const text = [...paras, ...links.map((l) => `${l.label}: ${l.url}`), '— Edcruiter'].join('\n\n');
  const html = paragraphsHtml(paras)
    + (links.length ? `<ul>${links.map((l) => `<li><a href="${l.url}">${escapeHtml(l.label)}</a></li>`).join('')}</ul>` : '')
    + '<p>— Edcruiter</p>';
  let any = false;
  for (const address of to) {
    const r = await sendEmail({ to: address, subject, text, html, kind: 'account' }).catch(() => null);
    any = any || r?.ok === true;
  }
  return any;
}

/** A good fit, the moment the call ends, so HR can move first. */
export function emailGoodFit(school: School, settings: FullScreeningSettings, candidate: Candidate, summary: string, linkSent: boolean) {
  return emailSchool(school, settings, `Good fit on the AI call: ${candidate.name}`, [
    `${candidate.name} (${candidate.applied_subject || 'teaching'}) came out as a good fit on the AI screening call.`,
    summary,
    linkSent ? 'The test link has been sent to them.' : 'Open their page to send the test link.',
  ], [{ label: `Open ${candidate.name}`, url: candidateUrl(candidate.id) }]);
}

/** Results that have waited for HR longer than the school allows. */
export function emailWaiting(school: School, settings: FullScreeningSettings, items: { candidate: Candidate; what: string }[]) {
  return emailSchool(school, settings, `${items.length} AI call ${items.length === 1 ? 'result is' : 'results are'} waiting for you`, [
    `These candidates were called by the AI and are waiting for your decision for more than ${settings.rules.hold_days} ${settings.rules.hold_days === 1 ? 'day' : 'days'}:`,
    items.map((i) => `• ${i.candidate.name} (${i.candidate.applied_subject || 'teaching'}): ${i.what}`).join('\n'),
  ], items.map((i) => ({ label: `Open ${i.candidate.name}`, url: candidateUrl(i.candidate.id) })));
}

export interface DigestNumbers {
  called: number; answered: number; good: number; look: number; notSuitable: number; missed: number;
  linksSent: number; waiting: number; spentMonthInr: number; capInr: number;
}

/** The end-of-day summary. */
export function emailDigest(school: School, settings: FullScreeningSettings, n: DigestNumbers) {
  return emailSchool(school, settings, `AI calls today at ${school.name}: ${n.answered} answered, ${n.good} good ${n.good === 1 ? 'fit' : 'fits'}`, [
    `Today the AI called ${n.called} ${n.called === 1 ? 'candidate' : 'candidates'}; ${n.answered} answered and ${n.missed} did not pick up.`,
    `Good fit: ${n.good}. Needs a look: ${n.look}. Not suitable: ${n.notSuitable}. Test links sent: ${n.linksSent}.`,
    n.waiting ? `${n.waiting} ${n.waiting === 1 ? 'result is' : 'results are'} waiting for you to decide.` : 'Nothing is waiting for you.',
    `Spent on AI calls this month: ₹${n.spentMonthInr}${n.capInr ? ` of your ₹${n.capInr} limit` : ''}.`,
  ], [{ label: 'Open candidates', url: `${appOrigin()}/admin/candidates` }]);
}

/** Once a month, when calls stop because the limit is reached. */
export function emailCapReached(school: School, settings: FullScreeningSettings, capInr: number) {
  return emailSchool(school, settings, `AI calls paused: this month's ₹${capInr} limit is reached`, [
    `${school.name} has reached its limit of ₹${capInr} for AI screening calls this month, so no more calls will be placed until next month.`,
    'Candidates who would have been called are flagged on their page so HR can follow up. To carry on calling, raise the limit in Settings, AI screening call, Limits and alerts.',
  ], [{ label: 'Open settings', url: `${appOrigin()}/admin/settings` }]);
}

export const markSchoolState = (school: School, patch: NonNullable<School['screening_call_state']>) =>
  db.updateSchool(school.id, { screening_call_state: { ...(school.screening_call_state || {}), ...patch } });
