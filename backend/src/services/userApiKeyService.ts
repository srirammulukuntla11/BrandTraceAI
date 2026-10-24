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
const userVerifiedModelStore = new Map<string, string>();
const userModelPreferenceStore = new Map<string, string>();
const userAvailableModelsStore = new Map<string, string[]>();

/**
 * Curated list of current, stable production models that support generateContent.
 * Ordered by speed, quality, and API stability.
 */
export const STABLE_PREFERRED_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
];

/**
 * Normalizes and sanitizes user-entered API keys:
 * - Trims whitespace and newlines
 * - Strips enclosing quotes ('...' or "...")
 * - Strips accidental CLI or header prefixes ("export GEMINI_API_KEY=", "Bearer ")
 */
export function cleanApiKey(rawKey: string): string {
  let key = (rawKey || '').trim();
  // Strip surrounding quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  // Strip common accidental copy prefixes
  key = key.replace(/^(export\s+)?GEMINI_API_KEY\s*=\s*/i, '');
  key = key.replace(/^Bearer\s+/i, '');
  return key.trim();
}

/**
 * Strips any potential API key patterns from error strings to prevent leakage in logs/responses.
 */
export function sanitizeApiKeyError(errorMessage: string): string {
  if (!errorMessage) return 'Unknown error';
  return errorMessage.replace(/AIza[0-9A-Za-z\-_]+/g, '[REDACTED_API_KEY]');
}

/**
 * Extracts retryDelay from Google API error details or raw message if present.
 */
export function extractRetryDelay(error: any): string | undefined {
  if (!error) return undefined;
  if (Array.isArray(error?.details)) {
    for (const d of error.details) {
      if (d?.retryDelay) return String(d.retryDelay);
      if (d?.['@type']?.includes('RetryInfo') && d?.retryDelay) return String(d.retryDelay);
    }
  }
  if (Array.isArray(error?.errorDetails)) {
    for (const d of error.errorDetails) {
      if (d?.retryDelay) return String(d.retryDelay);
    }
  }
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
  const msg = String(error?.message || error || '');
  const status = error?.status || error?.statusCode;
  return status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(msg);
}

/**
 * Store user's Gemini API key in session memory
 */
export function setUserKey(userId: string, apiKey: string): void {
  if (!userId) {
    throw new Error('User ID is required to scope API key');
  }
  const cleanKey = cleanApiKey(apiKey);
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
 * Store user's model preference ('auto' or specific model name)
 */
export function setUserModelPreference(userId: string, model: string): void {
  if (userId && model) {
    userModelPreferenceStore.set(userId, model);
  }
}

/**
 * Retrieve user's model preference ('auto' by default)
 */
export function getUserModelPreference(userId: string): string {
  if (!userId) return 'auto';
  return userModelPreferenceStore.get(userId) || 'auto';
}

/**
 * Store user's verified working Gemini model
 */
export function setUserVerifiedModel(userId: string, model: string): void {
  if (userId && model) {
    userVerifiedModelStore.set(userId, model);
  }
}

/**
 * Retrieve user's verified working Gemini model
 */
export function getUserVerifiedModel(userId: string): string | undefined {
  if (!userId) return undefined;
  return userVerifiedModelStore.get(userId);
}

/**
 * Store discovered available models for a user
 */
export function setUserAvailableModels(userId: string, models: string[]): void {
  if (userId && Array.isArray(models)) {
    userAvailableModelsStore.set(userId, models);
  }
}

/**
 * Retrieve discovered available models for a user
 */
export function getUserAvailableModels(userId: string): string[] | undefined {
  if (!userId) return undefined;
  return userAvailableModelsStore.get(userId);
}

/**
 * Delete a user's configured Gemini API key, model preferences, and cache
 */
export function deleteUserKey(userId: string): boolean {
  if (!userId) return false;
  userVerifiedModelStore.delete(userId);
  userModelPreferenceStore.delete(userId);
  userAvailableModelsStore.delete(userId);
  return userKeyStore.delete(userId);
}

/**
 * Clear all user keys and models (for testing / restart)
 */
export function clearAllKeys(): void {
  userKeyStore.clear();
  userVerifiedModelStore.clear();
  userModelPreferenceStore.clear();
  userAvailableModelsStore.clear();
}

/**
 * Query the Gemini ModelService ListModels endpoint to discover models
 * available for generateContent with the user's API key.
 *
 * Requirements:
 * - Queries official Google Generative Language ListModels endpoint.
 * - Passes API key safely via x-goog-api-key header and query parameter for maximum compatibility.
 * - Filters strictly for models supporting generateContent.
 * - Extracts and propagates structured error messages and retryDelay upon error.
 * - Strictly sanitizes errors to ensure API keys are never exposed in error text.
 */
export async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  const cleanKey = cleanApiKey(apiKey);
  if (!cleanKey) return [];

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(cleanKey)}`;
    const response = await fetch(url, {
      headers: {
        'x-goog-api-key': cleanKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errData = (await response.json().catch(() => ({}))) as any;
      const rawMsg = errData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      const reason = errData?.error?.details?.[0]?.reason || errData?.error?.status;
      const compoundMsg = reason ? `[${reason}] ${rawMsg}` : rawMsg;
      const classified = classifyGeminiError(errData?.error || compoundMsg);
      const err = new Error(classified);
      (err as any).retryDelay = extractRetryDelay(errData?.error || compoundMsg);
      (err as any).status = response.status;
      throw err;
    }

    const data = (await response.json()) as {
      models?: Array<{
        name: string;
        supportedGenerationMethods?: string[];
      }>;
    };

    if (!data.models || !Array.isArray(data.models)) {
      return [];
    }

    return data.models
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
  } catch (err: any) {
    const safeError = sanitizeApiKeyError(err?.message || 'Failed to list Gemini models');
    const enrichedErr = new Error(safeError);
    (enrichedErr as any).retryDelay = err?.retryDelay || extractRetryDelay(err);
    (enrichedErr as any).status = err?.status;
    throw enrichedErr;
  }
}

/**
 * Classifies Gemini error messages into clear, actionable, user-friendly feedback
 * while guaranteeing that API keys are strictly redacted.
 * Parses Google's sanitized structured error details including retryDelay when available.
 */
export function classifyGeminiError(error: any): string {
  const rawMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error');
  const safeMsg = sanitizeApiKeyError(rawMessage);

  if (/API_KEY_INVALID|API key not valid|key is invalid/i.test(safeMsg)) {
    return 'Invalid Gemini API key. Google rejected the key as invalid. Please check that you copied the complete key correctly from Google AI Studio.';
  }
  if (/API_KEY_EXPIRED|key expired/i.test(safeMsg)) {
    return 'The provided Gemini API key has expired. Please generate a new key in Google AI Studio.';
  }
  if (/API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|IP address are blocked|API method are blocked/i.test(safeMsg)) {
    return 'Gemini API key restriction block: Google Cloud project restrictions prevent this key from calling the Generative Language API. Remove API, IP, or HTTP referrer restrictions in Google Cloud Console.';
  }
  if (/SERVICE_DISABLED|has not been used in project.*before or it is disabled/i.test(safeMsg)) {
    return 'The Google Generative Language API is disabled for your Google Cloud project. Please enable it in Google Cloud Console.';
  }
  if (/PERMISSION_DENIED|permission denied/i.test(safeMsg)) {
    return 'Gemini API permission denied (403). Ensure the Generative Language API is enabled and your Google account has active access.';
  }
  if (/RESOURCE_EXHAUSTED|quota|rate limit|429/i.test(safeMsg)) {
    const retryDelay = extractRetryDelay(error);
    if (retryDelay) {
      return `Gemini API rate limit or quota exceeded (429). Please retry after ${retryDelay} or review your Google AI Studio plan.`;
    }
    return 'Gemini API rate limit or quota exceeded (429). Please wait before checking again or review your Google AI Studio plan.';
  }
  if (/404|not found for API version|is not supported for generateContent/i.test(safeMsg)) {
    return 'The requested Gemini model was not found or is unsupported for this API version.';
  }
  if (/fetch failed|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|NetworkError/i.test(safeMsg)) {
    return 'Network connectivity error while contacting Google Gemini API. Please check your internet connection.';
  }
  if (/400|INVALID_ARGUMENT|Bad Request/i.test(safeMsg)) {
    return `Gemini API request rejected (400 Bad Request): ${safeMsg}`;
  }
  return safeMsg;
}

/**
 * Select the best model from a list of models supporting generateContent.
 * Prefers current stable models in STABLE_PREFERRED_MODELS order.
 */
export function selectBestGeminiModel(availableModels: string[]): string | null {
  if (!availableModels || availableModels.length === 0) return null;

  // 1. Check in order of our preferred stable models
  for (const candidate of STABLE_PREFERRED_MODELS) {
    if (availableModels.includes(candidate)) {
      return candidate;
    }
  }

  // 2. Any stable non-experimental gemini model
  const nonExpGemini = availableModels.find(
    (m) => m.startsWith('gemini-') && !m.includes('-exp') && !m.includes('experimental')
  );
  if (nonExpGemini) return nonExpGemini;

  // 3. Any gemini model
  const anyGemini = availableModels.find((m) => m.startsWith('gemini-'));
  if (anyGemini) return anyGemini;

  // 4. First model that supports generateContent
  return availableModels[0] || null;
}

/**
 * Returns an ordered list of candidate models to try for text generation.
 */
export function getCandidateGeminiModels(availableModels?: string[]): string[] {
  if (availableModels && availableModels.length > 0) {
    const candidates: string[] = [];
    const best = selectBestGeminiModel(availableModels);
    if (best) candidates.push(best);

    for (const model of STABLE_PREFERRED_MODELS) {
      if (availableModels.includes(model) && !candidates.includes(model)) {
        candidates.push(model);
      }
    }

    for (const model of availableModels) {
      if (!candidates.includes(model)) {
        candidates.push(model);
      }
    }
    return candidates;
  }

  // Fallback defaults if listing was unavailable
  return [...STABLE_PREFERRED_MODELS];
}

/**
 * Resolves the best available text-generation model for a user's key.
 */
export async function resolveActiveGeminiModel(apiKey: string): Promise<string> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) return config.geminiModel;

  try {
    const models = await getAvailableGeminiModels(cleanKey);
    const best = selectBestGeminiModel(models);
    if (best) return best;
  } catch {
    // If listing models fails, proceed with candidates
  }

  return config.geminiModel || 'gemini-2.0-flash';
}

/**
 * Test a Gemini API key and/or specific model selection by making a minimal verification call.
 * Tests actual text generation capability, not just list models.
 *
 * Requirements:
 * - If modelPreference is specified and != 'auto':
 *   - Verifies model exists in user's available models from Google API.
 *   - Tests only that chosen model.
 * - If modelPreference is 'auto':
 *   - Tests candidate models in priority order.
 * - If a quota or rate limit error (429) occurs:
 *   - HALTS IMMEDIATELY without retrying other models (protecting user's quota).
 * - Never leaks the API key in the response or logs.
 */
export async function testGeminiKey(
  apiKey: string,
  modelPreference: string = 'auto'
): Promise<{
  success: boolean;
  model: string;
  message: string;
  availableModels?: string[];
  retryDelay?: string;
}> {
  const cleanKey = cleanApiKey(apiKey);
  if (!cleanKey) {
    return {
      success: false,
      model: config.geminiModel,
      message: 'API key is empty.',
    };
  }

  let availableModels: string[] | undefined;
  try {
    availableModels = await getAvailableGeminiModels(cleanKey);
  } catch (listErr: any) {
    const safeError = classifyGeminiError(listErr);
    // If list models itself failed due to explicit invalid key, expired, restrictions, or quota, fail immediately
    if (/Invalid Gemini API key|expired|restriction block|disabled|rate limit or quota/i.test(safeError)) {
      return {
        success: false,
        model: config.geminiModel,
        message: `Gemini verification failed: ${safeError}`,
        retryDelay: extractRetryDelay(listErr),
      };
    }
  }

  if (availableModels && availableModels.length === 0) {
    return {
      success: false,
      model: config.geminiModel,
      message: 'Your API key is active, but Google returned no models supporting text generation (generateContent) for this account.',
      availableModels: [],
    };
  }

  // Determine candidate models
  let candidates: string[] = [];
  const selectedManual = modelPreference && modelPreference !== 'auto';

  if (selectedManual) {
    // Check if the manually selected model is in the dynamically discovered models
    if (availableModels && availableModels.length > 0 && !availableModels.includes(modelPreference)) {
      return {
        success: false,
        model: modelPreference,
        message: `The selected model "${modelPreference}" is not supported or not available for your Gemini API key account.`,
        availableModels,
      };
    }
    // Only test this explicit model
    candidates = [modelPreference];
  } else {
    // Auto-select candidate models
    candidates = getCandidateGeminiModels(availableModels);
  }

  const genAI = new GoogleGenerativeAI(cleanKey);
  let lastError: any = null;

  for (const candidate of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: candidate });
      const result = await model.generateContent('ping');
      const responseText = result.response.text();

      if (!responseText) {
        continue;
      }

      return {
        success: true,
        model: candidate,
        message: `Gemini API key verified successfully using ${candidate}! Real text generation is operational.`,
        availableModels,
      };
    } catch (err: any) {
      lastError = err;
      const safeError = classifyGeminiError(err);
      const retryDelay = extractRetryDelay(err);

      // CRITICAL: Do NOT automatically retry many models on quota exhaustion or rate limits (Feature B.10)
      if (isRateLimitOrQuotaError(err)) {
        return {
          success: false,
          model: candidate,
          message: `Gemini verification failed: ${safeError}`,
          availableModels,
          retryDelay,
        };
      }

      // If fatal key error (bad key, expired, restrictions, permission denied), break immediately
      if (/Invalid Gemini API key|expired|restriction block|permission denied/i.test(safeError)) {
        return {
          success: false,
          model: candidate,
          message: `Gemini verification failed: ${safeError}`,
          availableModels,
        };
      }

      // If manual model selection was chosen, do not fallback to another model
      if (selectedManual) {
        return {
          success: false,
          model: candidate,
          message: `Gemini verification failed for model ${candidate}: ${safeError}`,
          availableModels,
        };
      }

      // If 404 / unsupported model in auto mode, try the next candidate
      continue;
    }
  }

  const finalError = classifyGeminiError(lastError);
  return {
    success: false,
    model: candidates[0] || config.geminiModel,
    message: `Gemini verification failed: ${finalError}`,
    availableModels,
    retryDelay: extractRetryDelay(lastError),
  };
}

