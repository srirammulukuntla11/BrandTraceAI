import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import guidelinesRouter from './routes/guidelines.js';
import contentRouter from './routes/content.js';
import aiConfigRouter from './routes/aiConfig.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

// Configure CORS
const allowedOrigins = [
  config.frontendOrigin,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev, or can be restricted
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-demo-role'],
  })
);

// Body parsers with size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount API routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/guidelines', guidelinesRouter);
app.use('/api/content', contentRouter);
app.use('/api/ai-config', aiConfigRouter);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.url}`,
  });
});

// Centralized error handler
app.use(errorHandler);

export default app;
