import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface ISlaPriorityTarget {
  firstResponseHours: number;
  resolutionHours: number;
}

export interface ISlaPolicy extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  operatingHours: 'business_hours' | '24x7';
  businessHoursStart: string; // e.g. "09:00"
  businessHoursEnd: string; // e.g. "18:00"
  timeZone: string; // e.g. "Asia/Kolkata"
  priorities: {
    low: ISlaPriorityTarget;
    medium: ISlaPriorityTarget;
    high: ISlaPriorityTarget;
    urgent: ISlaPriorityTarget;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_SLA_TARGETS = {
  low: { firstResponseHours: 24, resolutionHours: 72 },
  medium: { firstResponseHours: 8, resolutionHours: 24 },
  high: { firstResponseHours: 4, resolutionHours: 12 },
  urgent: { firstResponseHours: 1, resolutionHours: 4 },
};

const PriorityTargetSchema = new Schema<ISlaPriorityTarget>(
  {
    firstResponseHours: { type: Number, required: true },
    resolutionHours: { type: Number, required: true },
  },
  { _id: false }
);

const SlaPolicySchema = new Schema<ISlaPolicy>(
  {
    name: {
      type: String,
      default: 'Default SLA Policy',
      trim: true,
    },
    operatingHours: {
      type: String,
      enum: ['business_hours', '24x7'],
      default: '24x7',
    },
    businessHoursStart: {
      type: String,
      default: '09:00',
    },
    businessHoursEnd: {
      type: String,
      default: '18:00',
    },
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    priorities: {
      low: { type: PriorityTargetSchema, default: DEFAULT_SLA_TARGETS.low },
      medium: { type: PriorityTargetSchema, default: DEFAULT_SLA_TARGETS.medium },
      high: { type: PriorityTargetSchema, default: DEFAULT_SLA_TARGETS.high },
      urgent: { type: PriorityTargetSchema, default: DEFAULT_SLA_TARGETS.urgent },
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

SlaPolicySchema.index({ tenantId: 1, isDefault: 1 });
SlaPolicySchema.plugin(tenantPlugin);

export const SlaPolicy = mongoose.model<ISlaPolicy>('SlaPolicy', SlaPolicySchema);

export async function getOrCreateDefaultSlaPolicy(): Promise<ISlaPolicy> {
  let policy = await SlaPolicy.findOne();
  if (!policy) {
    policy = await SlaPolicy.create({
      name: 'Default SLA Policy',
      operatingHours: '24x7',
      timeZone: 'Asia/Kolkata',
      priorities: DEFAULT_SLA_TARGETS,
      isDefault: true,
    });
  }
  return policy;
}
