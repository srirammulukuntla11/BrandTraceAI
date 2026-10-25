/**
 * Official Google Gemini Developer API Client
 *
 * Implements Google's official REST API specifications for the Gemini Developer API:
 * - Base URL: https://generativelanguage.googleapis.com/v1beta
 * - Endpoint: POST /v1beta/models/{model}:generateContent
 * - Diagnostic Endpoint: GET /v1beta/models
 * - Authentication: 'x-goog-api-key' request header
 *
 * Security & Reliability:
 * - Model names normalized to prevent duplicate "models/models/" paths.
 * - Native request timeouts via AbortSignal.
 * - Deep parsing of Google RPC ErrorInfo, details, and retryDelay.
 * - Complete redaction of API keys from all error messages and logs.
 * - Shared across individual model testing and real compliance analysis.
 */

export interface GeminiGenerationConfig {
  responseMimeType?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface GeminiGenerateOptions {
  apiKey: string;
  modelId: string;
  prompt: string;
  systemInstruction?: string;
  generationConfig?: GeminiGenerationConfig;
  timeoutMs?: number;
}

export interface GeminiCandidateModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

export interface GeminiApiErrorDetails {
  statusCode: number;
  googleStatus?: string;
  message: string;
  retryDelay?: string;
  details?: any[];
}

export class GeminiApiError extends Error {
  public readonly statusCode: number;
  public readonly googleStatus?: string;
  public readonly retryDelay?: string;
  public readonly details?: any[];

  constructor(info: GeminiApiErrorDetails) {
    super(info.message);
    this.name = 'GeminiApiError';
    this.statusCode = info.statusCode;
    this.googleStatus = info.googleStatus;
    this.retryDelay = info.retryDelay;
    this.details = info.details;
  }
}

/**
 * Normalizes a model identifier for the Google API URL path:
 * - Trims whitespace
 * - Strips any leading "models/" prefix so URLs never duplicate:
 *   e.g. "models/gemini-2.0-flash" -> "gemini-2.0-flash"
 */
export function normalizeModelId(model: string): string {
  if (!model) return '';
  let clean = model.trim();
  clean = clean.replace(/^models\//i, '');
  return clean.trim();
}

/**
 * Strips any potential API key patterns (e.g. AIzaSy...) from strings to prevent leakage.
 */
export function redactApiKey(text: string): string {
  if (!text) return '';
  return text.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_API_KEY]');
}

/**
 * Extracts retryDelay from Google RPC error details.
 */
export function parseRetryDelay(errorObj: any): string | undefined {
  if (!errorObj) return undefined;

  // Check structured details array
  if (Array.isArray(errorObj?.details)) {
    for (const d of errorObj.details) {
      if (d?.retryDelay) return String(d.retryDelay);
      if (d?.['@type']?.includes('RetryInfo') && d?.retryDelay) return String(d.retryDelay);
    }
  }

  // Check string match
  const raw = String(errorObj?.message || errorObj || '');
  const match = raw.match(/retry(?:Delay)?(?:\s*after|\s*[:=])?\s*["']?([0-9]+(?:\.[0-9]+)?s?)["']?/i);
  if (match && match[1]) {
    return match[1].endsWith('s') ? match[1] : `${match[1]}s`;
  }

  return undefined;
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Makes a real generation call to the official Google Gemini API via REST.
 * Used by both model testing and compliance analysis.
 */
export async function executeGeminiGenerateContent(
  options: GeminiGenerateOptions
): Promise<{ text: string; model: string; rawResponse?: any }> {
  const { apiKey, modelId, prompt, systemInstruction, generationConfig, timeoutMs = 25000 } = options;

  const cleanKey = (apiKey || '').trim();
  const cleanModel = normalizeModelId(modelId);

  if (!cleanKey) {
    throw new GeminiApiError({
      statusCode: 401,
      googleStatus: 'API_KEY_INVALID',
      message: 'API key is missing or empty.',
    });
  }

  if (!cleanModel) {
    throw new GeminiApiError({
      statusCode: 400,
      googleStatus: 'INVALID_ARGUMENT',
      message: 'Model identifier is required.',
    });
  }

  // Exact Google Gemini REST route: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
  const url = `${BASE_URL}/models/${cleanModel}:generateContent`;

  // Safe stage diagnostic log: Stage 1 - Request Initialization
  console.log(`[GeminiClient] Stage 1: Initiating generateContent for model "${cleanModel}" (timeout: ${timeoutMs}ms)`);

  const requestBody: Record<string, any> = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (generationConfig) {
    requestBody.generationConfig = generationConfig;
  }

  const startTime = Date.now();
  let response: Response;

  // Safe stage diagnostic log: Stage 2 - Outbound HTTP Dispatch
  console.log(`[GeminiClient] Stage 2: Dispatching outbound fetch to Google Gemini API for model "${cleanModel}"`);

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (netErr: any) {
    const elapsedMs = Date.now() - startTime;
    if (netErr.name === 'TimeoutError' || netErr.name === 'AbortError') {
      console.warn(`[GeminiClient] Stage 2 Timeout: Request to model "${cleanModel}" timed out after ${elapsedMs}ms (deadline: ${timeoutMs}ms)`);
      throw new GeminiApiError({
        statusCode: 408,
        message: `Request to Gemini model "${cleanModel}" timed out after ${Math.round(timeoutMs / 1000)}s. Google's API server did not return a response within the timeout limit.`,
      });
    }
    const safeMsg = redactApiKey(netErr.message || 'Network error');
    console.warn(`[GeminiClient] Stage 2 Network Failure: Contacting Google Gemini API for model "${cleanModel}" failed after ${elapsedMs}ms: ${safeMsg}`);
    throw new GeminiApiError({
      statusCode: 0,
      message: `Network connectivity error contacting Google Gemini API: ${safeMsg}`,
    });
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`[GeminiClient] Stage 3: Response received from Google API for model "${cleanModel}" in ${elapsedMs}ms with HTTP status ${response.status} ${response.statusText}`);

  const rawText = await response.text();
  let json: any = {};
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    // Non-JSON response
    if (!response.ok) {
      throw new GeminiApiError({
        statusCode: response.status,
        message: `Gemini API returned HTTP ${response.status} ${response.statusText} with non-JSON response.`,
      });
    }
  }

  if (!response.ok) {
    const errorObj = json?.error || {};
    const googleStatus = errorObj.status || (response.status === 404 ? 'NOT_FOUND' : undefined);
    const retryDelay = parseRetryDelay(errorObj);
    const rawMsg = errorObj.message || json?.message || response.statusText;
    const safeMsg = redactApiKey(rawMsg);

    throw new GeminiApiError({
      statusCode: response.status,
      googleStatus,
      message: safeMsg,
      retryDelay,
      details: errorObj.details,
    });
  }

  // Extract generated text from candidates
  const candidate = json?.candidates?.[0];
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p.text || '').join('') : '';

  if (!text && candidate?.finishReason && candidate.finishReason !== 'STOP') {
    throw new GeminiApiError({
      statusCode: 200,
      message: `Gemini candidate finished with non-standard reason: ${candidate.finishReason}`,
    });
  }

  return {
    text,
    model: cleanModel,
    rawResponse: json,
  };
}

/**
 * Diagnostic helper: Lists available models for an API key via GET /v1beta/models.
 * Internal backend use only for validation and diagnostics.
 * UI candidate list remains predefined and static.
 */
export async function listAvailableGeminiModels(
  apiKey: string,
  timeoutMs: number = 10000
): Promise<GeminiCandidateModel[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) return [];

  const url = `${BASE_URL}/models`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': cleanKey,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const rawText = await response.text();
      let errJson: any = {};
      try {
        errJson = JSON.parse(rawText);
      } catch {
        // ignore
      }
      throw new GeminiApiError({
        statusCode: response.status,
        googleStatus: errJson?.error?.status,
        message: redactApiKey(errJson?.error?.message || response.statusText),
      });
    }

    const data = (await response.json()) as any;
    const models = Array.isArray(data?.models) ? data.models : [];

    return models.map((m: any) => ({
      id: normalizeModelId(m.name || ''),
      name: m.name || '',
      displayName: m.displayName || normalizeModelId(m.name || ''),
      description: m.description || '',
      supportedGenerationMethods: m.supportedGenerationMethods || [],
    }));
  } catch (err: any) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError({
      statusCode: 0,
      message: redactApiKey(err.message || 'Failed to list models'),
    });
  }
}
