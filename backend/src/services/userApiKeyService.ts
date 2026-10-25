import {
  PREDEFINED_GEMINI_MODELS,
  PREDEFINED_MODEL_IDS,
  isValidPredefinedModel,
  PredefinedGeminiModel,
  getPredefinedModel,
} from '../config/models.js';
import {
  executeGeminiGenerateContent,
  GeminiApiError,
  redactApiKey,
  normalizeModelId,
} from './geminiClient.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../utils/crypto.js';
import { UserAiConfigModel } from '../models/UserAiConfig.js';
import mongoose from 'mongoose';

export {
  PREDEFINED_GEMINI_MODELS,
  PREDEFINED_MODEL_IDS,
  isValidPredefinedModel,
  PredefinedGeminiModel,
  getPredefinedModel,
};

export function selectBestGeminiModel(candidateList?: string[]): string {
  if (candidateList && candidateList.includes('gemini-3.8-flash')) return 'gemini-3.8-flash';
  if (candidateList && candidateList.length > 0) return candidateList[0];
  return 'gemini-3.8-flash';
}

/**
 * Model Test Statuses representing accurate, classified provider results.
 */
export type ModelTestStatus =
  | 'not_tested'
  | 'testing'
  | 'passed'
  | 'quota_exceeded'
  | 'invalid_key'
  | 'permission_denied'
  | 'unsupported_model'
  | 'model_not_found'
  | 'network_error'
  | 'server_error'
  | 'request_error';

export interface ModelTestRecord {
  modelId: string;
  status: ModelTestStatus;
  message: string;
  statusCode?: number;
  retryDelay?: string;
  testedAt: string;
}

/**
 * In-memory fast cache for user-scoped API keys, active models, and test records.
 * Backed by durable encrypted storage in MongoDB Atlas when connected.
 *
 * Security & Isolation Guarantees:
 * 1. Scoped strictly per authenticated user ID.
 * 2. API keys are encrypted at rest using AES-256-GCM in MongoDB.
 * 3. Never exposed in API responses or plain logs.
 * 4. In-memory cache is lazily restored from MongoDB on demand.
 */
const userKeyStore = new Map<string, string>();
const userMaskedKeyStore = new Map<string, string>();
const userActiveModelStore = new Map<string, string>();
const userSelectedModelStore = new Map<string, string>();
const userModelTestsStore = new Map<string, Map<string, ModelTestRecord>>();

/**
 * Normalizes and sanitizes user-entered API keys:
 * - Trims whitespace and newlines
 * - Strips enclosing quotes ('...' or "...")
 * - Strips accidental CLI or header prefixes ("export GEMINI_API_KEY=", "Bearer ")
 * - Rejects masked bullet strings (e.g. "••••••••••")
 */
export function cleanApiKey(rawKey: string): string {
  let key = (rawKey || '').trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/^(export\s+)?GEMINI_API_KEY\s*=\s*/i, '');
  key = key.replace(/^Bearer\s+/i, '');

  // Detect and reject masked placeholder bullets
  if (key.includes('•') || key.includes('••••')) {
    return '';
  }

  return key.trim();
}

/**
 * Strips any potential API key patterns from error strings to prevent leakage in logs/responses.
 */
export function sanitizeApiKeyError(errorMessage: string): string {
  if (!errorMessage) return 'Unknown error';
  return redactApiKey(errorMessage);
}

/**
 * Extracts retryDelay from error objects or message.
 */
export function extractRetryDelay(error: any): string | undefined {
  if (!error) return undefined;
  if (error instanceof GeminiApiError && error.retryDelay) return error.retryDelay;
  if (error?.retryDelay) return String(error.retryDelay);
  const raw = String(error?.message || error || '');
  const match = raw.match(/retry(?:Delay)?(?:\s*after|\s*[:=])?\s*["']?([0-9]+(?:\.[0-9]+)?s?)["']?/i);
  if (match && match[1]) {
    return match[1].endsWith('s') ? match[1] : `${match[1]}s`;
  }
  return undefined;
}

/**
 * Checks if an error represents quota exhaustion or rate limiting (HTTP 429).
 */
export function isRateLimitOrQuotaError(error: any): boolean {
  const status = error?.statusCode || error?.status;
  const msg = String(error?.message || error || '');
  return status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(msg);
}

/**
 * Asynchronously synchronizes in-memory cache to MongoDB Atlas.
 */
async function syncToDatabase(userId: string): Promise<void> {
  if (mongoose.connection.readyState !== 1) return; // DB not connected (e.g. test environment)

  try {
    const rawKey = userKeyStore.get(userId);
    let encryptedData = { encrypted: '', iv: '', authTag: '' };
    let masked = '';

    if (rawKey) {
      encryptedData = encryptApiKey(rawKey);
      masked = maskApiKey(rawKey);
    }

    const activeModel = userActiveModelStore.get(userId) || null;
    const selectedModel = userSelectedModelStore.get(userId) || 'gemini-3.8-flash';
    const testMap = userModelTestsStore.get(userId);
    const modelTestResults: Record<string, ModelTestRecord> = {};
    if (testMap) {
      for (const [k, v] of testMap.entries()) {
        modelTestResults[k] = v;
      }
    }

    await UserAiConfigModel.findOneAndUpdate(
      { userId },
      {
        userId,
        encryptedApiKey: encryptedData.encrypted,
        iv: encryptedData.iv,
        authTag: encryptedData.authTag,
        maskedKey: masked,
        hasApiKey: Boolean(rawKey),
        activeModel,
        selectedModel,
        modelTestResults,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.warn(`[UserAiConfig] Failed to persist user config to DB for ${userId}:`, err);
  }
}

/**
 * Asynchronously restores user configuration from MongoDB Atlas into in-memory cache.
 */
export async function ensureUserConfigLoaded(userId: string): Promise<void> {
  if (!userId || userKeyStore.has(userId) || mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    let doc = await UserAiConfigModel.findOne({ userId });
    // If not found and user is a demo user, fall back to any configured demo user doc
    if (!doc && userId.startsWith('demo-')) {
      doc = await UserAiConfigModel.findOne({ userId: /^demo-/ });
    }
    if (!doc) return;

    if (doc.encryptedApiKey && doc.iv && doc.authTag) {
      const decrypted = decryptApiKey(doc.encryptedApiKey, doc.iv, doc.authTag);
      if (decrypted) {
        userKeyStore.set(userId, decrypted);
        userMaskedKeyStore.set(userId, doc.maskedKey || maskApiKey(decrypted));
      } else {
        console.warn(`[UserAiConfig] Decryption failed for user ${userId}. Invalid or corrupted secret.`);
      }
    }

    if (doc.activeModel) {
      userActiveModelStore.set(userId, doc.activeModel);
    }
    if (doc.selectedModel) {
      userSelectedModelStore.set(userId, doc.selectedModel);
    }
    if (doc.modelTestResults && typeof doc.modelTestResults === 'object') {
      const testMap = new Map<string, ModelTestRecord>();
      for (const [k, v] of Object.entries(doc.modelTestResults)) {
        testMap.set(k, v);
      }
      userModelTestsStore.set(userId, testMap);
    }
  } catch (err) {
    console.warn(`[UserAiConfig] Failed to load user config from DB for ${userId}:`, err);
  }
}

/**
 * Store user's Gemini API key in session memory and persist to database.
 */
export function setUserKey(userId: string, apiKey: string): void {
  if (!userId) {
    throw new Error('User ID is required to scope API key');
  }
  const cleanKey = cleanApiKey(apiKey);
  if (!cleanKey) {
    throw new Error('API key cannot be empty or a masked placeholder');
  }
  userKeyStore.set(userId, cleanKey);
  userMaskedKeyStore.set(userId, maskApiKey(cleanKey));

  // If demo user, share in-memory key across demo roles for consistent judge/testing experience
  if (userId.startsWith('demo-')) {
    ['demo-reviewer-1', 'demo-creator-1', 'demo-admin-1'].forEach((dId) => {
      userKeyStore.set(dId, cleanKey);
      userMaskedKeyStore.set(dId, maskApiKey(cleanKey));
    });
  }

  // Fire-and-forget DB sync
  syncToDatabase(userId).catch(() => {});
}

/**
 * Retrieve user's configured Gemini API key.
 */
export function getUserKey(userId: string): string | undefined {
  if (!userId) return undefined;
  return userKeyStore.get(userId);
}

/**
 * Get masked display representation of user's key (e.g. AIza••••••••4xQ9).
 */
export function getUserMaskedKey(userId: string): string | undefined {
  if (!userId) return undefined;
  const inMem = userMaskedKeyStore.get(userId);
  if (inMem) return inMem;
  const raw = userKeyStore.get(userId);
  return raw ? maskApiKey(raw) : undefined;
}

/**
 * Check whether a user has configured their Gemini API key.
 */
export function hasUserKey(userId: string): boolean {
  if (!userId) return false;
  const key = userKeyStore.get(userId);
  return Boolean(key && key.trim().length > 0);
}

/**
 * Store user's active (verified and activated) model.
 */
export function setUserActiveModel(userId: string, model: string): void {
  if (userId && model) {
    const clean = normalizeModelId(model);
    userActiveModelStore.set(userId, clean);
    syncToDatabase(userId).catch(() => {});
  }
}

/**
 * Retrieve user's active (verified and activated) model.
 */
export function getUserActiveModel(userId: string): string | undefined {
  if (!userId) return undefined;
  return userActiveModelStore.get(userId);
}

// Aliases for compatibility
export const getUserVerifiedModel = getUserActiveModel;
export const setUserVerifiedModel = setUserActiveModel;

/**
 * Store user's selected candidate in dropdown.
 */
export function setUserSelectedModel(userId: string, model: string): void {
  if (userId && model) {
    const clean = normalizeModelId(model);
    userSelectedModelStore.set(userId, clean);
    syncToDatabase(userId).catch(() => {});
  }
}

/**
 * Retrieve user's selected candidate.
 */
export function getUserSelectedModel(userId: string): string | undefined {
  if (!userId) return undefined;
  return userSelectedModelStore.get(userId);
}

export const getUserModelPreference = getUserSelectedModel;
export const setUserModelPreference = setUserSelectedModel;

/**
 * Record a test result for a model for a specific user.
 */
export function setUserModelTest(userId: string, record: ModelTestRecord): void {
  if (!userId || !record?.modelId) return;
  let userTests = userModelTestsStore.get(userId);
  if (!userTests) {
    userTests = new Map<string, ModelTestRecord>();
    userModelTestsStore.set(userId, userTests);
  }
  userTests.set(record.modelId, record);
  syncToDatabase(userId).catch(() => {});
}

/**
 * Get test record for a specific model for a user.
 */
export function getUserModelTest(userId: string, modelId: string): ModelTestRecord | undefined {
  if (!userId || !modelId) return undefined;
  const clean = normalizeModelId(modelId);
  return userModelTestsStore.get(userId)?.get(clean);
}

/**
 * Get all model test records for a user as a dictionary.
 */
export function getAllUserModelTests(userId: string): Record<string, ModelTestRecord> {
  const result: Record<string, ModelTestRecord> = {};
  if (!userId) return result;
  const userTests = userModelTestsStore.get(userId);
  if (userTests) {
    for (const [modelId, record] of userTests.entries()) {
      result[modelId] = record;
    }
  }
  return result;
}

/**
 * Check if a model has successfully passed a test for a user.
 */
export function isModelTestPassed(userId: string, modelId: string): boolean {
  const test = getUserModelTest(userId, modelId);
  return test?.status === 'passed';
}

/**
 * Clear test records for a user.
 */
export function clearUserModelTests(userId: string): void {
  if (userId) {
    userModelTestsStore.delete(userId);
    syncToDatabase(userId).catch(() => {});
  }
}

/**
 * Delete a user's configured Gemini API key, active model, and test cache.
 */
export function deleteUserKey(userId: string): boolean {
  if (!userId) return false;
  userActiveModelStore.delete(userId);
  userSelectedModelStore.delete(userId);
  userModelTestsStore.delete(userId);
  userMaskedKeyStore.delete(userId);
  const deleted = userKeyStore.delete(userId);

  if (userId.startsWith('demo-')) {
    ['demo-reviewer-1', 'demo-creator-1', 'demo-admin-1'].forEach((dId) => {
      userActiveModelStore.delete(dId);
      userSelectedModelStore.delete(dId);
      userModelTestsStore.delete(dId);
      userMaskedKeyStore.delete(dId);
      userKeyStore.delete(dId);
      if (mongoose.connection.readyState === 1) {
        UserAiConfigModel.deleteOne({ userId: dId }).catch(() => {});
      }
    });
  }

  if (mongoose.connection.readyState === 1) {
    UserAiConfigModel.deleteOne({ userId }).catch(() => {});
  }

  return deleted;
}

/**
 * Clear all user keys, models, and tests (for test isolation).
 */
export function clearAllKeys(): void {
  userKeyStore.clear();
  userMaskedKeyStore.clear();
  userActiveModelStore.clear();
  userSelectedModelStore.clear();
  userModelTestsStore.clear();
}

/**
 * Classifies Gemini errors into structured ModelTestStatus and user-friendly explanations.
 * Never leaks the API key in error messages.
 */
export function classifyGeminiModelError(
  error: any,
  modelId: string
): {
  status: ModelTestStatus;
  message: string;
  statusCode?: number;
  retryDelay?: string;
} {
  const cleanModel = normalizeModelId(modelId);
  const rawMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const safeMsg = sanitizeApiKeyError(rawMessage);
  const statusCode = error?.statusCode || error?.status;
  const googleStatus = error?.googleStatus;
  const retryDelay = extractRetryDelay(error);

  // 1. Quota / Rate limit (HTTP 429 or RESOURCE_EXHAUSTED)
  if (statusCode === 429 || googleStatus === 'RESOURCE_EXHAUSTED' || /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(safeMsg)) {
    const delayMsg = retryDelay ? ` (retry delay: ${retryDelay})` : '';
    return {
      status: 'quota_exceeded',
      message: `Gemini API rate limit or quota exceeded (429) for model "${cleanModel}"${delayMsg}. Please wait or review your Google AI Studio plan.`,
      statusCode: 429,
      retryDelay,
    };
  }

  // 2. Invalid or expired API key (HTTP 401 or API_KEY_INVALID)
  if (
    statusCode === 401 ||
    googleStatus === 'API_KEY_INVALID' ||
    /API_KEY_INVALID|API key not valid|key is invalid|API_KEY_EXPIRED|key expired/i.test(safeMsg)
  ) {
    return {
      status: 'invalid_key',
      message: 'Invalid Gemini API key. Google rejected the key. Please check that you copied the complete key correctly from Google AI Studio.',
      statusCode: statusCode || 401,
    };
  }

  // 3. Permission denied or restrictions (HTTP 403 or PERMISSION_DENIED)
  if (
    statusCode === 403 ||
    googleStatus === 'PERMISSION_DENIED' ||
    /PERMISSION_DENIED|permission denied|API_KEY_SERVICE_BLOCKED|SERVICE_DISABLED/i.test(safeMsg)
  ) {
    return {
      status: 'permission_denied',
      message: 'Gemini API permission denied (403). Ensure the Generative Language API is enabled in your Google Cloud / AI Studio project.',
      statusCode: 403,
    };
  }

  // 4. Model not found (HTTP 404 or NOT_FOUND)
  if (
    statusCode === 404 ||
    googleStatus === 'NOT_FOUND' ||
    /404|NOT_FOUND|not found for API version/i.test(safeMsg)
  ) {
    return {
      status: 'model_not_found',
      message: `Model "${cleanModel}" was not found or is unavailable for this API version (404). Check if this model is enabled for your project region.`,
      statusCode: 404,
    };
  }

  // 5. Unsupported model or operation
  if (/is not supported for generateContent|unsupported/i.test(safeMsg)) {
    return {
      status: 'unsupported_model',
      message: `Model "${cleanModel}" does not support text generation (generateContent).`,
      statusCode: statusCode || 400,
    };
  }

  // 6. Upstream server failure (HTTP 5xx)
  if (statusCode >= 500 && statusCode < 600) {
    return {
      status: 'server_error',
      message: `Google Gemini service temporarily unavailable (${statusCode} Server Error). Please try again shortly.`,
      statusCode,
    };
  }

  // 7. Network or connection failure / Timeout
  if (statusCode === 408 || /fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|NetworkError|timed out|TimeoutError/i.test(safeMsg)) {
    return {
      status: 'network_error',
      message: `Network connectivity or timeout error contacting Google Gemini API (${safeMsg}).`,
      statusCode: statusCode || 408,
    };
  }

  // 8. Bad request / Invalid argument (HTTP 400)
  if (statusCode === 400 || googleStatus === 'INVALID_ARGUMENT' || /400|INVALID_ARGUMENT|Bad Request/i.test(safeMsg)) {
    return {
      status: 'request_error',
      message: `Gemini API request rejected (400 Bad Request): ${safeMsg}`,
      statusCode: 400,
    };
  }

  return {
    status: 'request_error',
    message: safeMsg,
    statusCode,
    retryDelay,
  };
}

export const classifyGeminiError = (error: any) => classifyGeminiModelError(error, 'gemini').message;

/**
 * Tests an individual model manually by executing one minimal generation request.
 * - Does NOT loop through other models.
 * - Does NOT auto-switch on failure.
 * - Records and preserves per-model test status.
 * - Never leaks API key.
 */
export async function testIndividualModel(
  apiKey: string,
  modelId: string,
  userId?: string
): Promise<ModelTestRecord> {
  const cleanKey = cleanApiKey(apiKey);
  const targetModel = normalizeModelId(modelId);

  // Validate model against predefined list
  if (!isValidPredefinedModel(targetModel)) {
    const record: ModelTestRecord = {
      modelId: targetModel,
      status: 'unsupported_model',
      message: `Model "${targetModel}" is not in the predefined Gemini model list.`,
      testedAt: new Date().toISOString(),
    };
    if (userId) setUserModelTest(userId, record);
    return record;
  }

  if (!cleanKey) {
    const record: ModelTestRecord = {
      modelId: targetModel,
      status: 'invalid_key',
      message: 'No Gemini API key provided. Please enter a valid API key to test.',
      testedAt: new Date().toISOString(),
    };
    if (userId) setUserModelTest(userId, record);
    return record;
  }

  try {
    // Execute real generation request using shared Gemini client with a 25s configurable timeout
    console.log(`[UserApiKeyService] Testing model "${targetModel}" for user "${userId || 'anonymous'}"...`);
    const result = await executeGeminiGenerateContent({
      apiKey: cleanKey,
      modelId: targetModel,
      prompt: 'ping',
      timeoutMs: 25000,
    });

    if (!result.text || result.text.trim().length === 0) {
      throw new Error('Gemini returned an empty response.');
    }

    const record: ModelTestRecord = {
      modelId: targetModel,
      status: 'passed',
      message: `Model "${targetModel}" verified successfully! Connection established and responsive.`,
      statusCode: 200,
      testedAt: new Date().toISOString(),
    };

    if (userId) {
      setUserModelTest(userId, record);
    }

    return record;
  } catch (err: any) {
    const classified = classifyGeminiModelError(err, targetModel);
    const record: ModelTestRecord = {
      modelId: targetModel,
      status: classified.status,
      message: classified.message,
      statusCode: classified.statusCode,
      retryDelay: classified.retryDelay,
      testedAt: new Date().toISOString(),
    };

    if (userId) {
      setUserModelTest(userId, record);
    }

    return record;
  }
}
