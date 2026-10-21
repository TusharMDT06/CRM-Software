import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type CallType = 'outbound' | 'inbound' | 'scheduled';
export type CallPurpose = 'discovery' | 'prospecting' | 'demo' | 'negotiation' | 'follow_up' | 'support' | 'administrative';
export type CallResult =
  | 'connected'
  | 'left_voicemail'
  | 'no_answer'
  | 'busy'
  | 'wrong_number'
  | 'callback_requested'
  | 'interested'
  | 'not_interested';

export interface ICall extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  subject: string;
  callType: CallType;
  callPurpose: CallPurpose;
  startTime: Date;
  durationSeconds: number; // in seconds
  callResult: CallResult;
  relatedTo: {
    entityType: 'deal' | 'account' | 'lead' | 'contact' | 'none';
    entityId?: Types.ObjectId;
    entityName?: string;
  };
  contactName?: string;
  phoneNumber?: string;
  owner: Types.ObjectId;
  notes?: string;
  followUpAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CallSchema = new Schema<ICall>(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ['outbound', 'inbound', 'scheduled'],
      default: 'outbound',
      index: true,
    },
    callPurpose: {
      type: String,
      enum: ['discovery', 'prospecting', 'demo', 'negotiation', 'follow_up', 'support', 'administrative'],
      default: 'follow_up',
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    callResult: {
      type: String,
      enum: [
        'connected',
        'left_voicemail',
        'no_answer',
        'busy',
        'wrong_number',
        'callback_requested',
        'interested',
        'not_interested',
      ],
      default: 'connected',
      index: true,
    },
    relatedTo: {
      entityType: {
        type: String,
        enum: ['deal', 'account', 'lead', 'contact', 'none'],
        default: 'none',
        index: true,
      },
      entityId: {
        type: Schema.Types.ObjectId,
        required: false,
        index: true,
      },
      entityName: {
        type: String,
        default: '',
      },
    },
    contactName: {
      type: String,
      default: '',
      trim: true,
    },
    phoneNumber: {
      type: String,
      default: '',
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    followUpAction: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

CallSchema.index({ tenantId: 1, startTime: -1 });
CallSchema.index({ tenantId: 1, callType: 1, startTime: -1 });
CallSchema.index({ subject: 'text', contactName: 'text', notes: 'text' });
CallSchema.plugin(tenantPlugin);

export const Call = mongoose.model<ICall>('Call', CallSchema);
