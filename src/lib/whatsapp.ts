/**
 * Normalises a mobile number to WhatsApp's expected E.164-without-plus form
 * (country code + number, digits only).
 *
 * This product's market is Indian K-12 schools, so a bare 10-digit number —
 * the form every school admin actually types — is treated as an Indian
 * mobile number. That is a product assumption, not a bug, but it only
 * applies when no country code was given: an explicit leading "+" is always
 * honoured over the India default, so a candidate's genuine international
 * number is not silently reassigned to +91. Supporting a non-Indian bare
 * number (no "+", no leading 0) needs a country-code selector in the UI —
 * this function alone cannot disambiguate "9876543210" typed in Hyderabad
 * from the same ten digits typed anywhere else.
 */
export function toWhatsAppE164(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  const hasExplicitCountryCode = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (hasExplicitCountryCode) {
    // Respect what was given rather than reinterpreting it. WhatsApp phone
    // numbers run 7–15 digits after the country code by the E.164 spec.
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export function formatWhatsAppDisplay(e164: string): string {
  if (!e164) return '';
  if (e164.startsWith('91') && e164.length === 12) {
    return `+91 ${e164.slice(2, 7)} ${e164.slice(7)}`;
  }
  return `+${e164}`;
}
