import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
}

export interface ICompanySettings extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  legalName: string;
  address: string;
  state: string; // Used for Intra/Inter tax mode comparison
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string; // base64 data url or path (max 1MB)
  bankDetails: BankDetails;
  defaultPaymentTermsDays: number;
  defaultQuoteValidityDays: number;
  defaultTerms: string;
  quotePrefix: string;
  invoicePrefix: string;
  aiEnabled?: boolean;
  aiConsentConfirmedBy?: Types.ObjectId;
  aiConsentConfirmedAt?: Date;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BankDetailsSchema = new Schema<BankDetails>(
  {
    accountName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    bankName: { type: String, default: '' },
  },
  { _id: false }
);

const CompanySettingsSchema = new Schema<ICompanySettings>(
  {
    legalName: {
      type: String,
      required: true,
      default: 'Flowdesk Technologies Pvt Ltd',
      trim: true,
    },
    address: {
      type: String,
      default: 'Tower 4, Equinox Tech Park, Kurla West, Mumbai, Maharashtra 400070',
      trim: true,
    },
    state: {
      type: String,
      required: true,
      default: 'Maharashtra',
      trim: true,
    },
    gstin: {
      type: String,
      default: '27AABCF1234F1Z5',
      trim: true,
    },
    pan: {
      type: String,
      default: 'AABCF1234F',
      trim: true,
    },
    phone: {
      type: String,
      default: '+91 22 6123 4567',
      trim: true,
    },
    email: {
      type: String,
      default: 'billing@flowdesk.in',
      trim: true,
    },
    website: {
      type: String,
      default: 'https://flowdesk.in',
      trim: true,
    },
    logo: {
      type: String,
      default: '',
    },
    bankDetails: {
      type: BankDetailsSchema,
      default: () => ({
        accountName: 'Flowdesk Technologies Pvt Ltd',
        accountNumber: '921020045678901',
        ifsc: 'UTIB0000123',
        bankName: 'Axis Bank Ltd',
      }),
    },
    defaultPaymentTermsDays: {
      type: Number,
      default: 30,
      min: 0,
    },
    defaultQuoteValidityDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    defaultTerms: {
      type: String,
      default:
        '1. Payment is due within the agreed payment terms.\n2. Goods/services once delivered/rendered are not refundable.\n3. Late payments subject to interest @ 1.5% per month.\n4. Subject to local jurisdiction.',
    },
    quotePrefix: {
      type: String,
      default: 'QT',
      trim: true,
      uppercase: true,
    },
    invoicePrefix: {
      type: String,
      default: 'INV',
      trim: true,
      uppercase: true,
    },
    aiEnabled: {
      type: Boolean,
      default: false,
    },
    aiConsentConfirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    aiConsentConfirmedAt: {
      type: Date,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

CompanySettingsSchema.index({ tenantId: 1 }, { unique: true });
CompanySettingsSchema.plugin(tenantPlugin);

export const CompanySettings = mongoose.model<ICompanySettings>(
  'CompanySettings',
  CompanySettingsSchema
);

/**
 * Fetch singleton CompanySettings per tenant, auto-initializing if empty
 */
export async function getCompanySettings(): Promise<ICompanySettings> {
  let settings = await CompanySettings.findOne();
  if (!settings) {
    settings = await CompanySettings.create({});
  }
  return settings;
}
