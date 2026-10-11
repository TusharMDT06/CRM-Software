import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type TicketMessageType = 'public_reply' | 'internal_note' | 'system';
export type TicketMessageChannel = 'manual' | 'portal' | 'email' | 'whatsapp';

export interface ITicketAttachment {
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface ITicketMessage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  ticket: Types.ObjectId;
  type: TicketMessageType;
  body: string;
  author?: Types.ObjectId;
  authorName?: string;
  authorEmail?: string;
  channel: TicketMessageChannel;
  attachments: ITicketAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketAttachmentSchema = new Schema<ITicketAttachment>(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number },
    mimeType: { type: String },
  },
  { _id: false }
);

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['public_reply', 'internal_note', 'system'],
      default: 'public_reply',
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    authorName: {
      type: String,
      trim: true,
    },
    authorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    channel: {
      type: String,
      enum: ['manual', 'portal', 'email', 'whatsapp'],
      default: 'manual',
    },
    attachments: {
      type: [TicketAttachmentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

TicketMessageSchema.index({ tenantId: 1, ticket: 1, createdAt: 1 });
TicketMessageSchema.plugin(tenantPlugin);

export const TicketMessage = mongoose.model<ITicketMessage>('TicketMessage', TicketMessageSchema);
