import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface IAiFeedback extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  feature: string; // 'copilot' | 'draft_email' | 'summarize' | 'nl_search' | 'explain_risk'
  rating: 'up' | 'down';
  notes?: string;
  promptPreview?: string;
  responsePreview?: string;
  createdAt: Date;
}

const AiFeedbackSchema = new Schema<IAiFeedback>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    feature: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: String,
      enum: ['up', 'down'],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    promptPreview: {
      type: String,
    },
    responsePreview: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AiFeedbackSchema.index({ tenantId: 1, createdAt: -1 });

AiFeedbackSchema.plugin(tenantPlugin);

export const AiFeedback = mongoose.model<IAiFeedback>('AiFeedback', AiFeedbackSchema);
