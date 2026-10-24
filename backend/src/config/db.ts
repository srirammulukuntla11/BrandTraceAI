import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;
let dbType: 'mongodb' | 'memory' = 'memory';

export async function connectDB(): Promise<void> {
  if (!config.mongodbUri) {
    console.log('[DB] No MONGODB_URI provided in environment. Running with resilient in-memory fallback store.');
    dbType = 'memory';
    isConnected = true;
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    dbType = 'mongodb';
    console.log('[DB] Successfully connected to MongoDB Atlas.');
  } catch (err: any) {
    console.warn(`[DB] Failed to connect to MongoDB Atlas (${err.message}). Falling back to in-memory store for continuous operation.`);
    dbType = 'memory';
    isConnected = true;
  }
}

export function getDbStatus(): {
  connected: boolean;
  type: 'mongodb' | 'memory';
  status: string;
} {
  return {
    connected: isConnected,
    type: dbType,
    status: isConnected ? (dbType === 'mongodb' ? 'Connected to MongoDB Atlas' : 'In-Memory Resilient Store (Demo Mode)') : 'Disconnected',
  };
}

export function isUsingMemoryStore(): boolean {
  return dbType === 'memory';
}
