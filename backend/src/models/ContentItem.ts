import mongoose, { Schema, Document } from 'mongoose';
import { IContentItem } from '../types/index.js';

export interface ContentItemDocument extends Omit<IContentItem, '_id' | 'id'>, Document {}

const FindingSchema = new Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['Rule Violation', 'Potential Concern', 'Needs Verification'],
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    quotedText: { type: String, required: true },
    title: { type: String, required: true },
    explanation: { type: String, required: true },
    guidelineId: { type: String },
    guidelineTitle: { type: String },
    suggestedCorrection: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['open', 'accepted', 'rejected', 'resolved'],
      default: 'open',
    },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

const ReviewDecisionSchema = new Schema(
  {
    reviewerId: { type: String, required: true },
    reviewerName: { type: String, required: true },
    reviewerRole: { type: String, required: true },
    decision: {
      type: String,
      required: true,
      enum: ['approved', 'changes_required'],
    },
    notes: { type: String, default: '' },
    decidedAt: { type: String, required: true },
  },
  { _id: false }
);

const ContentVersionSchema = new Schema(
  {
    versionNumber: { type: Number, required: true },
    text: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'under_review', 'changes_required', 'approved'],
      default: 'under_review',
    },
    findings: { type: [FindingSchema], default: [] },
    reviewDecision: { type: ReviewDecisionSchema },
    aiStatus: {
      available: { type: Boolean, default: false },
      model: { type: String },
      message: { type: String },
    },
    submittedBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
    createdAt: { type: String, required: true },
  },
  { _id: false }
);

const ContentItemSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    contentType: { type: String, required: true, default: 'social_post' },
    currentVersion: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'under_review', 'changes_required', 'approved'],
      default: 'under_review',
    },
    versions: { type: [ContentVersionSchema], default: [] },
    createdBy: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },
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

export const ContentItemModel = mongoose.model<ContentItemDocument>('ContentItem', ContentItemSchema);
