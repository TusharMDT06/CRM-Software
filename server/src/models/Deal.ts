import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type DealStage = 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface IDealRisk {
  level: 'low' | 'medium' | 'high';
  score: number; // 0-100 risk score
  reasons: string[];
  explanation?: string;
  evaluatedAt: Date;
}

export interface IDeal extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  title: string;
  account: Types.ObjectId;
  contact: Types.ObjectId;
  amount: number;
  stage: DealStage;
  expectedClose: Date;
  closedAt: Date | null;
  custom?: Record<string, any>;
  owner: Types.ObjectId;
  aiRisk?: IDealRisk;
  // Phase 5: Marketing & Attribution
  channel?: string;
  campaign?: {
    externalId?: string;
    name?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DealSchema = new Schema<IDeal>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    contact: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stage: {
      type: String,
      enum: ['qualified', 'proposal', 'negotiation', 'won', 'lost'],
      default: 'qualified',
      required: true,
      index: true,
    },
    expectedClose: {
      type: Date,
      required: true,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
      index: true,
    },
    custom: {
      type: Schema.Types.Mixed,
      default: {},
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    aiRisk: {
      level: { type: String, enum: ['low', 'medium', 'high'] },
      score: { type: Number, min: 0, max: 100 },
      reasons: { type: [String], default: [] },
      explanation: { type: String },
      evaluatedAt: { type: Date },
    },
    channel: {
      type: String,
      trim: true,
      index: true,
    },
    campaign: {
      externalId: { type: String, trim: true, index: true },
      name: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

DealSchema.index({ tenantId: 1, channel: 1 });
DealSchema.index({ tenantId: 1, 'campaign.externalId': 1 });

// Pre-save hook to ensure closedAt logic is always upheld
DealSchema.pre('save', function (next) {
  if (this.isModified('stage')) {
    if (this.stage === 'won' || this.stage === 'lost') {
      if (!this.closedAt) {
        this.closedAt = new Date();
      }
    } else {
      this.closedAt = null;
    }
  }
  next();
});

DealSchema.plugin(tenantPlugin);

export const Deal = mongoose.model<IDeal>('Deal', DealSchema);
