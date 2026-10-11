import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface ICannedResponse extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shortcut?: string;
  title: string;
  body: string;
  category?: string;
  shared: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CannedResponseSchema = new Schema<ICannedResponse>(
  {
    shortcut: {
      type: String,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    shared: {
      type: Boolean,
      default: true,
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

CannedResponseSchema.index({ tenantId: 1, title: 1 });
CannedResponseSchema.plugin(tenantPlugin);

export const CannedResponse = mongoose.model<ICannedResponse>('CannedResponse', CannedResponseSchema);
