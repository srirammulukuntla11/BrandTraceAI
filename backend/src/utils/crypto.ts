import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Derives a 256-bit (32-byte) key from the server environment secret.
 * Used exclusively for AES-256-GCM encryption of user API keys at rest.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || config.jwtSecret || 'brandtrace-secure-ai-key-secret-2025';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM with a unique 96-bit IV and authentication tag.
 * Never stores keys as plaintext in the database.
 */
export function encryptApiKey(plainText: string): { encrypted: string; iv: string; authTag: string } {
  if (!plainText) return { encrypted: '', iv: '', authTag: '' };
  const iv = crypto.randomBytes(12); // Standard 12-byte IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts an encrypted API key using AES-256-GCM.
 * Validates integrity via the authentication tag.
 */
export function decryptApiKey(encrypted: string, ivHex: string, authTagHex: string): string {
  if (!encrypted || !ivHex || !authTagHex) return '';
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

/**
 * Creates a safe, non-secret masked display indicator of an API key.
 * Example: 'AIza••••••••••••4xQ9'
 * Never leaks the full key to logs, responses, or client DOM.
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const clean = apiKey.trim();
  if (clean.length <= 8) return '••••••••';
  const prefix = clean.substring(0, 4);
  const suffix = clean.substring(clean.length - 4);
  return `${prefix}${'•'.repeat(Math.max(12, clean.length - 8))}${suffix}`;
}
