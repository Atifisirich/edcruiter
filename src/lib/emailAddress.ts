// Kept apart from password.ts, which needs Node's crypto, so pages that run in
// the browser (the Team page) can use these without pulling crypto in.

export function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[^\s@<>()"',;:\\]{2,}$/.test(email);
}
