import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../config/env.js';
import {
  submitContentDraft,
  submitRevision,
  recordReviewDecision,
  updateFindingStatus,
  getAllContentItems,
  getContentItemById,
} from '../services/contentService.js';
import { getAllGuidelines } from '../services/guidelineService.js';
import { runDeterministicChecks } from '../services/deterministicChecker.js';
import { runGeminiAnalysis } from '../services/geminiService.js';
import { getUserKey } from '../services/userApiKeyService.js';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const DraftSubmissionSchema = z.object({
  title: z.string().optional(),
  contentType: z.string().min(1, 'Content type is required'),
  text: z
    .string()
    .min(1, 'Draft content cannot be empty')
    .max(config.maxDraftLength, `Draft exceeds maximum allowed length (${config.maxDraftLength} characters)`),
});

const RevisionSubmissionSchema = z.object({
  text: z
    .string()
    .min(1, 'Revision content cannot be empty')
    .max(config.maxDraftLength, `Revision exceeds maximum allowed length (${config.maxDraftLength} characters)`),
});

const ReviewDecisionSchema = z.object({
  versionNumber: z.number().int().positive(),
  decision: z.enum(['approved', 'changes_required']),
  notes: z.string().optional(),
});

const FindingStatusSchema = z.object({
  versionNumber: z.number().int().positive(),
  status: z.enum(['accepted', 'rejected', 'open']),
});

// GET all content items
router.get('/', authenticate, async (_req: AuthenticatedRequest, res: Response, next) => {
  try {
    const items = await getAllContentItems();
    res.json({
      success: true,
      count: items.length,
      items,
    });
  } catch (err) {
    next(err);
  }
});

// POST dry-run check without creating item
router.post('/check', authenticate, validateBody(DraftSubmissionSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { text, contentType } = req.body;
    const guidelines = await getAllGuidelines('active');

    // Retrieve the requesting user's own API key (never a platform fallback)
    const userApiKey = req.user ? getUserKey(req.user.id) : undefined;

    const ruleFindings = runDeterministicChecks(text, guidelines, contentType);
    const geminiResult = await runGeminiAnalysis(text, guidelines, contentType, userApiKey);

    res.json({
      success: true,
      findings: [...ruleFindings, ...geminiResult.findings],
      aiStatus: {
        available: geminiResult.available,
        model: geminiResult.model,
        message: geminiResult.message,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST submit new draft
router.post('/', authenticate, validateBody(DraftSubmissionSchema), async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const user = req.user || { id: 'anonymous', name: 'Anonymous', role: 'creator' };
    const userApiKey = req.user ? getUserKey(req.user.id) : undefined;

    const item = await submitContentDraft({
      title: req.body.title,
      contentType: req.body.contentType,
      text: req.body.text,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      userApiKey,
    });

    res.status(201).json({
      success: true,
      message: 'Draft submitted successfully',
      item,
    });
  } catch (err) {
    next(err);
  }
});

// GET single content item by ID
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const item = await getContentItemById(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Content item not found' });
      return;
    }
    res.json({ success: true, item });
  } catch (err) {
    next(err);
  }
});

// POST submit revision version for an item
router.post(
  '/:id/versions',
  authenticate,
  validateBody(RevisionSubmissionSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const user = req.user || { id: 'anonymous', name: 'Anonymous', role: 'creator' };
      const userApiKey = req.user ? getUserKey(req.user.id) : undefined;

      const updated = await submitRevision({
        contentId: req.params.id,
        text: req.body.text,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        userApiKey,
      });

      if (!updated) {
        res.status(404).json({ success: false, error: 'Content item not found' });
        return;
      }

      res.status(201).json({
        success: true,
        message: `Version ${updated.currentVersion} created successfully`,
        item: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST human reviewer decision (Reviewer / Admin ONLY)
router.post(
  '/:id/decision',
  authenticate,
  requireRole('reviewer', 'admin'),
  validateBody(ReviewDecisionSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const user = req.user!;
      const { versionNumber, decision, notes } = req.body;

      const updated = await recordReviewDecision(
        req.params.id,
        versionNumber,
        decision,
        {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        notes
      );

      if (!updated) {
        res.status(404).json({ success: false, error: 'Content item or version not found' });
        return;
      }

      res.json({
        success: true,
        message: `Review decision recorded: ${decision}`,
        item: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH accept/reject suggestion on finding (Reviewer / Admin ONLY)
router.patch(
  '/:id/findings/:findingId',
  authenticate,
  requireRole('reviewer', 'admin'),
  validateBody(FindingStatusSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { versionNumber, status } = req.body;
      const updated = await updateFindingStatus(
        req.params.id,
        versionNumber,
        req.params.findingId,
        status
      );

      if (!updated) {
        res.status(404).json({ success: false, error: 'Content item, version, or finding not found' });
        return;
      }

      res.json({
        success: true,
        message: `Finding status updated to '${status}'`,
        item: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
