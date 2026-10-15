import { z } from 'zod';

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required'),
  industry: z.string().trim().min(1, 'Industry is required'),
  website: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  city: z.string().trim().optional().default(''),
  employees: z.coerce.number().min(1).default(1),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
});
export type AccountInput = z.infer<typeof accountSchema>;

export const accountUpdateSchema = accountSchema.partial().extend({
  updatedAt: z.string().or(z.date()).optional(),
  version: z.number().optional(),
});
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

export interface Account {
  _id: string;
  tenantId?: string;
  name: string;
  industry: string;
  website: string;
  phone: string;
  city: string;
  employees: number;
  custom?: Record<string, any>;
  owner: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}
