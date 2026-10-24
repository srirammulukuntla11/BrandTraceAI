import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  hasUserKey,
  getUserKey,
  setUserKey,
  deleteUserKey,
  testGeminiKey,
} from '../services/userApiKeyService.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const SaveKeySchema = z.object({
  apiKey: z
    .string()
    .min(10, 'API key must be at least 10 characters')
    .max(256, 'API key exceeds expected length'),
});

const TestKeySchema = z.object({
  apiKey: z.string().optional(),
});

// GET /api/ai-config - Get key configuration status for the requesting user
// Note: NEVER returns the API key itself
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  const isConfigured = hasUserKey(userId);

  res.json({
    success: true,
    configured: isConfigured,
    model: config.geminiModel,
    message: isConfigured
      ? 'Personal Gemini API key is configured and active for your session.'
      : 'No personal Gemini API key configured. Enter your key to enable AI tone and claims analysis.',
  });
});

// POST /api/ai-config - Save personal Gemini API key for the requesting user session
router.post(
  '/',
  authenticate,
  validateBody(SaveKeySchema),
  (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const { apiKey } = req.body;

    setUserKey(userId, apiKey);

    res.json({
      success: true,
      configured: true,
      message: 'Gemini API key saved in secure session memory for your account.',
    });
  }
);

// POST /api/ai-config/test - Test connection to Gemini API using provided or saved key
router.post(
  '/test',
  authenticate,
  validateBody(TestKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const keyToTest = (req.body.apiKey || '').trim() || getUserKey(userId);

    if (!keyToTest) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key provided or configured to test. Please enter a key.',
      });
      return;
    }

    const testResult = await testGeminiKey(keyToTest);

    if (!testResult.success) {
      res.status(400).json({
        success: false,
        error: testResult.message,
      });
      return;
    }

    res.json({
      success: true,
      model: testResult.model,
      message: testResult.message,
    });
  }
);

// DELETE /api/ai-config - Remove personal Gemini API key for the requesting user
router.delete('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  deleteUserKey(userId);

  res.json({
    success: true,
    configured: false,
    message: 'Gemini API key removed from your session.',
  });
});

export default router;
