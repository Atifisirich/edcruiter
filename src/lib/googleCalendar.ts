/**
 * Real Google Meet links for interviews. A school admin connects one Google
 * account (usually HR's or the school's Workspace account) once, in Settings.
 * Each scheduled interview then becomes an event in that account's calendar
 * with a Meet link, and Google sends the candidate and the interviewer a
 * calendar invite too.
 *
 * Server setup (one time, in Google Cloud for the existing OAuth client):
 *   1. Enable the Google Calendar API.
 *   2. Add the redirect URI  <app>/api/integrations/google-calendar/callback
 *   3. Add the scope  https://www.googleapis.com/auth/calendar.events  to the
 *      consent screen. Until Google verifies the app, only test users added
 *      on the consent screen can connect.
 *
 * Without a connection, or if Google fails, scheduling still works with a
 * free Jitsi room (meetingLink.ts), so an interview is never blocked.
 */

import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { appOrigin } from './googleOAuth';
import { decryptSecret, encryptSecret } from './secrets';
import type { GoogleCalendarConnection } from './types';

export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/** Are the server's Google keys there at all? Without them the Connect button is hidden. */
export function calendarAvailable(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function client(): OAuth2Client {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appOrigin()}/api/integrations/google-calendar/callback`
  );
}

/** Where the admin is sent to allow Edcruiter to add interview events to their calendar. */
export function calendarConnectUrl(state: string, loginHint?: string): string {
  return client().generateAuthUrl({
    access_type: 'offline',
    // Always ask, so Google hands back a refresh token even on a reconnect.
    prompt: 'consent',
    scope: ['openid', 'email', CALENDAR_SCOPE],
    include_granted_scopes: true,
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
}

/** Turns Google's one-time code into a connection to store on the school. */
export async function connectionFromCode(code: string, byName: string): Promise<GoogleCalendarConnection> {
  const c = client();
  const { tokens } = await c.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google did not give a lasting permission. Remove Edcruiter from your Google account’s third-party access and connect again.');
  if (!String(tokens.scope || '').includes(CALENDAR_SCOPE)) throw new Error('Calendar permission was not ticked. Connect again and allow Edcruiter to add events to your calendar.');
  let email = '';
  if (tokens.id_token) {
    const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    email = ticket.getPayload()?.email || '';
  }
  return {
    email: email || 'Google account',
    refresh_token_encrypted: encryptSecret(tokens.refresh_token),
    connected_at: new Date().toISOString(),
    connected_by_name: byName,
  };
}

async function accessToken(conn: GoogleCalendarConnection): Promise<string> {
  const c = client();
  c.setCredentials({ refresh_token: decryptSecret(conn.refresh_token_encrypted) });
  const { token } = await c.getAccessToken();
  if (!token) throw new Error('Google did not accept the saved permission. Reconnect Google in Settings.');
  return token;
}

async function call(conn: GoogleCalendarConnection, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const token = await accessToken(conn);
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (res.status === 204 || res.status === 410) return {};
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Calendar: ${data.error?.message || res.status}`);
  return data;
}

export interface MeetEventInput {
  summary: string;
  description: string;
  startIso: string;
  durationMin: number;
  /** Everyone who gets Google's calendar invite. Addresses without @ are left out. */
  attendees: { email: string; name?: string }[];
}

function eventBody(input: MeetEventInput) {
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMin * 60_000);
  const seen = new Set<string>();
  const attendees = input.attendees
    .filter((a) => a.email && a.email.includes('@') && !a.email.endsWith('.local'))
    .filter((a) => { const k = a.email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((a) => ({ email: a.email, ...(a.name ? { displayName: a.name } : {}) }));
  return {
    summary: input.summary.slice(0, 200),
    description: input.description.slice(0, 4000),
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' },
    attendees,
    reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 60 }, { method: 'popup', minutes: 10 }] },
  };
}

/** Makes the calendar event with a Google Meet link. Google emails every attendee the invite. */
export async function createMeetEvent(conn: GoogleCalendarConnection, input: MeetEventInput): Promise<{ meetLink: string; eventId: string }> {
  const data = await call(conn, `${API}?conferenceDataVersion=1&sendUpdates=all`, {
    method: 'POST',
    body: JSON.stringify({
      ...eventBody(input),
      conferenceData: { createRequest: { requestId: randomBytes(8).toString('hex'), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    }),
  });
  const entry = (data.conferenceData as { entryPoints?: { entryPointType?: string; uri?: string }[] } | undefined)?.entryPoints?.find((e) => e.entryPointType === 'video');
  const meetLink = (typeof data.hangoutLink === 'string' && data.hangoutLink) || entry?.uri || '';
  if (!meetLink || typeof data.id !== 'string') throw new Error('Google made the event but no Meet link. Check that Google Meet is switched on for this account.');
  return { meetLink, eventId: data.id };
}

/** Moves the event when HR reschedules. Google tells the attendees. */
export async function moveMeetEvent(conn: GoogleCalendarConnection, eventId: string, startIso: string, durationMin: number): Promise<void> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + durationMin * 60_000);
  await call(conn, `${API}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify({ start: { dateTime: start.toISOString(), timeZone: 'Asia/Kolkata' }, end: { dateTime: end.toISOString(), timeZone: 'Asia/Kolkata' } }),
  });
}

/** Cancels the event when HR cancels the slot. Google tells the attendees. */
export async function cancelMeetEvent(conn: GoogleCalendarConnection, eventId: string): Promise<void> {
  await call(conn, `${API}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' });
}
