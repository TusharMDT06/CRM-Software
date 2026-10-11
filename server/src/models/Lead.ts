import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export type LeadSource = 'website' | 'referral' | 'social' | 'email' | 'event' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type MarketingChannel =
  | 'google_ads'
  | 'facebook'
  | 'instagram'
  | 'website_form'
  | 'whatsapp'
  | 'manual'
  | 'import'
  | 'api'
  | 'other';

export interface ICampaignRef {
  externalId?: string;
  name?: string;
}

export interface IUtmParameters {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface IClickIds {
  gclid?: string;
  fbclid?: string;
}

export interface ILeadConsent {
  given: boolean;
  text?: string;
  at?: Date;
  via?: string;
}

export interface ILeadScore {
  score: number;
  grade: 'hot' | 'warm' | 'cold';
  reasons: string[];
  explanation?: string;
  scoredAt: Date;
}

export interface ILead extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  notes: string;
  custom?: Record<string, any>;
  owner: Types.ObjectId;
  aiScore?: ILeadScore;
  // Phase 5: Marketing & Attribution Additions
  channel: MarketingChannel;
  campaign?: ICampaignRef;
  adSet?: ICampaignRef;
  ad?: ICampaignRef;
  formName?: string;
  utm?: IUtmParameters;
  clickIds?: IClickIds;
  landingPage?: string;
  referrer?: string;
  consent?: ILeadConsent;
  inquiryCount: number;
  lastInquiryAt: Date;
  firstContactAt?: Date | null;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['website', 'referral', 'social', 'email', 'event', 'other'],
      default: 'website',
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
      default: 'new',
      required: true,
      index: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: '',
    },
    custom: {
      type: Schema.Types.Mixed,
      default: {},
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    aiScore: {
      score: { type: Number, min: 0, max: 100 },
      grade: { type: String, enum: ['hot', 'warm', 'cold'] },
      reasons: { type: [String], default: [] },
      explanation: { type: String },
      scoredAt: { type: Date },
    },
    // Phase 5: Marketing & Attribution fields
    channel: {
      type: String,
      enum: [
        'google_ads',
        'facebook',
        'instagram',
        'website_form',
        'whatsapp',
        'manual',
        'import',
        'api',
        'other',
      ],
      default: 'manual',
      required: true,
      index: true,
    },
    campaign: {
      externalId: { type: String, trim: true, index: true },
      name: { type: String, trim: true },
    },
    adSet: {
      externalId: { type: String, trim: true },
      name: { type: String, trim: true },
    },
    ad: {
      externalId: { type: String, trim: true },
      name: { type: String, trim: true },
    },
    formName: {
      type: String,
      trim: true,
    },
    utm: {
      source: { type: String, trim: true },
      medium: { type: String, trim: true },
      campaign: { type: String, trim: true },
      term: { type: String, trim: true },
      content: { type: String, trim: true },
    },
    clickIds: {
      gclid: { type: String, trim: true },
      fbclid: { type: String, trim: true },
    },
    landingPage: {
      type: String,
      trim: true,
    },
    referrer: {
      type: String,
      trim: true,
    },
    consent: {
      given: { type: Boolean, default: false },
      text: { type: String, trim: true },
      at: { type: Date },
      via: { type: String, trim: true },
    },
    inquiryCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastInquiryAt: {
      type: Date,
      default: () => new Date(),
    },
    firstContactAt: {
      type: Date,
      default: null,
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

LeadSchema.index({ name: 'text', company: 'text', email: 'text' });
LeadSchema.index({ tenantId: 1, email: 1 });
LeadSchema.index({ tenantId: 1, phone: 1 });
LeadSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });
LeadSchema.index({ tenantId: 1, isTest: 1 });
LeadSchema.plugin(tenantPlugin);

export const Lead = mongoose.model<ILead>('Lead', LeadSchema);
