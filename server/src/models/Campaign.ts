import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

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

export interface ICampaign extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  channel: MarketingChannel;
  externalId: string;
  name: string;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
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
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    firstSeenAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  }
);

CampaignSchema.index({ tenantId: 1, channel: 1, externalId: 1 }, { unique: true });
CampaignSchema.index({ tenantId: 1, name: 1 });
CampaignSchema.plugin(tenantPlugin);

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);
