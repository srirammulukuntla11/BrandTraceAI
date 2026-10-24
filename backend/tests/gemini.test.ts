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
    expect(geminiResult.message).toContain('Gemini AI is not configured');
    expect(geminiResult.findings).toEqual([]);

    // Combined workflow keeps rule violations 100% intact
    const combinedFindings = [...deterministicFindings, ...geminiResult.findings];
    expect(combinedFindings.length).toBe(1);
    expect(combinedFindings[0].quotedText).toBe('the cheap tool');
  });
});
