import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * At-rest encryption for tokens that must not sit in data/store.json in
 * plaintext — principally each school's WhatsApp access token.
 *
 * This is AES-256-GCM under a key derived from WHATSAPP_TOKEN_KEY, which is
 * adequate for a single-instance deployment where the encryption key and the
 * ciphertext are not co-located (the key lives in the process environment /
 * Secret Manager env injection, the ciphertext lives in the data file). It is
 * a stand-in for a real secret manager, not a replacement for one: every call
 * site goes through the two functions below, so swapping to GCP Secret
 * Manager or similar later means changing this file only.
 */

function encryptionKey(): Buffer {
  const secret = process.env.WHATSAPP_TOKEN_KEY;
  if (!secret) {
    throw new Error(
      'WHATSAPP_TOKEN_KEY is not set. Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"` and store it as a secret, never in the repo.'
    );
  }
  // Accepts either a base64-encoded 32-byte key (preferred) or an arbitrary
  // passphrase, which is stretched to 32 bytes with scrypt either way.
  try {
    const asB64 = Buffer.from(secret, 'base64');
    if (asB64.length === 32) return asB64;
  } catch {
    /* fall through to scrypt */
  }
  return scryptSync(secret, 'edcruiter-whatsapp-token', 32);
}

export function encryptSecret(plaintext: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted secret payload.');
  }
  const key = encryptionKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}
