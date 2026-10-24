import { describe, it, expect, vi } from 'vitest';
import { runDeterministicChecks } from '../src/services/deterministicChecker.js';
import { runGeminiAnalysis } from '../src/services/geminiService.js';
import { IGuideline } from '../src/types/index.js';

describe('AI Failure & Graceful Degradation Tests', () => {
  const guidelines: IGuideline[] = [
    {
      id: 'rule-brand-name',
      title: 'Official Product Name',
      category: 'terminology',
      ruleDescription: 'Do not use "the cheap tool".',
      prohibitedTerms: ['the cheap tool'],
      preferredTerm: 'BrandTrace AI',
      applicableContentTypes: ['all'],
      status: 'active',
    },
  ];

  it('preserves deterministic findings when GEMINI_API_KEY is not configured', async () => {
    const draftText = 'We launched the cheap tool for our users today.';

    // Deterministic rules must find the prohibited term
    const deterministicFindings = runDeterministicChecks(draftText, guidelines, 'all');
    expect(deterministicFindings.length).toBe(1);
    expect(deterministicFindings[0].type).toBe('Rule Violation');

    // Gemini service called without API key (in test env)
    const geminiResult = await runGeminiAnalysis(draftText, guidelines, 'all');

    // Must return informative message without crashing or faking findings
    expect(geminiResult.available).toBe(false);
    expect(geminiResult.message).toContain('No personal Gemini API key configured');
    expect(geminiResult.findings).toEqual([]);

    // Combined workflow keeps rule violations 100% intact
    const combinedFindings = [...deterministicFindings, ...geminiResult.findings];
    expect(combinedFindings.length).toBe(1);
    expect(combinedFindings[0].quotedText).toBe('the cheap tool');
  });

  it('handles 404 model not found error gracefully and preserves deterministic findings', async () => {
    // Mock GoogleGenerativeAI to simulate model not found error
    const draftText = 'We launched the cheap tool with unmatched 100% satisfaction.';
    const deterministicFindings = runDeterministicChecks(draftText, guidelines, 'all');

    // Mock fetch for model listing or generateContent throwing 404
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({
        error: {
          code: 404,
          message: 'models/gemini-1.5-flash is not found for API version v1beta',
          status: 'NOT_FOUND',
        },
      }),
    })) as any;

    try {
      const geminiResult = await runGeminiAnalysis(
        draftText,
        guidelines,
        'all',
        'AIzaSyDummyKeyForTesting404Error123'
      );

      // AI status is false with sanitized error message
      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('Gemini API call failed');
      expect(geminiResult.message).toContain('unsupported for this API version');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForTesting404Error123');

      // Deterministic check remains intact
      expect(deterministicFindings.length).toBe(1);
      expect(deterministicFindings[0].quotedText).toBe('the cheap tool');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles 429 quota / rate limit errors with clear sanitized message', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        error: {
          code: 429,
          message: 'ResourceExhausted: Quota exceeded for quota metric',
          status: 'RESOURCE_EXHAUSTED',
        },
      }),
    })) as any;

    try {
      const geminiResult = await runGeminiAnalysis(
        'Some draft text for quota test.',
        guidelines,
        'all',
        'AIzaSyDummyKeyForQuotaTest123'
      );

      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('rate limit or quota exceeded (429)');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForQuotaTest123');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles network failure error with clear sanitized message', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      throw new Error('fetch failed: ENOTFOUND generativelanguage.googleapis.com');
    }) as any;

    try {
      const geminiResult = await runGeminiAnalysis(
        'Some draft text for network failure test.',
        guidelines,
        'all',
        'AIzaSyDummyKeyForNetworkTest123'
      );

      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('Network connectivity error');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForNetworkTest123');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('successfully returns grounded findings when Gemini API returns valid structured JSON', async () => {
    const originalFetch = global.fetch;
    // Mock model listing to return gemini-2.5-flash
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
        response: {
          text: () =>
            JSON.stringify({
              findings: [
                {
                  type: 'Potential Concern',
                  severity: 'medium',
                  quotedText: 'unmatched 100% satisfaction',
                  title: 'Unverifiable Guarantee',
                  explanation: 'Absolute satisfaction claims should be verified.',
                  guidelineId: 'rule-brand-name',
                  suggestedCorrection: 'high customer satisfaction',
                },
              ],
            }),
        },
      }),
    } as any);

    try {
      const draftText = 'We provide unmatched 100% satisfaction for all users.';
      const result = await runGeminiAnalysis(
        draftText,
        guidelines,
        'all',
        'AIzaSyValidDummyKeyForSuccessTest123'
      );

      expect(result.available).toBe(true);
      expect(result.model).toBe('gemini-2.0-flash');
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].type).toBe('Potential Concern');
      expect(result.findings[0].quotedText).toBe('unmatched 100% satisfaction');
      expect(result.findings[0].suggestedCorrection).toBe('high customer satisfaction');
    } finally {
      spy.mockRestore();
      global.fetch = originalFetch;
    }
  });

  it('selects best stable model from Google list and strips models/ prefix', async () => {
    const { selectBestGeminiModel, getCandidateGeminiModels } = await import(
      '../src/services/userApiKeyService.js'
    );

    const availableFromGoogle = [
      'embedding-001',
      'gemini-2.0-flash-exp',
      'gemini-1.5-flash',
      'gemini-2.0-flash',
    ];

    const best = selectBestGeminiModel(availableFromGoogle);
    // Should prefer gemini-2.0-flash over experimental or 1.5
    expect(best).toBe('gemini-2.0-flash');

    const candidates = getCandidateGeminiModels(availableFromGoogle);
    expect(candidates[0]).toBe('gemini-2.0-flash');
    expect(candidates).toContain('gemini-1.5-flash');
    // None should contain models/ prefix
    expect(candidates.every((c) => !c.startsWith('models/'))).toBe(true);
  });

  it('reports sanitized explanation when key has zero supported models', async () => {
    const { testGeminiKey } = await import('../src/services/userApiKeyService.js');

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: 'models/embedding-gecko-001',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      }),
    })) as any;

    try {
      const res = await testGeminiKey('AIzaSyValidKeyWithNoSupportedModels123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('no models supporting text generation');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
