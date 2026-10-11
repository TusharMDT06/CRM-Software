import mongoose, { Document, Schema, Types } from 'mongoose';
import crypto from 'crypto';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired';

export type TaxMode = 'intra' | 'inter';

export interface IQuoteLineItem {
  product?: Types.ObjectId;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number; // in paise
  discountPct: number; // e.g. 10 for 10%
  taxRate: number; // e.g. 18 for 18%
  lineTotal: number; // in paise
}

export interface IQuoteApproval {
  required: boolean;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt?: Date;
  respondedBy?: Types.ObjectId;
  respondedAt?: Date;
  reason?: string;
}

export interface IQuote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  number: string;
  status: QuoteStatus;
  deal: Types.ObjectId;
  account: Types.ObjectId;
  contact: Types.ObjectId;
  items: IQuoteLineItem[];
  subtotal: number; // paise
  discountTotal: number; // paise
  taxTotal: number; // paise
  cgstTotal: number; // paise
  sgstTotal: number; // paise
  igstTotal: number; // paise
  total: number; // paise
  taxMode: TaxMode;
  validUntil: Date;
  notes?: string;
  terms?: string;
  publicToken: string; // 32 bytes hex
  approval?: IQuoteApproval;
  sentAt?: Date;
  viewedAt?: Date;
  respondedAt?: Date;
  responseReason?: string;
  invoiceCreated?: Types.ObjectId; // ref to generated invoice if converted
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuoteLineItemSchema = new Schema<IQuoteLineItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0, // in paise
    },
    discountPct: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxRate: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    lineTotal: {
      type: Number,
      required: true,
      default: 0, // in paise
    },
  },
  { _id: false }
);

const QuoteApprovalSchema = new Schema<IQuoteApproval>(
  {
    required: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    requestedAt: { type: Date },
    respondedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: { type: Date },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const QuoteSchema = new Schema<IQuote>(
  {
    number: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'sent', 'viewed', 'accepted', 'declined', 'expired'],
      default: 'draft',
      required: true,
      index: true,
    },
    deal: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true,
    },
    account: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    contact: {
      type: Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true,
    },
    items: {
      type: [QuoteLineItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discountTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    taxTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    cgstTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    sgstTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    igstTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    taxMode: {
      type: String,
      enum: ['intra', 'inter'],
      default: 'intra',
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    publicToken: {
      type: String,
      required: true,
      unique: true,
      default: () => crypto.randomBytes(32).toString('hex'),
      index: true,
    },
    approval: {
      type: QuoteApprovalSchema,
    },
    sentAt: {
      type: Date,
    },
    viewedAt: {
      type: Date,
    },
    respondedAt: {
      type: Date,
    },
    responseReason: {
      type: String,
      default: '',
    },
    invoiceCreated: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
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

QuoteSchema.index({ tenantId: 1, number: 1 }, { unique: true });
QuoteSchema.index({ number: 'text', notes: 'text' });
QuoteSchema.plugin(tenantPlugin);

export const Quote = mongoose.model<IQuote>('Quote', QuoteSchema);
