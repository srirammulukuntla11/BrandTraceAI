import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  hasUserKey,
  getUserKey,
  setUserKey,
  deleteUserKey,
  testGeminiKey,
  cleanApiKey,
  getUserVerifiedModel,
  setUserVerifiedModel,
  getUserModelPreference,
  setUserModelPreference,
  getUserAvailableModels,
  setUserAvailableModels,
  getAvailableGeminiModels,
} from '../services/userApiKeyService.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const SaveKeySchema = z.object({
  apiKey: z
    .string()
    .min(10, 'API key must be at least 10 characters')
    .max(256, 'API key exceeds expected length'),
  selectedModel: z.string().optional(),
});

const TestKeySchema = z.object({
  apiKey: z.string().optional(),
  selectedModel: z.string().optional(),
});

const UpdateModelSchema = z.object({
  selectedModel: z.string().min(1, 'Model selection is required'),
});

// GET /api/ai-config - Get key configuration status and model selection for the requesting user
// Note: NEVER returns the API key itself
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  const isConfigured = hasUserKey(userId);
  const activeModel = getUserVerifiedModel(userId) || config.geminiModel;
  const selectedModel = getUserModelPreference(userId);
  let availableModels = getUserAvailableModels(userId);
  let modelsError: string | undefined = undefined;
  let retryDelay: string | undefined = undefined;

  // If user is configured but availableModels is empty in cache, attempt fetch
  if (isConfigured && (!availableModels || availableModels.length === 0)) {
    const key = getUserKey(userId);
    if (key) {
      try {
        availableModels = await getAvailableGeminiModels(key);
        setUserAvailableModels(userId, availableModels);
      } catch (err: any) {
        modelsError = err.message || 'Failed to list Gemini models';
        retryDelay = err.retryDelay;
      }
    }
  }

  res.json({
    success: true,
    configured: isConfigured,
    model: activeModel,
    selectedModel,
    activeModel,
    availableModels: availableModels || [],
    modelsError,
    retryDelay,
    message: isConfigured
      ? `Personal Gemini API key is configured and active for your session using ${activeModel}.`
      : 'No personal Gemini API key configured. Enter your key to enable AI tone and claims analysis.',
  });
});

// Handler for fetching available models (supports GET and POST with optional apiKey body/query)
const handleModelsDiscovery = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  const providedKey = req.body?.apiKey || (typeof req.query?.apiKey === 'string' ? req.query.apiKey : undefined);
  const cleanProvidedKey = providedKey ? cleanApiKey(providedKey) : undefined;
  const keyToUse = cleanProvidedKey || getUserKey(userId);

  if (!keyToUse) {
    res.status(400).json({
      success: false,
      error: 'No personal Gemini API key configured or provided. Please enter an API key.',
      models: getUserAvailableModels(userId) || [],
    });
    return;
  }

  try {
    const models = await getAvailableGeminiModels(keyToUse);
    // If discovered with user's session key, cache in user store
    if (!cleanProvidedKey || cleanProvidedKey === getUserKey(userId)) {
      setUserAvailableModels(userId, models);
    }

    res.json({
      success: true,
      models,
      count: models.length,
      message: `Retrieved ${models.length} Gemini models supporting text generation.`,
    });
  } catch (err: any) {
    const safeMsg = err.message || 'Failed to list Gemini models';
    const cachedModels = getUserAvailableModels(userId) || [];
    res.status(400).json({
      success: false,
      error: safeMsg,
      retryDelay: err.retryDelay,
      models: cachedModels,
    });
  }
};

// GET & POST /api/ai-config/models - Refresh available models for user's configured key or provided key
router.get('/models', authenticate, handleModelsDiscovery);
router.post('/models', authenticate, handleModelsDiscovery);

// POST /api/ai-config - Save personal Gemini API key for the requesting user session
// Note: Verifies real text-generation capability BEFORE declaring key active (Feature A.4)
router.post(
  '/',
  authenticate,
  validateBody(SaveKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const cleanKey = cleanApiKey(req.body.apiKey);
    const requestedModel = req.body.selectedModel?.trim() || 'auto';

    if (!cleanKey) {
      res.status(400).json({
        success: false,
        error: 'API key cannot be empty.',
      });
      return;
    }

    // Verify key works with actual Google text generation before saving
    const testResult = await testGeminiKey(cleanKey, requestedModel);
    if (!testResult.success) {
      res.status(400).json({
        success: false,
        error: testResult.message,
        retryDelay: testResult.retryDelay,
      });
      return;
    }

    // Key is verified working, store in session
    setUserKey(userId, cleanKey);
    setUserModelPreference(userId, requestedModel);
    setUserVerifiedModel(userId, testResult.model);
    if (testResult.availableModels) {
      setUserAvailableModels(userId, testResult.availableModels);
    }

    res.json({
      success: true,
      configured: true,
      model: testResult.model,
      selectedModel: requestedModel,
      activeModel: testResult.model,
      availableModels: testResult.availableModels || [],
      message: `Gemini API key verified and activated successfully using ${testResult.model}!`,
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
    const providedKey = req.body.apiKey ? cleanApiKey(req.body.apiKey) : undefined;
    const keyToTest = providedKey || getUserKey(userId);
    const requestedModel = req.body.selectedModel?.trim() || getUserModelPreference(userId) || 'auto';

    if (!keyToTest) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key provided or configured to test. Please enter a key.',
      });
      return;
    }

    const testResult = await testGeminiKey(keyToTest, requestedModel);

    if (!testResult.success) {
      res.status(400).json({
        success: false,
        error: testResult.message,
        retryDelay: testResult.retryDelay,
        availableModels: testResult.availableModels,
      });
      return;
    }

    // If key was verified, record working model
    setUserVerifiedModel(userId, testResult.model);
    if (testResult.availableModels) {
      setUserAvailableModels(userId, testResult.availableModels);
    }

    res.json({
      success: true,
      model: testResult.model,
      selectedModel: requestedModel,
      availableModels: testResult.availableModels,
      message: testResult.message,
    });
  }
);

// PATCH /api/ai-config/model - Update model preference and test with 1 minimal ping
router.patch(
  '/model',
  authenticate,
  validateBody(UpdateModelSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const key = getUserKey(userId);
    const selectedModel = req.body.selectedModel.trim();

    if (!key) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key configured. Please enter and activate your API key first.',
      });
      return;
    }

    // Test the selected model with one ping request
    const testResult = await testGeminiKey(key, selectedModel);
    if (!testResult.success) {
      res.status(400).json({
        success: false,
        error: testResult.message,
        retryDelay: testResult.retryDelay,
      });
      return;
    }

    // Save preference and verified model
    setUserModelPreference(userId, selectedModel);
    setUserVerifiedModel(userId, testResult.model);
    if (testResult.availableModels) {
      setUserAvailableModels(userId, testResult.availableModels);
    }

    res.json({
      success: true,
      selectedModel,
      activeModel: testResult.model,
      message: `Model preference set to "${selectedModel}". Verified operational via test ping.`,
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
    message: 'Gemini API key and model preferences removed from your session.',
  });
});

export default router;
