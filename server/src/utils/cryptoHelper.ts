import crypto from 'crypto';
import { env } from '../config/env.js';

// Derive or create a consistent 32-byte key from JWT_SECRET or explicit key
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY || env.JWT_SECRET || 'flowdesk_master_encryption_secret_key_2026';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest(); // Exactly 32 bytes

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes auth tag

/**
 * Encrypts sensitive secrets at rest using AES-256-GCM.
 * Output format: base64(iv:authTag:cipherText)
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts AES-256-GCM encrypted secrets at rest.
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return '';
  try {
    const combined = Buffer.from(cipherText, 'base64');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted secret payload length');
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedData = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('Failed to decrypt secret at rest');
  }
}

/**
 * Secure one-way hash for API keys (e.g. generic webhook keys)
 */
export function hashSecret(secret: string): string {
  if (!secret) return '';
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');

  if (bufA.length !== bufB.length) {
    // Prevent short-circuit timing leak on length
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates an unguessable high-entropy random string for webhooks and public tokens.
 */
export function generateUnguessableId(prefix = 'wh'): string {
  const bytes = crypto.randomBytes(24).toString('hex');
  return `${prefix}_${bytes}`;
}
