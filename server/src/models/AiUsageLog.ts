import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type AiFeatureType =
  | 'copilot'
  | 'draft_email'
  | 'summarize'
  | 'nl_search'
  | 'explain_risk'
  | 'scoring';

export interface IAiUsageLog extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  feature: AiFeatureType;
  modelName: string;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostPaise: number; // in integer paise (₹1 = 100 paise)
  createdAt: Date;
}

const AiUsageLogSchema = new Schema<IAiUsageLog>(
  {
    feature: {
      type: String,
      enum: ['copilot', 'draft_email', 'summarize', 'nl_search', 'explain_risk', 'scoring'],
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    tokensIn: {
      type: Number,
      required: true,
      default: 0,
    },
    tokensOut: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    latencyMs: {
      type: Number,
      required: true,
      default: 0,
    },
    estimatedCostPaise: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AiUsageLogSchema.index({ tenantId: 1, createdAt: -1 });
AiUsageLogSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
AiUsageLogSchema.index({ tenantId: 1, feature: 1, createdAt: -1 });

AiUsageLogSchema.plugin(tenantPlugin);

export const AiUsageLog = mongoose.model<IAiUsageLog>('AiUsageLog', AiUsageLogSchema);
