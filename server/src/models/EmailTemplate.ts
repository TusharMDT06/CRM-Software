import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type TemplateCategory = 'follow_up' | 'proposal' | 'intro' | 'thank_you' | 'other';

export interface IEmailTemplate extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  shared: boolean;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const EmailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['follow_up', 'proposal', 'intro', 'thank_you', 'other'],
      default: 'follow_up',
      required: true,
      index: true,
    },
    shared: {
      type: Boolean,
      default: false,
      index: true,
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

EmailTemplateSchema.index({ name: 'text', subject: 'text' });
EmailTemplateSchema.plugin(tenantPlugin);

export const EmailTemplate = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);
