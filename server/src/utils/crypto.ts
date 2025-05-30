import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/** 256-bit secret in hex; add API_KEY_ENCRYPTION_SECRET=... to .env */
const KEY = Buffer.from(process.env.API_KEY_ENCRYPTION_SECRET!, 'hex');
const ALG = 'aes-256-gcm';
const IV_LEN = 12;                       // NIST recommendation for GCM

export function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);        // store as BYTEA
}

export function decrypt(cipherbuf: Buffer): string {
  const iv  = cipherbuf.subarray(0, IV_LEN);
  const tag = cipherbuf.subarray(IV_LEN, IV_LEN + 16);
  const enc = cipherbuf.subarray(IV_LEN + 16);
  const decipher = createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
} 