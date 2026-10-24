import { describe, it, expect, beforeEach } from 'vitest';
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
    const sampleKey = 'AIzaSyFakeSampleKeyForTestingUserScoped123';

    // Save key for reviewer
    const saveRes = await request(app)
      .post('/api/ai-config')
      .set('x-demo-role', 'reviewer')
      .send({ apiKey: sampleKey });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.configured).toBe(true);

    // Verify key is NOT returned in save response
    expect(JSON.stringify(saveRes.body)).not.toContain(sampleKey);

    // Check status for reviewer
    const statusRes = await request(app)
      .get('/api/ai-config')
      .set('x-demo-role', 'reviewer');

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.configured).toBe(true);

    // Verify key is NOT returned in status response
    expect(JSON.stringify(statusRes.body)).not.toContain(sampleKey);
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
});
