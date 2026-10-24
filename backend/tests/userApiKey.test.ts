import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import { runGeminiAnalysis } from '../src/services/geminiService.js';
import { runDeterministicChecks } from '../src/services/deterministicChecker.js';
import {
  setUserKey,
  getUserKey,
  hasUserKey,
  deleteUserKey,
  clearAllKeys,
  sanitizeApiKeyError,
  testGeminiKey,
} from '../src/services/userApiKeyService.js';
import { IGuideline } from '../src/types/index.js';

describe('User-Scoped Gemini API Key Management & Isolation', () => {
  beforeEach(() => {
    clearAllKeys();
  });

  it('Requirement: No platform-key fallback exists', () => {
    // config object must NOT have a platform-wide geminiApiKey property
    expect((config as any).geminiApiKey).toBeUndefined();
  });

  it('Requirement: Missing user key returns clear message and does not crash or fake findings', async () => {
    const guidelines: IGuideline[] = [
      {
        id: 'g-1',
        title: 'Brand Voice',
        category: 'tone',
        ruleDescription: 'Maintain professional voice.',
        prohibitedTerms: [],
        applicableContentTypes: ['all'],
        status: 'active',
      },
    ];

    // Calling runGeminiAnalysis without a userApiKey
    const result = await runGeminiAnalysis('Some draft text here.', guidelines, 'all');

    expect(result.available).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.message).toContain('No personal Gemini API key configured');
    expect(result.message).toContain('AI Configuration');
  });

  it('Requirement: User key configured allows saving and status check without exposing key', async () => {
    const sampleKey = 'AIzaSyValidSampleKeyForTestingUserScoped123';

    // Mock fetch for Google model listing and GoogleGenerativeAI for generation ping
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.0-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'pong' },
      }),
    } as any);

    try {
      // Save key for reviewer
      const saveRes = await request(app)
        .post('/api/ai-config')
        .set('x-demo-role', 'reviewer')
        .send({ apiKey: sampleKey });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.configured).toBe(true);
      expect(saveRes.body.model).toBe('gemini-2.0-flash');

      // Verify key is NOT returned in save response
      expect(JSON.stringify(saveRes.body)).not.toContain(sampleKey);

      // Check status for reviewer
      const statusRes = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'reviewer');

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.configured).toBe(true);
      expect(statusRes.body.model).toBe('gemini-2.0-flash');

      // Verify key is NOT returned in status response
      expect(JSON.stringify(statusRes.body)).not.toContain(sampleKey);
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('Requirement: Saving an invalid key is rejected with status 400 and not marked active', async () => {
    const invalidKey = 'AIzaSyInvalidKeyRejectedByGoogle123';

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 400,
          message: 'API key not valid. Please pass a valid API key.',
          status: 'INVALID_ARGUMENT',
          details: [{ reason: 'API_KEY_INVALID' }],
        },
      }),
    })) as any;

    try {
      const saveRes = await request(app)
        .post('/api/ai-config')
        .set('x-demo-role', 'creator')
        .send({ apiKey: invalidKey });

      expect(saveRes.status).toBe(400);
      expect(saveRes.body.success).toBe(false);
      expect(saveRes.body.error).toContain('Invalid Gemini API key');
      expect(saveRes.body.error).not.toContain(invalidKey);

      // Verify key was NOT activated
      const statusRes = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'creator');
      expect(statusRes.body.configured).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Requirement: Key replacement replaces existing key with new verified key', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-1.5-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'pong' },
      }),
    } as any);

    try {
      // First save
      await request(app)
        .post('/api/ai-config')
        .set('x-demo-role', 'reviewer')
        .send({ apiKey: 'AIzaSyFirstValidKey123456789' });
      expect(getUserKey('demo-reviewer-1')).toBe('AIzaSyFirstValidKey123456789');

      // Replace key
      const replaceRes = await request(app)
        .post('/api/ai-config')
        .set('x-demo-role', 'reviewer')
        .send({ apiKey: 'AIzaSySecondReplacementKey987654' });

      expect(replaceRes.status).toBe(200);
      expect(getUserKey('demo-reviewer-1')).toBe('AIzaSySecondReplacementKey987654');
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('Requirement: Removing the key clears it from user session', async () => {
    setUserKey('demo-reviewer-1', 'AIzaSyFakeSampleKey1234567890');
    expect(hasUserKey('demo-reviewer-1')).toBe(true);

    const deleteRes = await request(app)
      .delete('/api/ai-config')
      .set('x-demo-role', 'reviewer');

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.configured).toBe(false);
    expect(hasUserKey('demo-reviewer-1')).toBe(false);
  });

  it('Requirement: Strict Isolation between users (User A key cannot be used or accessed by User B)', async () => {
    const userAKey = 'AIzaSyUserAKey12345678901234567890';
    setUserKey('demo-reviewer-1', userAKey);

    // User A (reviewer) has key configured
    const userAStatus = await request(app)
      .get('/api/ai-config')
      .set('x-demo-role', 'reviewer');
    expect(userAStatus.body.configured).toBe(true);

    // User B (creator) does NOT have key configured
    const userBStatus = await request(app)
      .get('/api/ai-config')
      .set('x-demo-role', 'creator');
    expect(userBStatus.body.configured).toBe(false);

    // User B's internal key is undefined
    expect(getUserKey('demo-creator-1')).toBeUndefined();
    expect(getUserKey('demo-reviewer-1')).toBe(userAKey);

    // User B deleting their key does not affect User A's key
    await request(app)
      .delete('/api/ai-config')
      .set('x-demo-role', 'creator');

    expect(hasUserKey('demo-reviewer-1')).toBe(true);
    expect(hasUserKey('demo-creator-1')).toBe(false);
  });

  it('Requirement: Testing connection with empty or missing key is rejected', async () => {
    const res = await request(app)
      .post('/api/ai-config/test')
      .set('x-demo-role', 'creator')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('No Gemini API key provided');
  });

  it('Requirement: Invalid key produces sanitized error without leaking key', async () => {
    const invalidKey = 'AIzaSyInvalidKeyTest1234567890123456789';
    const testResult = await testGeminiKey(invalidKey);

    expect(testResult.success).toBe(false);
    // Error message must NOT leak the raw API key
    expect(testResult.message).not.toContain(invalidKey);
  });

  it('Requirement: No key leakage in sanitizeApiKeyError', () => {
    const rawErrorMessage = 'Request failed with key AIzaSyTestKeyLeakedInError1234567890: 400 Bad Request';
    const sanitized = sanitizeApiKeyError(rawErrorMessage);

    expect(sanitized).not.toContain('AIzaSyTestKeyLeakedInError1234567890');
    expect(sanitized).toContain('[REDACTED_API_KEY]');
  });

  it('Requirement: Deterministic checks work 100% without any Gemini key', () => {
    const guidelines: IGuideline[] = [
      {
        id: 'rule-term-1',
        title: 'Platform Terminology',
        category: 'terminology',
        ruleDescription: 'Do not use the bot.',
        prohibitedTerms: ['the bot'],
        preferredTerm: 'BrandTrace AI',
        applicableContentTypes: ['all'],
        status: 'active',
      },
      {
        id: 'rule-disc-1',
        title: 'Mandatory Disclaimer',
        category: 'disclaimer',
        ruleDescription: 'Social posts must include the disclaimer.',
        prohibitedTerms: [],
        requiredTerms: ['BrandTrace AI is explainable'],
        applicableContentTypes: ['social_post'],
        status: 'active',
      },
    ];

    const draft = 'Here is a release using the bot without required text.';
    // Deterministic rules run completely independently of any AI key
    const findings = runDeterministicChecks(draft, guidelines, 'social_post');

    expect(findings.length).toBe(2);
    expect(findings.some((f) => f.quotedText === 'the bot')).toBe(true);
    expect(findings.some((f) => f.title.includes('Missing required'))).toBe(true);
  });

  it('Requirement: cleanApiKey correctly normalizes quotes, whitespace, and prefixes', async () => {
    const { cleanApiKey } = await import('../src/services/userApiKeyService.js');

    expect(cleanApiKey('  AIzaSyValidKey123  \n')).toBe('AIzaSyValidKey123');
    expect(cleanApiKey('"AIzaSyQuotedKey123"')).toBe('AIzaSyQuotedKey123');
    expect(cleanApiKey("'AIzaSySingleQuotedKey123'")).toBe('AIzaSySingleQuotedKey123');
    expect(cleanApiKey('export GEMINI_API_KEY=AIzaSyExportKey123')).toBe('AIzaSyExportKey123');
    expect(cleanApiKey('Bearer AIzaSyBearerKey123')).toBe('AIzaSyBearerKey123');
  });

  it('Requirement: Test Connection performs real minimal text-generation request', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.0-flash',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    let pingCalled = false;
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
      generateContent: vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt === 'ping') pingCalled = true;
        return { response: { text: () => 'pong' } };
      }),
    } as any);

    try {
      const res = await testGeminiKey('AIzaSyValidKeyForPingTest123');
      expect(res.success).toBe(true);
      expect(res.model).toBe('gemini-2.0-flash');
      expect(res.message).toContain('Real text generation is operational');
      expect(pingCalled).toBe(true);
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('Feature B: Model discovery filters only models that explicitly support generateContent', async () => {
    const { getAvailableGeminiModels } = await import('../src/services/userApiKeyService.js');
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.0-flash',
            supportedGenerationMethods: ['generateContent', 'countTokens'],
          },
          {
            name: 'models/text-embedding-004',
            supportedGenerationMethods: ['embedContent'], // Should be filtered OUT
          },
          {
            name: 'models/gemini-1.5-pro',
            supportedGenerationMethods: ['generateContent'],
          },
        ],
      }),
    })) as any;

    try {
      const models = await getAvailableGeminiModels('AIzaSyValidSampleKey');
      expect(models).toEqual(['gemini-2.0-flash', 'gemini-1.5-pro']);
      expect(models).not.toContain('text-embedding-004');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B: Manual model selection tests only that chosen model with one ping', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const testedModels: string[] = [];
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation(({ model }: any) => {
      testedModels.push(model);
      return {
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'pong' } }),
      } as any;
    });

    try {
      const res = await testGeminiKey('AIzaSyValidSampleKey', 'gemini-1.5-pro');
      expect(res.success).toBe(true);
      expect(res.model).toBe('gemini-1.5-pro');
      // Must test strictly the requested model
      expect(testedModels).toEqual(['gemini-1.5-pro']);
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('Feature B: Unsupported model requested returns clear error and rejects verification', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    try {
      const res = await testGeminiKey('AIzaSyValidSampleKey', 'non-existent-or-unsupported-model');
      expect(res.success).toBe(false);
      expect(res.message).toContain('not supported or not available');
      expect(res.model).toBe('non-existent-or-unsupported-model');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B & C: Quota exhaustion (429) stops retries immediately and extracts retryDelay', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    let attempts = 0;
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockImplementation(() => {
      attempts++;
      return {
        generateContent: vi.fn().mockRejectedValue({
          status: 429,
          message: '[429 Too Many Requests] Resource has been exhausted (e.g. check quota). retryDelay: "24s"',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '24s' }],
        }),
      } as any;
    });

    try {
      // In auto mode, ordinarily candidates would be retried, but on 429 it MUST NOT retry
      const res = await testGeminiKey('AIzaSyValidKey', 'auto');
      expect(res.success).toBe(false);
      expect(res.message).toContain('rate limit or quota exceeded (429)');
      expect(res.message).toContain('24s');
      expect(res.retryDelay).toBe('24s');
      // Crucial: Only 1 attempt made, did not try other models
      expect(attempts).toBe(1);
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('Feature B: User model preference is saved and isolated per user', async () => {
    const {
      setUserModelPreference,
      getUserModelPreference,
    } = await import('../src/services/userApiKeyService.js');

    setUserModelPreference('user-alice', 'gemini-1.5-pro');
    setUserModelPreference('user-bob', 'gemini-2.0-flash');

    expect(getUserModelPreference('user-alice')).toBe('gemini-1.5-pro');
    expect(getUserModelPreference('user-bob')).toBe('gemini-2.0-flash');
    expect(getUserModelPreference('user-charlie')).toBe('auto'); // Default
  });

  it('Feature B: Refresh Models endpoint returns list of available models for authenticated user', async () => {
    setUserKey('demo-reviewer-1', 'AIzaSyValidReviewerKey123');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    try {
      const res = await request(app)
        .get('/api/ai-config/models')
        .set('x-demo-role', 'reviewer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toEqual(['gemini-2.0-flash', 'gemini-1.5-flash']);
      expect(res.body.count).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B: POST /api/ai-config/models discovers models with provided apiKey before saving', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-1.5-flash', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    try {
      const res = await request(app)
        .post('/api/ai-config/models')
        .set('x-demo-role', 'creator')
        .send({ apiKey: 'AIzaSyUnsavedKeyForModelDiscovery123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toEqual(['gemini-2.0-flash', 'gemini-1.5-flash']);
      expect(res.body.count).toBe(2);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B & C: Refresh failure preserves cached models and returns error with retryDelay', async () => {
    const { setUserAvailableModels } = await import('../src/services/userApiKeyService.js');
    setUserKey('demo-reviewer-1', 'AIzaSyValidReviewerKey123');
    setUserAvailableModels('demo-reviewer-1', ['gemini-2.0-flash']);

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        error: {
          code: 429,
          message: 'Resource has been exhausted (e.g. check quota). retryDelay: "30s"',
          status: 'RESOURCE_EXHAUSTED',
          details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }],
        },
      }),
    })) as any;

    try {
      const res = await request(app)
        .post('/api/ai-config/models')
        .set('x-demo-role', 'reviewer')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('rate limit or quota exceeded (429)');
      expect(res.body.retryDelay).toBe('30s');
      // Requirement 7: Preserves cached models!
      expect(res.body.models).toEqual(['gemini-2.0-flash']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B: GET /api/ai-config returns modelsError when background discovery fails', async () => {
    setUserKey('demo-reviewer-1', 'AIzaSyKeyThatFailsListing123');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: 403,
          message: 'The Google Generative Language API is disabled for your Google Cloud project.',
          status: 'PERMISSION_DENIED',
          details: [{ reason: 'SERVICE_DISABLED' }],
        },
      }),
    })) as any;

    try {
      const res = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'reviewer');

      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
      expect(res.body.availableModels).toEqual([]);
      expect(res.body.modelsError).toContain('API is disabled');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Feature B: PATCH /api/ai-config/model updates model preference after successful test ping', async () => {
    setUserKey('demo-reviewer-1', 'AIzaSyValidReviewerKey123');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] },
        ],
      }),
    })) as any;

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: { text: () => 'pong' },
      }),
    } as any);

    try {
      const res = await request(app)
        .patch('/api/ai-config/model')
        .set('x-demo-role', 'reviewer')
        .send({ selectedModel: 'gemini-1.5-pro' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.selectedModel).toBe('gemini-1.5-pro');
      expect(res.body.activeModel).toBe('gemini-1.5-pro');

      // Verify preference was persisted in user store
      const { getUserModelPreference, getUserVerifiedModel } = await import(
        '../src/services/userApiKeyService.js'
      );
      expect(getUserModelPreference('demo-reviewer-1')).toBe('gemini-1.5-pro');
      expect(getUserVerifiedModel('demo-reviewer-1')).toBe('gemini-1.5-pro');
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });
});

