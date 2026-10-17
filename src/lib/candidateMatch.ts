import { Candidate } from './types';

/**
 * Pure predicate behind db.findCandidateByIdentifier, split out so it can be
 * unit tested without constructing the DB singleton (which reads/writes
 * data/store.json as a side effect of import).
 *
 * Matches on ID, email, or phone only, exact after normalisation. Deliberately
 * does not match on name — the previous version did, which meant anyone who
 * knew another candidate's public name could "log in" as them — and the phone
 * check is not the previous bidirectional `includes()`, which matched a
 * partial digit string like "1" against any phone number containing a 1.
 */
export function candidateMatchesIdentifier(identifier: string, candidate: Candidate): boolean {
  const clean = identifier.trim().toLowerCase();
  const cleanDigits = identifier.replace(/\D/g, '');

  if (candidate.id.toLowerCase() === clean) return true;
  if (candidate.email && candidate.email.toLowerCase() === clean) return true;

  if (candidate.phone && cleanDigits.length >= 10) {
    const candDigits = candidate.phone.replace(/\D/g, '');
    if (candDigits === cleanDigits) return true;
    if (candDigits.length > cleanDigits.length && candDigits.endsWith(cleanDigits)) return true;
  }

  return false;
}
