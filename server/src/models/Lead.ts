import mongoose, { Document, Schema, Types } from 'mongoose';

export type LeadSource = 'website' | 'referral' | 'social' | 'email' | 'event' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  notes: string;
  custom?: Record<string, any>;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['website', 'referral', 'social', 'email', 'event', 'other'],
      default: 'website',
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      default: 'new',
      required: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
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
  },
  {
    timestamps: true,
  }
);

LeadSchema.index({ name: 'text', company: 'text', email: 'text' });

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
