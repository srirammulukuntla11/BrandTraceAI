import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || '',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  jwtSecret: process.env.JWT_SECRET || 'brandtrace-dev-secret-key-2025-secure',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  maxDraftLength: 50000, // Maximum allowed characters for draft text (approx 10,000 words)
};
