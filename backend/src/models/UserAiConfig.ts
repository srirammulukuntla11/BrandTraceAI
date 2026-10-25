import mongoose, { Schema, Document } from 'mongoose';
import { ModelTestRecord } from '../services/userApiKeyService.js';

export interface UserAiConfigDocument extends Document {
  userId: string;
  encryptedApiKey?: string;
  iv?: string;
  authTag?: string;
  maskedKey?: string;
  hasApiKey: boolean;
  activeModel?: string | null;
  selectedModel: string;
  modelTestResults: Record<string, ModelTestRecord>;
  createdAt: Date;
  updatedAt: Date;
}

const UserAiConfigSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    encryptedApiKey: { type: String, default: '' },
    iv: { type: String, default: '' },
    authTag: { type: String, default: '' },
    maskedKey: { type: String, default: '' },
    hasApiKey: { type: Boolean, default: false },
    activeModel: { type: String, default: null },
    selectedModel: { type: String, default: 'gemini-3.8-flash' },
    modelTestResults: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

export const UserAiConfigModel = mongoose.model<UserAiConfigDocument>(
  'UserAiConfig',
  UserAiConfigSchema
);
