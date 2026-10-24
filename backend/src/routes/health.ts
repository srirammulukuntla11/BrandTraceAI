import { Router, Request, Response } from 'express';
import { getDbStatus } from '../config/db.js';
import { config } from '../config/env.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const dbStatus = getDbStatus();

  // Return health status without exposing sensitive credentials or keys
  res.status(200).json({
    status: 'healthy',
    platform: 'BrandTrace AI',
    version: '1.0.0-round2',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.connected,
      mode: dbStatus.type,
      message: dbStatus.status,
    },
    ai: {
      mode: 'user_provided_keys_only',
      model: config.geminiModel,
    },
    environment: config.nodeEnv,
  });
});

export default router;
