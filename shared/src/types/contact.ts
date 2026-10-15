import { z } from 'zod';
import { UserSummary } from './user.js';

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().optional().default(''),
  jobTitle: z.string().trim().optional().default(''),
  account: z.string().min(1, 'Account reference is required'),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const contactUpdateSchema = contactSchema.partial().extend({
  updatedAt: z.string().or(z.date()).optional(),
  version: z.number().optional(),
});
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export interface Contact {
  _id: string;
  tenantId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  account: any;
  custom?: Record<string, any>;
  owner: UserSummary | string | any;
  createdAt: string | Date;
  updatedAt: string | Date;
}
