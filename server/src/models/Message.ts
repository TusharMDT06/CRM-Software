import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';
import { realtimePlugin } from '../utils/realtimePlugin.js';

export type MessageChannel = 'sms' | 'email' | 'whatsapp';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'sent' | 'delivered' | 'failed' | 'received' | 'read';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  threadId: string;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  from: string;
  to: string;
  subject?: string;
  body: string;
  entityType?: 'lead' | 'contact' | 'deal' | 'account';
  entityId?: string;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'email', 'whatsapp'],
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed', 'received', 'read'],
      default: 'sent',
      required: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: ['lead', 'contact', 'deal', 'account'],
      required: false,
      index: true,
    },
    entityId: {
      type: String,
      required: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

MessageSchema.index({ tenantId: 1, threadId: 1, createdAt: -1 });
MessageSchema.plugin(tenantPlugin);
MessageSchema.plugin(realtimePlugin('message'));

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
