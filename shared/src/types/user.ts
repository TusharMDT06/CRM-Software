import { z } from 'zod';

export const userRoleEnum = z.enum(['platform_admin', 'admin', 'manager', 'sales']);
export type UserRole = z.infer<typeof userRoleEnum>;

export const userSummarySchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string(),
  role: userRoleEnum,
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export const userSchema = z.object({
  _id: z.string(),
  tenantId: z.string().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  role: userRoleEnum.default('sales'),
  active: z.boolean().default(true),
  isVerified: z.boolean().optional().default(true),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});
export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  orgName: z.string().trim().min(2, 'Organization name must be at least 2 characters'),
  name: z.string().trim().min(2, 'Your name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const inviteUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'sales']).default('sales'),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(),
  role: userRoleEnum.optional(),
  active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
