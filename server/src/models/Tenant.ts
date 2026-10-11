import mongoose, { Document, Schema, Types } from 'mongoose';

export type TenantPlan = 'free' | 'pro';
export type TenantStatus = 'active' | 'suspended';

export interface ITenantLimits {
  maxSeats: number;
  maxRecords: number;
  aiEnabled: boolean;
  aiMonthlyRequests: number;
}

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  status: TenantStatus;
  suspendedReason?: string;
  plan: TenantPlan;
  limits: ITenantLimits;
  settings: Record<string, any>;
  deletionRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PLAN_LIMITS: Record<TenantPlan, ITenantLimits> = {
  free: {
    maxSeats: 5,
    maxRecords: 1000,
    aiEnabled: false,
    aiMonthlyRequests: 50,
  },
  pro: {
    maxSeats: 50,
    maxRecords: 50000,
    aiEnabled: true,
    aiMonthlyRequests: 5000,
  },
};

const TenantLimitsSchema = new Schema<ITenantLimits>(
  {
    maxSeats: { type: Number, required: true, default: 5 },
    maxRecords: { type: Number, required: true, default: 1000 },
    aiEnabled: { type: Boolean, required: true, default: false },
    aiMonthlyRequests: { type: Number, required: true, default: 50 },
  },
  { _id: false }
);

const TenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
      index: true,
    },
    suspendedReason: {
      type: String,
      default: '',
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
      index: true,
    },
    limits: {
      type: TenantLimitsSchema,
      default: () => ({ ...DEFAULT_PLAN_LIMITS.free }),
    },
    settings: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    deletionRequestedAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Note: Tenant model is the root platform entity and is NOT scoped with tenantPlugin
export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
