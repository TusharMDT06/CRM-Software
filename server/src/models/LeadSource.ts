import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';
import { generateUnguessableId } from '../utils/cryptoHelper.js';

export type LeadSourcePlatformType =
  | 'meta_lead_ads'
  | 'google_ads'
  | 'website_form'
  | 'generic_webhook';

export type LeadSourceStatus = 'active' | 'paused' | 'error';

export interface ILeadSourceCounters {
  received: number;
  created: number;
  duplicates: number;
  failed: number;
}

export interface ILeadSource extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  type: LeadSourcePlatformType;
  status: LeadSourceStatus;
  config: Record<string, any>;
  webhookId: string;
  routingRules: any[];
  counters: ILeadSourceCounters;
  lastLeadAt: Date | null;
  lastError: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CountersSchema = new Schema<ILeadSourceCounters>(
  {
    received: { type: Number, default: 0, min: 0 },
    created: { type: Number, default: 0, min: 0 },
    duplicates: { type: Number, default: 0, min: 0 },
    failed: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const LeadSourceSchema = new Schema<ILeadSource>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['meta_lead_ads', 'google_ads', 'website_form', 'generic_webhook'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'error'],
      default: 'active',
      required: true,
      index: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    webhookId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => generateUnguessableId('src'),
    },
    routingRules: [{ type: Schema.Types.Mixed }],
    counters: {
      type: CountersSchema,
      default: () => ({ received: 0, created: 0, duplicates: 0, failed: 0 }),
    },
    lastLeadAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

LeadSourceSchema.index({ tenantId: 1, type: 1 });
LeadSourceSchema.plugin(tenantPlugin);

export const LeadSource = mongoose.model<ILeadSource>('LeadSource', LeadSourceSchema);
