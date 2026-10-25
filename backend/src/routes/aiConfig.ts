import { Router, Response } from 'express';
import { z } from 'zod';
import {
  hasUserKey,
  getUserKey,
  getUserMaskedKey,
  setUserKey,
  deleteUserKey,
  cleanApiKey,
  getUserActiveModel,
  setUserActiveModel,
  getUserSelectedModel,
  setUserSelectedModel,
  testIndividualModel,
  getAllUserModelTests,
  isModelTestPassed,
  ensureUserConfigLoaded,
  PREDEFINED_GEMINI_MODELS,
  PREDEFINED_MODEL_IDS,
  isValidPredefinedModel,
} from '../services/userApiKeyService.js';
import { listAvailableGeminiModels, executeGeminiGenerateContent } from '../services/geminiClient.js';
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

const TestModelSchema = z.object({
  model: z.string().min(1, 'Model identifier is required'),
  apiKey: z.string().optional(),
});

const ActivateModelSchema = z.object({
  model: z.string().min(1, 'Model identifier is required'),
  apiKey: z.string().optional(),
});

const UpdateModelSchema = z.object({
  selectedModel: z.string().min(1, 'Model selection is required'),
});

// GET /api/ai-config - Get key configuration status, active model, predefined models, and test records
// Note: NEVER returns the API key itself
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  await ensureUserConfigLoaded(userId);

  const isConfigured = hasUserKey(userId);
  const activeModel = isConfigured ? getUserActiveModel(userId) : null;
  const selectedModel = getUserSelectedModel(userId) || (activeModel || 'gemini-3.8-flash');
  const maskedKey = isConfigured ? getUserMaskedKey(userId) : null;
  const modelTestResults = getAllUserModelTests(userId);

  res.json({
    success: true,
    configured: isConfigured,
    hasApiKey: isConfigured,
    maskedKey: maskedKey || null,
    activeModel: activeModel || null,
    model: activeModel || null,
    selectedModel,
    predefinedModels: PREDEFINED_GEMINI_MODELS,
    availableModels: PREDEFINED_MODEL_IDS,
    modelTestResults,
    message: isConfigured
      ? activeModel
        ? `Personal Gemini API key is configured and active for your session using ${activeModel}.`
        : 'Personal Gemini API key is configured. Please test and activate a model to enable AI compliance analysis.'
      : 'No personal Gemini API key configured. Enter your key to test and activate an AI compliance engine.',
  });
});

// GET & POST /api/ai-config/models - Return the predefined model candidates immediately without external API call
router.get('/models', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    models: PREDEFINED_GEMINI_MODELS,
    count: PREDEFINED_GEMINI_MODELS.length,
    message: `Predefined Gemini model candidates loaded (${PREDEFINED_GEMINI_MODELS.length} models).`,
  });
});

router.post('/models', authenticate, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    models: PREDEFINED_GEMINI_MODELS,
    count: PREDEFINED_GEMINI_MODELS.length,
    message: `Predefined Gemini model candidates loaded (${PREDEFINED_GEMINI_MODELS.length} models).`,
  });
});

// POST /api/ai-config/key - Save personal Gemini API key to user session
router.post(
  '/key',
  authenticate,
  validateBody(SaveKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const cleanKey = cleanApiKey(req.body.apiKey);

    if (!cleanKey) {
      res.status(400).json({
        success: false,
        error: 'API key cannot be empty or a masked placeholder.',
      });
      return;
    }

    setUserKey(userId, cleanKey);
    if (req.body.selectedModel && isValidPredefinedModel(req.body.selectedModel)) {
      setUserSelectedModel(userId, req.body.selectedModel);
    }

    res.json({
      success: true,
      configured: true,
      hasApiKey: true,
      maskedKey: getUserMaskedKey(userId),
      activeModel: getUserActiveModel(userId) || null,
      message: 'Personal Gemini API key saved to your session securely. Select and test a model to activate.',
    });
  }
);

// POST /api/ai-config - Save personal Gemini API key (supports legacy payload or direct save)
router.post(
  '/',
  authenticate,
  validateBody(SaveKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    const cleanKey = cleanApiKey(req.body.apiKey);
    const requestedModel = req.body.selectedModel?.trim();

    if (!cleanKey) {
      res.status(400).json({
        success: false,
        error: 'API key cannot be empty or a masked placeholder.',
      });
      return;
    }

    // Save key to session and database
    setUserKey(userId, cleanKey);

    // If a valid model was requested, test it
    if (requestedModel && isValidPredefinedModel(requestedModel)) {
      setUserSelectedModel(userId, requestedModel);
      const testResult = await testIndividualModel(cleanKey, requestedModel, userId);
      if (testResult.status === 'passed') {
        setUserActiveModel(userId, requestedModel);
        res.json({
          success: true,
          configured: true,
          hasApiKey: true,
          maskedKey: getUserMaskedKey(userId),
          model: requestedModel,
          activeModel: requestedModel,
          selectedModel: requestedModel,
          test: testResult,
          modelTestResults: getAllUserModelTests(userId),
          message: `Gemini API key saved and model "${requestedModel}" activated successfully!`,
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          configured: true,
          hasApiKey: true,
          maskedKey: getUserMaskedKey(userId),
          error: testResult.message,
          test: testResult,
          retryDelay: testResult.retryDelay,
          modelTestResults: getAllUserModelTests(userId),
        });
        return;
      }
    }

    res.json({
      success: true,
      configured: true,
      hasApiKey: true,
      maskedKey: getUserMaskedKey(userId),
      activeModel: getUserActiveModel(userId) || null,
      message: 'Gemini API key saved to session. Test individual models to activate.',
    });
  }
);

// POST /api/ai-config/test - Test an individual model manually one at a time
router.post(
  '/test',
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    await ensureUserConfigLoaded(userId);

    const modelToTest = req.body?.model?.trim() || req.body?.selectedModel?.trim() || getUserSelectedModel(userId) || 'gemini-3.8-flash';
    const rawProvidedKey = req.body?.apiKey;
    let keyToTest: string | undefined;

    if (rawProvidedKey) {
      const clean = cleanApiKey(rawProvidedKey);
      if (!clean) {
        // If user submitted masked bullets from placeholder, fall back to saved key if configured
        if (hasUserKey(userId)) {
          keyToTest = getUserKey(userId);
        } else {
          res.status(400).json({
            success: false,
            error: 'Cannot test using a masked placeholder. Please enter a valid Gemini API key.',
          });
          return;
        }
      } else {
        keyToTest = clean;
        // Persist newly entered key to user session & durable storage
        setUserKey(userId, clean);
      }
    } else {
      keyToTest = getUserKey(userId);
    }

    if (!isValidPredefinedModel(modelToTest)) {
      res.status(400).json({
        success: false,
        error: `Model "${modelToTest}" is not in the predefined Gemini model list. Valid models: ${PREDEFINED_MODEL_IDS.join(', ')}`,
      });
      return;
    }

    if (!keyToTest) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key provided or configured to test. Please enter a key.',
      });
      return;
    }

    // Remember user's selection
    setUserSelectedModel(userId, modelToTest);

    // Test ONLY the requested model
    const testResult = await testIndividualModel(keyToTest, modelToTest, userId);

    if (testResult.status !== 'passed') {
      res.status(400).json({
        success: false,
        configured: hasUserKey(userId),
        hasApiKey: hasUserKey(userId),
        maskedKey: getUserMaskedKey(userId) || null,
        activeModel: getUserActiveModel(userId) || null,
        model: modelToTest,
        test: testResult,
        error: testResult.message,
        retryDelay: testResult.retryDelay,
        modelTestResults: getAllUserModelTests(userId),
      });
      return;
    }

    res.json({
      success: true,
      configured: hasUserKey(userId),
      hasApiKey: hasUserKey(userId),
      maskedKey: getUserMaskedKey(userId) || null,
      activeModel: getUserActiveModel(userId) || null,
      model: modelToTest,
      test: testResult,
      modelTestResults: getAllUserModelTests(userId),
      message: testResult.message,
    });
  }
);

// POST /api/ai-config/activate - Explicitly activate a successfully tested model
router.post(
  '/activate',
  authenticate,
  validateBody(ActivateModelSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    await ensureUserConfigLoaded(userId);

    const modelToActivate = req.body.model.trim();
    const rawProvidedKey = req.body.apiKey;
    if (rawProvidedKey) {
      const clean = cleanApiKey(rawProvidedKey);
      if (clean) {
        setUserKey(userId, clean);
      }
    }

    if (!isValidPredefinedModel(modelToActivate)) {
      res.status(400).json({
        success: false,
        error: `Model "${modelToActivate}" is not a valid predefined Gemini model.`,
      });
      return;
    }

    if (!hasUserKey(userId)) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key configured. Please enter and save an API key before activation.',
      });
      return;
    }

    // Strict validation: Model MUST have a passed test before activation
    if (!isModelTestPassed(userId, modelToActivate)) {
      res.status(400).json({
        success: false,
        error: `Cannot activate model "${modelToActivate}". The model must pass a real generation test before activation. Click "Test Model" first.`,
      });
      return;
    }

    // Persist active model in authoritative backend session and database
    setUserActiveModel(userId, modelToActivate);
    setUserSelectedModel(userId, modelToActivate);

    res.json({
      success: true,
      configured: true,
      hasApiKey: true,
      activeModel: modelToActivate,
      message: `Model "${modelToActivate}" activated successfully! All subsequent compliance checks will use this model.`,
      modelTestResults: getAllUserModelTests(userId),
    });
  }
);

// PATCH /api/ai-config/model - Backward-compatible model preference update / activation
router.patch(
  '/model',
  authenticate,
  validateBody(UpdateModelSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'anonymous';
    await ensureUserConfigLoaded(userId);
    const selectedModel = req.body.selectedModel.trim();
    const key = getUserKey(userId);

    if (!isValidPredefinedModel(selectedModel)) {
      res.status(400).json({
        success: false,
        error: `Model "${selectedModel}" is not in the predefined Gemini model list.`,
      });
      return;
    }

    if (!key) {
      res.status(400).json({
        success: false,
        error: 'No Gemini API key configured. Please enter your API key first.',
      });
      return;
    }

    // If not tested yet, test it
    if (!isModelTestPassed(userId, selectedModel)) {
      const testResult = await testIndividualModel(key, selectedModel, userId);
      if (testResult.status !== 'passed') {
        res.status(400).json({
          success: false,
          error: testResult.message,
          retryDelay: testResult.retryDelay,
          modelTestResults: getAllUserModelTests(userId),
        });
        return;
      }
    }

    // Activate model
    setUserActiveModel(userId, selectedModel);
    setUserSelectedModel(userId, selectedModel);

    res.json({
      success: true,
      selectedModel,
      activeModel: selectedModel,
      message: `Model "${selectedModel}" set as active compliance engine.`,
      modelTestResults: getAllUserModelTests(userId),
    });
  }
);

// GET /api/ai-config/diagnose - Internal diagnostic endpoint to inspect models accessible to configured key and test generation
router.get('/diagnose', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  await ensureUserConfigLoaded(userId);
  const key = getUserKey(userId);

  if (!key) {
    res.status(400).json({
      success: false,
      error: 'No Gemini API key configured to run diagnostics.',
    });
    return;
  }

  try {
    const models = await listAvailableGeminiModels(key);
    const contentModels = models.filter((m) =>
      m.supportedGenerationMethods.includes('generateContent')
    );

    // Find the first accessible predefined candidate
    const accessiblePredefined = PREDEFINED_GEMINI_MODELS.find((m) =>
      contentModels.some((cm) => cm.id === m.id)
    );

    const testCandidateId = accessiblePredefined ? accessiblePredefined.id : contentModels[0]?.id || 'gemini-3.8-flash';

    let liveGenerationTest: {
      candidateId: string;
      generationSucceeded: boolean;
      httpStatus: number;
      providerErrorCode?: string;
      message: string;
    };

    try {
      const genResult = await executeGeminiGenerateContent({
        apiKey: key,
        modelId: testCandidateId,
        prompt: 'ping',
        timeoutMs: 25000,
      });

      liveGenerationTest = {
        candidateId: testCandidateId,
        generationSucceeded: Boolean(genResult.text && genResult.text.trim().length > 0),
        httpStatus: 200,
        message: 'Live generation request succeeded with response text returned.',
      };
    } catch (genErr: any) {
      liveGenerationTest = {
        candidateId: testCandidateId,
        generationSucceeded: false,
        httpStatus: genErr.statusCode || 500,
        providerErrorCode: genErr.googleStatus || 'GENERATION_FAILED',
        message: genErr.message || 'Generation failed',
      };
    }

    res.json({
      success: true,
      totalModels: models.length,
      generateContentModelsCount: contentModels.length,
      liveGenerationTest,
      predefinedCandidates: PREDEFINED_GEMINI_MODELS.map((m) => ({
        ...m,
        accessible: contentModels.some((cm) => cm.id === m.id),
      })),
    });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Diagnostic call failed',
    });
  }
});

// DELETE /api/ai-config - Remove personal Gemini API key and model configurations
router.delete('/', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id || 'anonymous';
  deleteUserKey(userId);

  res.json({
    success: true,
    configured: false,
    hasApiKey: false,
    activeModel: null,
    message: 'Gemini API key, active model, and test results removed.',
  });
});

export default router;
