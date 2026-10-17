import { describe, expect, it, beforeEach } from 'vitest';
import { randomBytes } from 'crypto';
import { encryptSecret, decryptSecret } from './secrets';

describe('encryptSecret / decryptSecret', () => {
  beforeEach(() => {
    process.env.WHATSAPP_TOKEN_KEY = randomBytes(32).toString('base64');
  });

  it('round-trips a plaintext token', () => {
    const plaintext = 'EAAG_sample_meta_system_user_token_value';
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-token');
    const b = encryptSecret('same-token');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-token');
    expect(decryptSecret(b)).toBe('same-token');
  });

  it('fails closed if WHATSAPP_TOKEN_KEY is missing rather than encrypting under a default key', () => {
    delete process.env.WHATSAPP_TOKEN_KEY;
    expect(() => encryptSecret('token')).toThrow();
  });

  it('rejects a tampered ciphertext instead of returning corrupted data', () => {
    const encrypted = encryptSecret('a-real-token');
    const [iv, tag, data] = encrypted.split(':');
    const tampered = [iv, tag, data.slice(0, -2) + 'AA'].join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
