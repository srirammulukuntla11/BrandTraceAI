import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import {
  setUserKey,
  getUserKey,
  getUserMaskedKey,
  hasUserKey,
  deleteUserKey,
  clearAllKeys,
  sanitizeApiKeyError,
  testIndividualModel,
  getUserActiveModel,
  setUserActiveModel,
  getAllUserModelTests,
  isModelTestPassed,
  PREDEFINED_GEMINI_MODELS,
  PREDEFINED_MODEL_IDS,
} from '../src/services/userApiKeyService.js';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../src/utils/crypto.js';
import { IGuideline } from '../src/types/index.js';

describe('Gemini Predefined Models, Individual Testing & Activation Architecture', () => {
  beforeEach(() => {
    clearAllKeys();
  });

  describe('A. Predefined Model List', () => {
    it('1. Predefined model list is populated from centralized configuration', () => {
      expect(PREDEFINED_GEMINI_MODELS.length).toBe(4);
      expect(PREDEFINED_MODEL_IDS).toContain('gemini-3.8-flash');
      expect(PREDEFINED_MODEL_IDS).toContain('gemini-3.6-flash');
      expect(PREDEFINED_MODEL_IDS).toContain('gemini-2.5-flash');
      expect(PREDEFINED_MODEL_IDS).toContain('gemini-2.5-flash-lite');
    });

    it('2. Model identifiers and human-readable display labels remain separate', () => {
      const flash = PREDEFINED_GEMINI_MODELS.find((m) => m.id === 'gemini-3.8-flash');
      expect(flash).toBeDefined();
      expect(flash?.id).toBe('gemini-3.8-flash');
      expect(flash?.name).toBe('Gemini 3.8 Flash');
      expect(flash?.description).toBeDefined();
    });

    it('3. GET /api/ai-config/models returns predefined list immediately without external API call', async () => {
      const res = await request(app)
        .get('/api/ai-config/models')
        .set('x-demo-role', 'reviewer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.models).toEqual(PREDEFINED_GEMINI_MODELS);
      expect(res.body.count).toBe(PREDEFINED_GEMINI_MODELS.length);
    });

    it('4. Invalid model identifiers are rejected by backend validation', async () => {
      const res = await request(app)
        .post('/api/ai-config/test')
        .set('x-demo-role', 'reviewer')
        .send({
          model: 'unsupported-hallucinated-model',
          apiKey: 'AIzaSyValidDummyKeyForTesting12345',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not in the predefined Gemini model list');
    });

    it('5. Failed model tests do NOT remove or filter models from the predefined list', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyValidDummyKeyForTesting12345');

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'ResourceExhausted: Quota exceeded for quota metric',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        // Test Model A fails
        const testRes = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.8-flash' });

        expect(testRes.status).toBe(400);
        expect(testRes.body.test.status).toBe('quota_exceeded');

        // Status check verifies predefined models are still intact
        const statusRes = await request(app)
          .get('/api/ai-config')
          .set('x-demo-role', 'reviewer');

        expect(statusRes.body.predefinedModels.length).toBe(PREDEFINED_GEMINI_MODELS.length);
        expect(statusRes.body.availableModels).toEqual(PREDEFINED_MODEL_IDS);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('B. Individual Model Testing', () => {
    it('6. Testing Model A, B, and C independently with distinct statuses', async () => {
      const apiKey = 'AIzaSySampleKeyForIndividualTesting123';
      setUserKey('demo-reviewer-1', apiKey);

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, init: any) => {
        const urlStr = String(url);
        // Verify exact Google REST path and auth header
        expect(init?.headers?.['x-goog-api-key']).toBe(apiKey);

        if (urlStr.includes('gemini-3.8-flash:generateContent')) {
          // Model A: fails with 429 quota
          return new Response(
            JSON.stringify({
              error: {
                code: 429,
                status: 'RESOURCE_EXHAUSTED',
                message: 'ResourceExhausted: Quota exceeded for quota metric',
                details: [{ retryDelay: '30s' }],
              },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        } else if (urlStr.includes('gemini-3.6-flash:generateContent')) {
          // Model B: passes with real text generation
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: { parts: [{ text: 'pong' }], role: 'model' },
                  finishReason: 'STOP',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } else if (urlStr.includes('gemini-2.5-flash:generateContent')) {
          // Model C: fails with 404 not found
          return new Response(
            JSON.stringify({
              error: {
                code: 404,
                status: 'NOT_FOUND',
                message: 'models/gemini-2.5-flash is not found for API version v1beta',
              },
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      try {
        // Test Model A (gemini-3.8-flash)
        const resA = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.8-flash' });

        expect(resA.status).toBe(400);
        expect(resA.body.test.status).toBe('quota_exceeded');
        expect(resA.body.test.message).toContain('rate limit or quota exceeded (429)');

        // Verify Model B and C have NOT been tested yet (no automatic testing loop)
        const testsAfterA = getAllUserModelTests('demo-reviewer-1');
        expect(testsAfterA['gemini-3.8-flash']?.status).toBe('quota_exceeded');
        expect(testsAfterA['gemini-3.6-flash']).toBeUndefined();
        expect(testsAfterA['gemini-2.5-flash']).toBeUndefined();

        // Test Model B (gemini-3.6-flash) independently
        const resB = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.6-flash' });

        expect(resB.status).toBe(200);
        expect(resB.body.success).toBe(true);
        expect(resB.body.test.status).toBe('passed');

        // Test Model C (gemini-2.5-flash) independently
        const resC = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-2.5-flash' });

        expect(resC.status).toBe(400);
        expect(resC.body.test.status).toBe('model_not_found');

        // Verify all 3 models retain their independent test statuses
        const allTests = getAllUserModelTests('demo-reviewer-1');
        expect(allTests['gemini-3.8-flash'].status).toBe('quota_exceeded');
        expect(allTests['gemini-3.6-flash'].status).toBe('passed');
        expect(allTests['gemini-2.5-flash'].status).toBe('model_not_found');
      } finally {
        spy.mockRestore();
      }
    });

    it('7. Rate limit retry delay is extracted and reported', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyValidDummyKey123');

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'Quota exceeded. Please retry after 25s',
              details: [{ retryDelay: '25s' }],
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        const res = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.8-flash' });

        expect(res.status).toBe(400);
        expect(res.body.test.status).toBe('quota_exceeded');
        expect(res.body.retryDelay).toBe('25s');
      } finally {
        spy.mockRestore();
      }
    });

    it('8. A user can retry testing a failed model after failure', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyValidDummyKey123');
      let attempt = 0;

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: 429,
                status: 'RESOURCE_EXHAUSTED',
                message: 'ResourceExhausted: Quota exceeded',
              },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'pong' }], role: 'model' },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        // Attempt 1: Fails
        const res1 = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.8-flash' });
        expect(res1.status).toBe(400);
        expect(res1.body.test.status).toBe('quota_exceeded');

        // Attempt 2: Retried and passes
        const res2 = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.8-flash' });
        expect(res2.status).toBe(200);
        expect(res2.body.test.status).toBe('passed');
        expect(isModelTestPassed('demo-reviewer-1', 'gemini-3.8-flash')).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('C. Model Activation & Persistence', () => {
    it('9. A model cannot be activated without a successful generation test', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyValidDummyKey123');

      // Attempt activation without testing
      const res = await request(app)
        .post('/api/ai-config/activate')
        .set('x-demo-role', 'reviewer')
        .send({ model: 'gemini-3.6-flash' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('must pass a real generation test before activation');
      expect(getUserActiveModel('demo-reviewer-1')).toBeUndefined();
    });

    it('10. Activating a successfully tested model persists authoritative active model', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyValidDummyKey123');

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'pong' }], role: 'model' },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        // 1. Test model
        const testRes = await request(app)
          .post('/api/ai-config/test')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.6-flash' });
        expect(testRes.status).toBe(200);

        // 2. Activate model
        const activateRes = await request(app)
          .post('/api/ai-config/activate')
          .set('x-demo-role', 'reviewer')
          .send({ model: 'gemini-3.6-flash' });

        expect(activateRes.status).toBe(200);
        expect(activateRes.body.success).toBe(true);
        expect(activateRes.body.activeModel).toBe('gemini-3.6-flash');
        expect(getUserActiveModel('demo-reviewer-1')).toBe('gemini-3.6-flash');

        // 3. Status check simulates page refresh
        const statusRes = await request(app)
          .get('/api/ai-config')
          .set('x-demo-role', 'reviewer');
        expect(statusRes.body.activeModel).toBe('gemini-3.6-flash');
      } finally {
        spy.mockRestore();
      }
    });

    it('11. User configuration isolation: Reviewer activation does not affect Creator', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyReviewerKey123');
      setUserKey('demo-creator-1', 'AIzaSyCreatorKey456');

      setUserActiveModel('demo-reviewer-1', 'gemini-3.6-flash');
      // Creator has not activated any model
      expect(getUserActiveModel('demo-creator-1')).toBeUndefined();

      // Check status for Reviewer
      const reviewerRes = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'reviewer');
      expect(reviewerRes.body.activeModel).toBe('gemini-3.6-flash');

      // Check status for Creator
      const creatorRes = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'creator');
      expect(creatorRes.body.activeModel).toBeNull();
    });
  });

  describe('D. Compliance Analysis Powered by Active Model', () => {
    it('12. Deterministic rules run when Gemini is not configured', async () => {
      const draftText = 'We launched our cheap tool today.';
      const res = await request(app)
        .post('/api/content/check')
        .set('x-demo-role', 'creator')
        .send({
          text: draftText,
          contentType: 'blog_post',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.findings.length).toBe(1);
      expect(res.body.findings[0].type).toBe('Rule Violation');
      expect(res.body.findings[0].quotedText).toBe('cheap tool');
      expect(res.body.aiStatus.available).toBe(false);
      expect(res.body.aiStatus.message).toContain('No personal Gemini API key configured');
    });

    it('13. Compliance analysis uses the EXACT active model identifier without silent substitution', async () => {
      setUserKey('demo-creator-1', 'AIzaSyCreatorKey123');
      setUserActiveModel('demo-creator-1', 'gemini-2.5-flash');

      let modelPassedToGemini: string | undefined;

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        const match = urlStr.match(/\/models\/([^:]+):generateContent/);
        if (match) modelPassedToGemini = match[1];

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
                            severity: 'low',
                            quotedText: 'revolutionary breakthrough',
                            title: 'Exaggerated Tone',
                            explanation: 'Tone should be measured.',
                            guidelineId: null,
                            suggestedCorrection: 'significant update',
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
        const res = await request(app)
          .post('/api/content/check')
          .set('x-demo-role', 'creator')
          .send({
            text: 'We launched a revolutionary breakthrough in our product.',
            contentType: 'blog_post',
          });

        expect(res.status).toBe(200);
        expect(modelPassedToGemini).toBe('gemini-2.5-flash');
        expect(res.body.aiStatus.available).toBe(true);
        expect(res.body.aiStatus.model).toBe('gemini-2.5-flash');
        expect(res.body.findings.length).toBe(1);
        expect(res.body.findings[0].title).toBe('Exaggerated Tone');
      } finally {
        spy.mockRestore();
      }
    });

    it('14. Deterministic findings survive Gemini HTTP 429 quota failure', async () => {
      setUserKey('demo-creator-1', 'AIzaSyCreatorKey123');
      setUserActiveModel('demo-creator-1', 'gemini-3.8-flash');

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              status: 'RESOURCE_EXHAUSTED',
              message: 'ResourceExhausted: Quota exceeded for quota metric',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      });

      try {
        const res = await request(app)
          .post('/api/content/check')
          .set('x-demo-role', 'creator')
          .send({
            text: 'We launched our cheap tool across the nation today.',
            contentType: 'blog_post',
          });

        expect(res.status).toBe(200);
        // Deterministic finding survives
        expect(res.body.findings.length).toBe(1);
        expect(res.body.findings[0].quotedText).toBe('cheap tool');
        expect(res.body.findings[0].type).toBe('Rule Violation');

        // AI status indicates 429 failure accurately
        expect(res.body.aiStatus.available).toBe(false);
        expect(res.body.aiStatus.model).toBe('gemini-3.8-flash');
        expect(res.body.aiStatus.message).toContain('rate limit or quota exceeded (429)');
      } finally {
        spy.mockRestore();
      }
    });

    it('15. Deterministic findings survive Gemini timeout or network failure', async () => {
      setUserKey('demo-creator-1', 'AIzaSyCreatorKey123');
      setUserActiveModel('demo-creator-1', 'gemini-3.8-flash');

      const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('ETIMEDOUT connection timed out')
      );

      try {
        const res = await request(app)
          .post('/api/content/check')
          .set('x-demo-role', 'creator')
          .send({
            text: 'Do not use this cheap tool.',
            contentType: 'blog_post',
          });

        expect(res.status).toBe(200);
        expect(res.body.findings.length).toBe(1);
        expect(res.body.findings[0].quotedText).toBe('cheap tool');
        expect(res.body.aiStatus.available).toBe(false);
        expect(res.body.aiStatus.message).toContain('Network connectivity');
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe('E. Security and Configuration State Integrity', () => {
    it('16. No platform-wide Gemini fallback key exists', () => {
      expect((config as any).geminiApiKey).toBeUndefined();
    });

    it('17. Full API keys are never exposed in configuration or status responses', async () => {
      const secretKey = 'AIzaSyPrivateSuperSecretKeyDoNotExpose12345';
      setUserKey('demo-reviewer-1', secretKey);

      const statusRes = await request(app)
        .get('/api/ai-config')
        .set('x-demo-role', 'reviewer');

      expect(statusRes.status).toBe(200);
      expect(JSON.stringify(statusRes.body)).not.toContain(secretKey);
      expect(statusRes.body.maskedKey.startsWith('AIza')).toBe(true);
      expect(statusRes.body.maskedKey.endsWith('2345')).toBe(true);
      expect(statusRes.body.maskedKey).toContain('•');
    });

    it('18. Error messages sanitize potential API keys', () => {
      const leak = 'Failed at key AIzaSyLeakedKeyPattern123456789 with error';
      const sanitized = sanitizeApiKeyError(leak);
      expect(sanitized).not.toContain('AIzaSyLeakedKeyPattern123456789');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });

    it('19. DELETE /api/ai-config clears user session key, active model, and test cache', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyTestKey123');
      setUserActiveModel('demo-reviewer-1', 'gemini-3.8-flash');

      const delRes = await request(app)
        .delete('/api/ai-config')
        .set('x-demo-role', 'reviewer');

      expect(delRes.status).toBe(200);
      expect(delRes.body.configured).toBe(false);
      expect(delRes.body.activeModel).toBeNull();
      expect(hasUserKey('demo-reviewer-1')).toBe(false);
      expect(getUserActiveModel('demo-reviewer-1')).toBeUndefined();
    });

    it('20. AES-256-GCM encryption at rest encrypts and decrypts correctly', () => {
      const testKey = 'AIzaSyRealDeveloperSecretKey987654321';
      const encryptedData = encryptApiKey(testKey);
      expect(encryptedData.encrypted).not.toBe(testKey);
      expect(encryptedData.iv).toBeDefined();
      expect(encryptedData.authTag).toBeDefined();

      const decrypted = decryptApiKey(encryptedData.encrypted, encryptedData.iv, encryptedData.authTag);
      expect(decrypted).toBe(testKey);
    });

    it('21. Masked bullets are rejected and cannot overwrite saved key', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyOriginalSavedKey12345');

      const res = await request(app)
        .post('/api/ai-config/key')
        .set('x-demo-role', 'reviewer')
        .send({ apiKey: '••••••••••••••••••••••••••••••' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('masked placeholder');

      // Original key remains safe
      expect(getUserKey('demo-reviewer-1')).toBe('AIzaSyOriginalSavedKey12345');
    });

    it('22. Diagnostic endpoint runs model listing and minimal live generation test', async () => {
      setUserKey('demo-reviewer-1', 'AIzaSyDiagnosticTestKey123');

      const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.endsWith('/v1beta/models')) {
          return new Response(
            JSON.stringify({
              models: [
                {
                  name: 'models/gemini-3.8-flash',
                  displayName: 'Gemini 3.8 Flash',
                  supportedGenerationMethods: ['generateContent'],
                },
                {
                  name: 'models/gemini-3.6-flash',
                  displayName: 'Gemini 3.6 Flash',
                  supportedGenerationMethods: ['generateContent'],
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        } else if (urlStr.includes(':generateContent')) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: { parts: [{ text: 'pong' }], role: 'model' },
                  finishReason: 'STOP',
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response('Not found', { status: 404 });
      });

      try {
        const diagRes = await request(app)
          .get('/api/ai-config/diagnose')
          .set('x-demo-role', 'reviewer');

        expect(diagRes.status).toBe(200);
        expect(diagRes.body.success).toBe(true);
        expect(diagRes.body.totalModels).toBe(2);
        expect(diagRes.body.liveGenerationTest).toBeDefined();
        expect(diagRes.body.liveGenerationTest.generationSucceeded).toBe(true);
        expect(diagRes.body.liveGenerationTest.candidateId).toBe('gemini-3.8-flash');
        expect(diagRes.body.predefinedCandidates.find((m: any) => m.id === 'gemini-3.8-flash')?.accessible).toBe(true);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
