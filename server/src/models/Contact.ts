import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface IContact extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  account: Types.ObjectId;
  custom?: Record<string, any>;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    jobTitle: {
      type: String,
      default: '',
      trim: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
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
  },
  {
    timestamps: true,
  }
);

ContactSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });
ContactSchema.plugin(tenantPlugin);

export const Contact = mongoose.model<IContact>('Contact', ContactSchema);
