import { z } from 'zod';

export const leadSourcePlatformTypeEnum = z.enum([
  'meta_lead_ads',
  'google_ads',
  'website_form',
  'generic_webhook',
]);
export type LeadSourcePlatformType = z.infer<typeof leadSourcePlatformTypeEnum>;

export const leadSourceStatusEnum = z.enum(['active', 'paused', 'error']);
export type LeadSourceStatus = z.infer<typeof leadSourceStatusEnum>;

export const leadSourceCountersSchema = z.object({
  received: z.number().default(0),
  created: z.number().default(0),
  duplicates: z.number().default(0),
  failed: z.number().default(0),
});
export type LeadSourceCounters = z.infer<typeof leadSourceCountersSchema>;

export const leadSourceSchema = z.object({
  name: z.string().trim().min(1, 'Source name is required'),
  type: leadSourcePlatformTypeEnum,
  status: leadSourceStatusEnum.default('active'),
  config: z.record(z.any()).optional().default({}),
  routingRules: z.array(z.any()).optional().default([]),
});
export type LeadSourceInput = z.infer<typeof leadSourceSchema>;

export const leadSourceUpdateSchema = leadSourceSchema.partial();
export type LeadSourceUpdateInput = z.infer<typeof leadSourceUpdateSchema>;

export interface LeadSourceItem {
  _id: string;
  tenantId?: string;
  name: string;
  type: LeadSourcePlatformType;
  status: LeadSourceStatus;
  config: Record<string, any>;
  webhookId: string;
  routingRules: any[];
  counters: LeadSourceCounters;
  lastLeadAt: string | Date | null;
  lastError: string | null;
  createdBy: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}
export type LeadSourceRecord = LeadSourceItem;
