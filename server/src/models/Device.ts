import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface IDevice extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  user: Types.ObjectId;
  expoPushToken: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expoPushToken: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      default: 'android',
      required: true,
    },
    appVersion: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

DeviceSchema.index({ tenantId: 1, user: 1, expoPushToken: 1 }, { unique: true });
DeviceSchema.plugin(tenantPlugin);

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);
