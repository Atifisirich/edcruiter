import { describe, expect, it } from 'vitest';
import { toWhatsAppE164, formatWhatsAppDisplay } from './whatsapp';

describe('toWhatsAppE164', () => {
  it('prefixes a bare 10-digit number with 91 (the Indian-market default)', () => {
    expect(toWhatsAppE164('9876543210')).toBe('919876543210');
  });

  it('strips a leading 0 from an 11-digit local-format number', () => {
    expect(toWhatsAppE164('09876543210')).toBe('919876543210');
  });

  it('strips formatting characters (spaces, dashes, parens)', () => {
    expect(toWhatsAppE164('+91 98765-43210')).toBe('919876543210');
  });

  it('honours an explicit "+" country code rather than reinterpreting the digits', () => {
    // Regression: the previous implementation stripped every non-digit
    // first, so it could not tell an explicit country code from a bare
    // number — an international candidate's real number risked being
    // silently reassigned to +91.
    expect(toWhatsAppE164('+1 555 123 4567')).toBe('15551234567');
    expect(toWhatsAppE164('+44 7911 123456')).toBe('447911123456');
  });

  it('returns null for empty or unusable input', () => {
    expect(toWhatsAppE164('')).toBeNull();
    expect(toWhatsAppE164('abc')).toBeNull();
  });

  it('returns null for a number too short to be real', () => {
    expect(toWhatsAppE164('+123')).toBeNull();
  });
});

describe('formatWhatsAppDisplay', () => {
  it('formats a 12-digit Indian E.164 number with the conventional spacing', () => {
    expect(formatWhatsAppDisplay('919876543210')).toBe('+91 98765 43210');
  });

  it('falls back to a bare + prefix for a non-Indian number', () => {
    expect(formatWhatsAppDisplay('15551234567')).toBe('+15551234567');
  });

  it('returns an empty string for empty input rather than a bare "+"', () => {
    expect(formatWhatsAppDisplay('')).toBe('');
  });
});
