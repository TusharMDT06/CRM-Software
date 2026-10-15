import { z } from 'zod';

export const dealStageEnum = z.enum([
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
]);
export type DealStage = z.infer<typeof dealStageEnum>;

export const dealRiskSchema = z.object({
  level: z.enum(['low', 'medium', 'high']),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  explanation: z.string().optional(),
  evaluatedAt: z.string().or(z.date()),
});
export type DealRisk = z.infer<typeof dealRiskSchema>;

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Deal title is required'),
  account: z.string().min(1, 'Account is required'),
  contact: z.string().min(1, 'Contact is required'),
  amount: z.coerce.number().min(0, 'Amount must be positive').default(0),
  stage: dealStageEnum.default('qualified'),
  expectedClose: z.string().or(z.date()),
  closedAt: z.string().or(z.date()).nullable().optional(),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
  channel: z.string().optional(),
  campaign: z
    .object({
      externalId: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});
export type DealInput = z.infer<typeof dealSchema>;

export const dealUpdateSchema = dealSchema.partial().extend({
  updatedAt: z.string().or(z.date()).optional(),
  version: z.number().optional(),
});
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

export interface Deal {
  _id: string;
  tenantId?: string;
  title: string;
  account: any;
  contact: any;
  amount: number;
  stage: DealStage;
  expectedClose: string | Date;
  closedAt: string | Date | null;
  custom?: Record<string, any>;
  owner: any;
  aiRisk?: DealRisk;
  channel?: string;
  campaign?: { externalId?: string; name?: string };
  createdAt: string | Date;
  updatedAt: string | Date;
}
