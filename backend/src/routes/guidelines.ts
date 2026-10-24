import { Router, Response } from 'express';
import { z } from 'zod';
import {
  getAllGuidelines,
  getGuidelineById,
  createGuideline,
  updateGuideline,
  seedSampleGuidelines,
} from '../services/guidelineService.js';
import { authenticate, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const GuidelineInputSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  category: z.enum(['terminology', 'tone', 'messaging', 'approved_fact', 'disclaimer', 'other']),
  ruleDescription: z.string().min(5, 'Rule description must be at least 5 characters'),
  prohibitedTerms: z.array(z.string()).default([]),
  preferredTerm: z.string().optional().default(''),
  requiredTerms: z.array(z.string()).default([]),
  applicableContentTypes: z.array(z.string()).default(['all']),
  status: z.enum(['active', 'archived']).default('active'),
});

const GuidelineUpdateSchema = GuidelineInputSchema.partial();

// GET all guidelines (public to authenticated users/demo)
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const status = (req.query.status as string) || 'all';
    const guidelines = await getAllGuidelines(status);
    res.json({
      success: true,
      count: guidelines.length,
      guidelines,
    });
  } catch (err) {
    next(err);
  }
});

// GET single guideline
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const guideline = await getGuidelineById(req.params.id);
    if (!guideline) {
      res.status(404).json({ success: false, error: 'Guideline not found' });
      return;
    }
    res.json({ success: true, guideline });
  } catch (err) {
    next(err);
  }
});

// POST create guideline (Reviewer / Admin only)
router.post(
  '/',
  authenticate,
  requireRole('reviewer', 'admin'),
  validateBody(GuidelineInputSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const created = await createGuideline(req.body);
      res.status(201).json({
        success: true,
        message: 'Guideline created successfully',
        guideline: created,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH update guideline (Reviewer / Admin only)
router.patch(
  '/:id',
  authenticate,
  requireRole('reviewer', 'admin'),
  validateBody(GuidelineUpdateSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const updated = await updateGuideline(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Guideline not found' });
        return;
      }
      res.json({
        success: true,
        message: 'Guideline updated successfully',
        guideline: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST seed sample guidelines
router.post(
  '/seed',
  authenticate,
  requireRole('reviewer', 'admin'),
  async (_req: AuthenticatedRequest, res: Response, next) => {
    try {
      const guidelines = await seedSampleGuidelines(true);
      res.json({
        success: true,
        message: 'Sample guidelines seeded successfully',
        count: guidelines.length,
        guidelines,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
