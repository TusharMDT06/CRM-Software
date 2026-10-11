import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface IRecordSummaryCache extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  entityType: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId: Types.ObjectId;
  recordUpdatedAt: Date;
  summary: string;
  keyFacts: string[];
  openIssues: string[];
  nextStep: string;
  cachedAt: Date;
}

const RecordSummaryCacheSchema = new Schema<IRecordSummaryCache>(
  {
    entityType: {
      type: String,
      enum: ['lead', 'contact', 'account', 'deal', 'ticket'],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recordUpdatedAt: {
      type: Date,
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    keyFacts: {
      type: [String],
      default: [],
    },
    openIssues: {
      type: [String],
      default: [],
    },
    nextStep: {
      type: String,
      required: true,
    },
    cachedAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 7, // 7 days TTL
    },
  },
  {
    timestamps: true,
  }
);

RecordSummaryCacheSchema.index({ tenantId: 1, entityType: 1, entityId: 1 }, { unique: true });

RecordSummaryCacheSchema.plugin(tenantPlugin);

export const RecordSummaryCache = mongoose.model<IRecordSummaryCache>(
  'RecordSummaryCache',
  RecordSummaryCacheSchema
);
