import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Search potential .env locations (current cwd or backend dir)
const potentialEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const envPath of potentialEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  // NOTE: Platform-wide Gemini API key has been removed per security requirements. Only user-provided keys are accepted.
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  jwtSecret: process.env.JWT_SECRET || 'brandtrace-dev-secret-key-2025-secure',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  maxDraftLength: 50000,
};
