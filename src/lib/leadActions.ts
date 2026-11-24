/**
 * What can happen to people on a lead list, on the server: adding them from a
 * spreadsheet (skipping anyone already known), moving a good fit into
 * Candidates (and sending the test link), setting someone aside with the
 * reason, and putting people back in the calling queue. Nobody is ever deleted
 * here; set-aside people stay on the list and in its report.
 */

import { db } from './db';
import { invitedInterview } from './aiInterview';
import { sendAssessmentInvite, sendInviteEmail } from './assessmentInvite';
import { makeInviteCode } from './inviteCode';
import { leadState, phoneKey } from './leadLists';
import type { Candidate, LeadList } from './types';

export interface LeadRow { name?: string; phone?: string; email?: string; subject?: string; segment?: string; qualification?: string; experience?: string; prior_org?: string; location?: string }

export interface ImportResult {
  added: number;
  skipped: { name: string; phone: string; why: string }[];
}

/**
 * Adds people to a list. A name and a phone number are enough. Someone whose
 * phone number the school already has (as a candidate or on any list) is
 * skipped and shown, never added twice.
 */
export function importLeads(list: LeadList, rows: LeadRow[], branchId: string | undefined, now = new Date()): ImportResult {
  const known = new Map<string, string>();
  for (const c of db.getCandidatesBySchool(list.school_id, { leads: 'include' })) {
    const k = phoneKey(c.phone);
    if (k) known.set(k, c.lead && c.lead.status !== 'moved' ? `already on a lead list` : 'already a candidate');
  }
  const created: Candidate[] = [];
  const skipped: ImportResult['skipped'] = [];
  const iso = now.toISOString();
  rows.slice(0, 5000).forEach((row, i) => {
    const name = String(row.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const phone = String(row.phone ?? '').replace(/[^\d+\s-]/g, '').trim().slice(0, 20);
    if (!name || !phoneKey(phone)) { skipped.push({ name: name || `Row ${i + 2}`, phone, why: !name ? 'no name' : 'no usable phone number' }); return; }
    const k = phoneKey(phone);
    const seen = known.get(k);
    if (seen) { skipped.push({ name, phone, why: seen }); return; }
    known.set(k, 'twice in this file');
    const subject = String(row.subject ?? '').trim().slice(0, 80);
    created.push({
      id: `cand_${now.getTime()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      school_id: list.school_id,
      name,
      email: String(row.email ?? '').trim().slice(0, 160),
      phone,
      dob: '',
      qualification: String(row.qualification ?? '').trim().slice(0, 200),
      experience_band: String(row.experience ?? '').trim().slice(0, 60),
      prior_org: String(row.prior_org ?? '').trim().slice(0, 120),
      current_salary: '',
      expected_salary: '',
      current_location: String(row.location ?? '').trim().slice(0, 120),
      relocation_branches: [],
      languages: [],
      notice_period: '',
      applied_subject: subject || 'General',
      applied_segment: String(row.segment ?? '').trim().slice(0, 120) || 'Secondary (Grades 9-10)',
      target_branch_id: branchId || 'branch_manneguda',
      status: 'in_progress',
      current_stage_key: 'identity_verification',
      invite_code: makeInviteCode(subject || 'General'),
      lead: leadState(list.id, 'waiting', undefined, now),
      created_at: iso,
      updated_at: iso,
    });
  });
  if (created.length) {
    db.createCandidates(created);
    // The school attested it may contact this list (asked before upload).
    for (const c of created) {
      db.setConsent({ candidate_id: c.id, channel: 'whatsapp', granted: true, source: 'school_attested', wording_version: 'lead-list-v1', granted_at: iso });
    }
  }
  return { added: created.length, skipped };
}

/**
 * Moves a lead into Candidates. With `invite`, the test link goes out by
 * WhatsApp (if they agreed) and email; a demo call never sends anything.
 */
export async function moveLead(candidate: Candidate, list: LeadList, opts: { invite: boolean; demo?: boolean; now?: Date }): Promise<{ invited: boolean; channels: string[] }> {
  const now = opts.now ?? new Date();
  const school = db.getSchoolById(candidate.school_id);
  const updates: Partial<Candidate> = {
    lead: { ...(candidate.lead ?? leadState(list.id, 'moved', undefined, now)), status: 'moved', moved_at: now.toISOString(), updated_at: now.toISOString(), reason: undefined, reason_key: undefined },
  };
  if (list.interview_mode && list.interview_mode !== 'five_stage') {
    updates.interview_mode = list.interview_mode;
    updates.ai_interview = candidate.ai_interview ?? invitedInterview(candidate);
  }
  const moved = db.updateCandidate(candidate.school_id, candidate.id, updates) ?? candidate;
  const channels: string[] = [];
  if (opts.invite && !opts.demo && school) {
    const wa = await sendAssessmentInvite(school, moved).catch(() => null);
    if (wa?.ok) channels.push('WhatsApp');
    if (await sendInviteEmail(school, moved).catch(() => false)) channels.push('email');
  }
  if (channels.length) {
    const fresh = db.getCandidateById(candidate.school_id, candidate.id);
    if (fresh?.lead) db.updateCandidate(candidate.school_id, candidate.id, { lead: { ...fresh.lead, invited: true } });
  }
  return { invited: channels.length > 0, channels };
}

export function setLead(candidate: Candidate, status: 'waiting' | 'calling' | 'needs_look' | 'set_aside', reason?: { text: string; key: string }, now = new Date()): void {
  if (!candidate.lead) return;
  db.updateCandidate(candidate.school_id, candidate.id, {
    lead: { ...candidate.lead, status, updated_at: now.toISOString(), reason: reason?.text, reason_key: reason?.key },
  });
}

/** Puts people back in the calling queue (for example everyone with no answer, a week later). */
export function requeue(leads: Candidate[], now = new Date()): number {
  let n = 0;
  for (const c of leads) {
    if (!c.lead || c.lead.status === 'moved' || c.lead.status === 'calling') continue;
    setLead(c, 'waiting', undefined, now);
    n++;
  }
  return n;
}
