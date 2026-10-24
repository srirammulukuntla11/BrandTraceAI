import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config/env.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate, AuthenticatedRequest, DEMO_USERS } from '../middleware/auth.js';

const router = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(['creator', 'reviewer', 'admin']).optional(),
});

const SwitchDemoSchema = z.object({
  role: z.enum(['creator', 'reviewer', 'admin']),
});

// Demo login endpoint
router.post('/login', validateBody(LoginSchema), (req: Request, res: Response) => {
  const { email, role } = req.body;

  // Find demo account by email or role
  let user = Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user && role && DEMO_USERS[role]) {
    user = DEMO_USERS[role];
  }

  // If unknown, create a guest session with requested role or creator
  if (!user) {
    user = {
      id: `user-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role: role || 'creator',
    };
  }

  const token = (jwt.sign as any)(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    success: true,
    token,
    user,
  });
});

// Fast switch demo user endpoint for judge convenience
router.post('/demo-switch', validateBody(SwitchDemoSchema), (req: Request, res: Response) => {
  const { role } = req.body;
  const user = DEMO_USERS[role];

  const token = (jwt.sign as any)(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.json({
    success: true,
    token,
    user,
  });
});

// Get current user profile
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;
