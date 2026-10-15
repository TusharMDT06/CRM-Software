import { z } from 'zod';
import { UserSummary } from './user.js';

export const leadRatingEnum = z.enum(['hot', 'warm', 'cold']);
export type LeadRating = z.infer<typeof leadRatingEnum>;

export const leadSourceEnum = z.enum([
  'website',
  'referral',
  'social',
  'email',
  'event',
  'other',
]);
export type LeadSource = z.infer<typeof leadSourceEnum>;

export const leadStatusEnum = z.enum([
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
]);
export type LeadStatus = z.infer<typeof leadStatusEnum>;

export const marketingChannelEnum = z.enum([
  'google_ads',
  'facebook',
  'instagram',
  'website_form',
  'whatsapp',
  'manual',
  'import',
  'api',
  'other',
]);
export type MarketingChannel = z.infer<typeof marketingChannelEnum>;

export const leadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  grade: leadRatingEnum,
  reasons: z.array(z.string()).default([]),
  explanation: z.string().optional(),
  scoredAt: z.string().or(z.date()),
});
export type LeadScore = z.infer<typeof leadScoreSchema>;

export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  company: z.string().trim().min(1, 'Company is required'),
  source: leadSourceEnum.default('website'),
  status: leadStatusEnum.default('new'),
  rating: leadRatingEnum.default('warm'),
  value: z.coerce.number().min(0, 'Value must be positive').default(0),
  notes: z.string().trim().optional().default(''),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
  channel: marketingChannelEnum.optional().default('manual'),
  campaign: z
    .object({
      externalId: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  adSet: z
    .object({
      externalId: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  ad: z
    .object({
      externalId: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  formName: z.string().optional(),
  utm: z
    .object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      term: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  clickIds: z
    .object({
      gclid: z.string().optional(),
      fbclid: z.string().optional(),
    })
    .optional(),
  landingPage: z.string().optional(),
  referrer: z.string().optional(),
  consent: z
    .object({
      given: z.boolean(),
      text: z.string().optional(),
      at: z.coerce.date().optional(),
      via: z.string().optional(),
    })
    .optional(),
  inquiryCount: z.coerce.number().optional().default(1),
  isTest: z.boolean().optional().default(false),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const leadUpdateSchema = leadSchema.partial().extend({
  updatedAt: z.string().or(z.date()).optional(),
  version: z.number().optional(),
});
export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export interface Lead {
  _id: string;
  tenantId?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  rating: LeadRating;
  value: number;
  notes: string;
  custom?: Record<string, any>;
  owner: UserSummary | string;
  aiScore?: LeadScore;
  channel?: MarketingChannel;
  campaign?: { externalId?: string; name?: string };
  adSet?: { externalId?: string; name?: string };
  ad?: { externalId?: string; name?: string };
  formName?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  clickIds?: { gclid?: string; fbclid?: string };
  landingPage?: string;
  referrer?: string;
  consent?: {
    given: boolean;
    text?: string;
    at?: string | Date;
    via?: string;
  };
  inquiryCount?: number;
  lastInquiryAt?: string | Date;
  firstContactAt?: string | Date | null;
  isTest?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}
