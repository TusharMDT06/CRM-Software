import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type LeadEventStatus = 'received' | 'processed' | 'duplicate' | 'ignored' | 'failed';

export interface ILeadEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  source: Types.ObjectId;
  providerLeadId?: string;
  status: LeadEventStatus;
  attempts: number;
  error?: string | null;
  rawPayload: Record<string, any>;
  lead?: Types.ObjectId | null;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeadEventSchema = new Schema<ILeadEvent>(
  {
    source: {
      type: Schema.Types.ObjectId,
      ref: 'LeadSource',
      required: true,
      index: true,
    },
    providerLeadId: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['received', 'processed', 'duplicate', 'ignored', 'failed'],
      default: 'received',
      required: true,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    error: {
      type: String,
      default: null,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      required: true,
      select: true, // Never log to stdout or logs
    },
    lead: {
      type: Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotent compound index on (source, providerLeadId)
LeadEventSchema.index(
  { source: 1, providerLeadId: 1 },
  { unique: true, sparse: true }
);

// High-speed querying for tenant event lists & debugging
LeadEventSchema.index({ tenantId: 1, createdAt: -1 });
LeadEventSchema.index({ tenantId: 1, status: 1 });

// Auto-delete raw inbound events after 30 days (compliance & storage optimization)
LeadEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 86400 });

LeadEventSchema.plugin(tenantPlugin);

export const LeadEvent = mongoose.model<ILeadEvent>('LeadEvent', LeadEventSchema);
