import mongoose, { Schema, Document } from 'mongoose';
import { IGuideline } from '../types/index.js';

export interface GuidelineDocument extends Omit<IGuideline, '_id' | 'id'>, Document {}

const GuidelineSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['terminology', 'tone', 'messaging', 'approved_fact', 'disclaimer', 'other'],
      default: 'terminology',
    },
    ruleDescription: { type: String, required: true, trim: true },
    prohibitedTerms: { type: [String], default: [] },
    preferredTerm: { type: String, default: '' },
    requiredTerms: { type: [String], default: [] },
    applicableContentTypes: { type: [String], default: ['all'] },
    status: {
      type: String,
      required: true,
      enum: ['active', 'archived'],
      default: 'active',
    },
    isSample: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
  }
);

export const GuidelineModel = mongoose.model<GuidelineDocument>('Guideline', GuidelineSchema);
