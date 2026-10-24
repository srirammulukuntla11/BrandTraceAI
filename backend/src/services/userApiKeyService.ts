import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';

/**
 * User-scoped session store for Gemini API keys.
 *
 * Security & Isolation Guarantees:
 * 1. Scoped strictly per authenticated user ID. User A cannot access or use User B's key.
 * 2. Session-only storage in secure backend memory.
 * 3. Never stored in browser localStorage or transmitted in API responses.
 * 4. Cleared on demand or upon backend process restart.
 * 5. Absolutely no platform-level fallback key is used.
 */
const userKeyStore = new Map<string, string>();

/**
 * Strips any potential API key patterns from error strings to prevent leakage in logs/responses.
 */
export function sanitizeApiKeyError(errorMessage: string): string {
  if (!errorMessage) return 'Unknown error';
  return errorMessage.replace(/AIza[0-9A-Za-z\-_]+/g, '[REDACTED_API_KEY]');
}

/**
 * Store user's Gemini API key in session memory
 */
export function setUserKey(userId: string, apiKey: string): void {
  if (!userId) {
    throw new Error('User ID is required to scope API key');
  }
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('API key cannot be empty');
  }
  userKeyStore.set(userId, cleanKey);
}

/**
 * Retrieve user's configured Gemini API key
 */
export function getUserKey(userId: string): string | undefined {
  if (!userId) return undefined;
  return userKeyStore.get(userId);
}

/**
 * Check whether a user has configured their Gemini API key
 */
export function hasUserKey(userId: string): boolean {
  if (!userId) return false;
  const key = userKeyStore.get(userId);
  return Boolean(key && key.trim().length > 0);
}

/**
 * Delete a user's configured Gemini API key
 */
export function deleteUserKey(userId: string): boolean {
  if (!userId) return false;
  return userKeyStore.delete(userId);
}

/**
 * Clear all user keys (for testing / restart)
 */
export function clearAllKeys(): void {
  userKeyStore.clear();
}

/**
 * Test a Gemini API key by making a minimal verification call.
 * Returns success or a sanitized error message.
 * Never leaks the API key in the response or logs.
 */
export async function testGeminiKey(apiKey: string): Promise<{
  success: boolean;
  model: string;
  message: string;
}> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      success: false,
      model: config.geminiModel,
      message: 'API key is empty.',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(cleanKey);
    const model = genAI.getGenerativeModel({ model: config.geminiModel });

    // Minimal lightweight ping
    const result = await model.generateContent('ping');
    const responseText = result.response.text();

    if (!responseText) {
      return {
        success: false,
        model: config.geminiModel,
        message: 'Gemini responded with empty text.',
      };
    }

    return {
      success: true,
      model: config.geminiModel,
      message: 'Gemini API key verified successfully! Connection established.',
    };
  } catch (err: any) {
    const safeError = sanitizeApiKeyError(err?.message || 'Failed to authenticate with Gemini API');
    return {
      success: false,
      model: config.geminiModel,
      message: `Gemini verification failed: ${safeError}`,
    };
  }
}
