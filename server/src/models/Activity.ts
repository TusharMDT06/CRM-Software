import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type ActivityType =
  | 'note'
  | 'call'
  | 'meeting'
  | 'email'
  | 'task'
  | 'stage_change'
  | 'ticket'
  | 'system';

export type CallOutcome = 'connected' | 'no_answer' | 'left_message';
export type EntityType = 'lead' | 'contact' | 'account' | 'deal' | 'ticket';

export interface IActivity extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  type: ActivityType;
  subject: string;
  body: string;
  entityType: EntityType;
  entityId: Types.ObjectId;
  createdBy: Types.ObjectId;
  occurredAt: Date;
  durationMins?: number;
  outcome?: CallOutcome;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    type: {
      type: String,
      enum: ['note', 'call', 'meeting', 'email', 'task', 'stage_change', 'ticket', 'system'],
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      default: '',
      trim: true,
    },
    entityType: {
      type: String,
      enum: ['lead', 'contact', 'account', 'deal', 'ticket'],
      required: true,
      index: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    durationMins: {
      type: Number,
      min: 0,
    },
    outcome: {
      type: String,
      enum: ['connected', 'no_answer', 'left_message'],
    },
    messageId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

ActivitySchema.index({ tenantId: 1, entityType: 1, entityId: 1, occurredAt: -1 });
ActivitySchema.plugin(tenantPlugin);

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
