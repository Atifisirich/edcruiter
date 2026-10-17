export function makeInviteCode(subject?: string) {
  const sub = (subject || 'GEN').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'GEN';
  const n = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EDC-${sub}-${n}`;
}

export function assessmentPath(candidateId: string) {
  return `/candidate/${candidateId}`;
}

export function assessmentAbsoluteUrl(candidateId: string) {
  if (typeof window === 'undefined') return assessmentPath(candidateId);
  return `${window.location.origin}${assessmentPath(candidateId)}`;
}
