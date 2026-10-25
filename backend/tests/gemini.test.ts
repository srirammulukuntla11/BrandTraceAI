import { describe, it, expect, vi } from 'vitest';
import { runDeterministicChecks } from '../src/services/deterministicChecker.js';
import { runGeminiAnalysis } from '../src/services/geminiService.js';
import {
  testIndividualModel,
  selectBestGeminiModel,
  PREDEFINED_GEMINI_MODELS,
  PREDEFINED_MODEL_IDS,
} from '../src/services/userApiKeyService.js';
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
    const draftText = 'We launched the cheap tool with unmatched 100% satisfaction.';
    const deterministicFindings = runDeterministicChecks(draftText, guidelines, 'all');

    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      expect(String(url)).toContain('/v1beta/models/gemini-3.8-flash:generateContent');
      return new Response(
        JSON.stringify({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            message: 'models/gemini-3.8-flash was not found for API version v1beta',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    });

    try {
      const geminiResult = await runGeminiAnalysis(
        draftText,
        guidelines,
        'all',
        'AIzaSyDummyKeyForTesting404Error123',
        'gemini-3.8-flash'
      );

      // AI status is false with sanitized error message
      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('Gemini API call failed');
      expect(geminiResult.message).toContain('404');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForTesting404Error123');

      // Deterministic check remains intact
      expect(deterministicFindings.length).toBe(1);
      expect(deterministicFindings[0].quotedText).toBe('the cheap tool');
    } finally {
      spy.mockRestore();
    }
  });

  it('handles 429 quota / rate limit errors with clear sanitized message', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 429,
            status: 'RESOURCE_EXHAUSTED',
            message: 'ResourceExhausted: Quota exceeded for quota metric',
            details: [{ retryDelay: '15s' }],
          },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    });

    try {
      const geminiResult = await runGeminiAnalysis(
        'Some draft text for quota test.',
        guidelines,
        'all',
        'AIzaSyDummyKeyForQuotaTest123',
        'gemini-3.8-flash'
      );

      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('rate limit or quota exceeded (429)');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForQuotaTest123');
    } finally {
      spy.mockRestore();
    }
  });

  it('handles network failure error with clear sanitized message', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('fetch failed: ENOTFOUND generativelanguage.googleapis.com')
    );

    try {
      const geminiResult = await runGeminiAnalysis(
        'Some draft text for network failure test.',
        guidelines,
        'all',
        'AIzaSyDummyKeyForNetworkTest123',
        'gemini-3.8-flash'
      );

      expect(geminiResult.available).toBe(false);
      expect(geminiResult.message).toContain('Network connectivity');
      expect(geminiResult.message).not.toContain('AIzaSyDummyKeyForNetworkTest123');
    } finally {
      spy.mockRestore();
    }
  });

  it('successfully returns grounded findings when Gemini API returns valid structured JSON', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
      // Validate REST URL, header, and body
      expect(String(url)).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
      expect(init?.headers?.['x-goog-api-key']).toBe('AIzaSyValidDummyKeyForSuccessTest123');
      const body = JSON.parse(init.body);
      expect(body.contents[0].parts[0].text).toBeDefined();

      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
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
                ],
                role: 'model',
              },
              finishReason: 'STOP',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    try {
      const draftText = 'We provide unmatched 100% satisfaction for all users.';
      const result = await runGeminiAnalysis(
        draftText,
        guidelines,
        'all',
        'AIzaSyValidDummyKeyForSuccessTest123',
        'gemini-3.8-flash'
      );

      expect(result.available).toBe(true);
      expect(result.model).toBe('gemini-3.8-flash');
      expect(result.findings.length).toBe(1);
      expect(result.findings[0].type).toBe('Potential Concern');
      expect(result.findings[0].quotedText).toBe('unmatched 100% satisfaction');
      expect(result.findings[0].suggestedCorrection).toBe('high customer satisfaction');
    } finally {
      spy.mockRestore();
    }
  });

  it('selects best stable model from predefined candidate list', () => {
    const best = selectBestGeminiModel(['gemini-2.5-flash', 'gemini-3.8-flash']);
    expect(best).toBe('gemini-3.8-flash');

    expect(PREDEFINED_MODEL_IDS).toContain('gemini-3.8-flash');
    expect(PREDEFINED_MODEL_IDS).toContain('gemini-3.6-flash');
    expect(PREDEFINED_MODEL_IDS).toContain('gemini-2.5-flash');
    expect(PREDEFINED_MODEL_IDS).toContain('gemini-2.5-flash-lite');
    expect(PREDEFINED_MODEL_IDS.every((c) => !c.startsWith('models/'))).toBe(true);
  });

  it('reports sanitized explanation when model is unsupported or invalid', async () => {
    const res = await testIndividualModel(
      'AIzaSyValidKeyWithUnsupportedModel123',
      'invalid-nonexistent-model'
    );
    expect(res.status).toBe('unsupported_model');
    expect(res.message).toContain('not in the predefined Gemini model list');
  });
});
