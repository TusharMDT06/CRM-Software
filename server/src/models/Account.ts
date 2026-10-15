import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';
import { realtimePlugin } from '../utils/realtimePlugin.js';

export interface IAccount extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  industry: string;
  website: string;
  phone: string;
  city: string;
  employees: number;
  custom?: Record<string, any>;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    industry: {
      type: String,
      required: true,
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    employees: {
      type: Number,
      default: 1,
      min: 1,
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

AccountSchema.index({ name: 'text', industry: 'text', city: 'text' });
AccountSchema.plugin(tenantPlugin);
AccountSchema.plugin(realtimePlugin('account'));

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
