import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketChannel = 'manual' | 'portal' | 'email' | 'whatsapp';

export interface ISlaBreachedFlags {
  firstResponse: boolean;
  resolution: boolean;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  number: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  contact?: Types.ObjectId;
  account?: Types.ObjectId;
  deal?: Types.ObjectId;
  assignee?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  tags: string[];
  firstResponseAt?: Date;
  resolvedAt?: Date;
  slaFirstResponseDue?: Date;
  slaResolutionDue?: Date;
  slaBreached: ISlaBreachedFlags;
  slaPendingPausedAt?: Date;
  slaPendingTotalPausedMs: number;
  publicToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['new', 'open', 'pending', 'resolved', 'closed'],
      default: 'new',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    channel: {
      type: String,
      enum: ['manual', 'portal', 'email', 'whatsapp'],
      default: 'manual',
      index: true,
    },
    contact: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      index: true,
    },
    deal: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      index: true,
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    tags: {
      type: [String],
      default: [],
    },
    firstResponseAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    slaFirstResponseDue: {
      type: Date,
      index: true,
    },
    slaResolutionDue: {
      type: Date,
      index: true,
    },
    slaBreached: {
      firstResponse: { type: Boolean, default: false },
      resolution: { type: Boolean, default: false },
    },
    slaPendingPausedAt: {
      type: Date,
    },
    slaPendingTotalPausedMs: {
      type: Number,
      default: 0,
    },
    publicToken: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for tenant isolation and uniqueness
TicketSchema.index({ tenantId: 1, number: 1 }, { unique: true });
TicketSchema.index({ tenantId: 1, status: 1, priority: 1 });
TicketSchema.index({ tenantId: 1, assignee: 1, status: 1 });
TicketSchema.index({ tenantId: 1, contact: 1 });
TicketSchema.index({ tenantId: 1, account: 1 });

TicketSchema.plugin(tenantPlugin);

export const Ticket = mongoose.model<ITicket>('Ticket', TicketSchema);
