import mongoose, { Document, Schema, Types } from 'mongoose';
import { TaxMode } from './Quote.js';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export interface IInvoiceLineItem {
  product?: Types.ObjectId;
  name: string;
  description?: string;
  qty: number;
  unitPrice: number; // in paise
  discountPct: number;
  taxRate: number;
  lineTotal: number; // in paise
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  number: string;
  status: InvoiceStatus;
  quote?: Types.ObjectId;
  deal: Types.ObjectId;
  account: Types.ObjectId;
  contact: Types.ObjectId;
  items: IInvoiceLineItem[];
  subtotal: number; // paise
  discountTotal: number; // paise
  taxTotal: number; // paise
  cgstTotal: number; // paise
  sgstTotal: number; // paise
  igstTotal: number; // paise
  total: number; // paise
  taxMode: TaxMode;
  issueDate: Date;
  dueDate: Date;
  paidTotal: number; // paise
  balance: number; // paise
  notes?: string;
  terms?: string;
  sentAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema<IInvoiceLineItem>(
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

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'],
      default: 'draft',
      required: true,
      index: true,
    },
    quote: {
      type: Schema.Types.ObjectId,
      ref: 'Quote',
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
      type: [InvoiceLineItemSchema],
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
    issueDate: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    terms: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
    },
    voidedAt: {
      type: Date,
    },
    voidReason: {
      type: String,
      default: '',
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

InvoiceSchema.index({ number: 'text', notes: 'text' });

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);
