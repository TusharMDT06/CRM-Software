import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const bootstrapSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'sales']),
  active: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'manager', 'sales']).optional(),
  active: z.boolean().optional(),
});

export const leadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().min(1, 'Phone is required'),
  company: z.string().trim().min(1, 'Company is required'),
  source: z.enum(['website', 'referral', 'social', 'email', 'event', 'other']).default('website'),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).default('new'),
  value: z.coerce.number().min(0, 'Value must be positive').default(0),
  notes: z.string().trim().optional().default(''),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
});

export const leadUpdateSchema = leadSchema.partial();

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

export const accountUpdateSchema = accountSchema.partial();

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

export const contactUpdateSchema = contactSchema.partial();

export const dealSchema = z.object({
  title: z.string().trim().min(1, 'Deal title is required'),
  account: z.string().min(1, 'Account is required'),
  contact: z.string().min(1, 'Contact is required'),
  amount: z.coerce.number().min(0, 'Amount must be positive').default(0),
  stage: z.enum(['qualified', 'proposal', 'negotiation', 'won', 'lost']).default('qualified'),
  expectedClose: z.string().or(z.date()),
  custom: z.record(z.any()).optional().default({}),
  owner: z.string().optional(),
});

export const dealUpdateSchema = dealSchema.partial();

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().optional().default(''),
  dueDate: z.string().or(z.date()),
  status: z.enum(['open', 'done']).default('open'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  deal: z.string().nullable().optional(),
  owner: z.string().optional(),
});

export const taskUpdateSchema = taskSchema.partial();

// Activity Schemas
export const createActivitySchema = z.object({
  type: z.enum(['note', 'call', 'meeting']),
  subject: z.string().trim().min(1, 'Subject is required'),
  body: z.string().trim().optional().default(''),
  entityType: z.enum(['lead', 'contact', 'account', 'deal']),
  entityId: z.string().min(1, 'Entity ID is required'),
  occurredAt: z.string().or(z.date()).optional(),
  durationMins: z.coerce.number().min(0).optional(),
  outcome: z.enum(['connected', 'no_answer', 'left_message']).optional(),
});

export const updateActivitySchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').optional(),
  body: z.string().trim().optional(),
  occurredAt: z.string().or(z.date()).optional(),
  durationMins: z.coerce.number().min(0).optional(),
  outcome: z.enum(['connected', 'no_answer', 'left_message']).optional(),
});

// EmailTemplate Schemas
export const emailTemplateSchema = z.object({
  name: z.string().trim().min(1, 'Template name is required'),
  subject: z.string().trim().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  category: z.enum(['follow_up', 'proposal', 'intro', 'thank_you', 'other']).default('follow_up'),
  shared: z.boolean().optional().default(false),
});

export const emailTemplateUpdateSchema = emailTemplateSchema.partial();

// Email Send Schema
export const sendEmailSchema = z.object({
  to: z.string().trim().email('Valid recipient email required'),
  subject: z.string().trim().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  entityType: z.enum(['lead', 'contact', 'account', 'deal']),
  entityId: z.string().min(1, 'Entity ID is required'),
  templateId: z.string().optional(),
});

// FieldDefinition Schemas
export const fieldDefinitionSchema = z.object({
  entity: z.enum(['lead', 'contact', 'account', 'deal']),
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .regex(/^[a-z0-9_]+$/, 'Key must be lowercase alphanumeric with underscores only'),
  label: z.string().trim().min(1, 'Label is required'),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox', 'url']),
  options: z.array(z.string()).optional().default([]),
  required: z.boolean().optional().default(false),
  order: z.coerce.number().optional().default(0),
  active: z.boolean().optional().default(true),
});

export const fieldDefinitionUpdateSchema = z.object({
  label: z.string().trim().min(1).optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  order: z.coerce.number().optional(),
  active: z.boolean().optional(),
});

// ================= PHASE 3 SCHEMAS =================

// Product Schemas
export const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  sku: z.string().trim().min(1, 'SKU is required').toUpperCase(),
  description: z.string().trim().optional().default(''),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'), // in paise
  taxRate: z.coerce.number().min(0).max(100).default(18),
  unit: z.enum(['nos', 'hours', 'days', 'months', 'kg', 'other']).default('nos'),
  active: z.boolean().optional().default(true),
  owner: z.string().optional(),
});

export const productUpdateSchema = productSchema.partial();

// CompanySettings Schema
export const companySettingsSchema = z.object({
  legalName: z.string().trim().min(1, 'Legal name is required'),
  address: z.string().trim().min(1, 'Address is required'),
  state: z.string().trim().min(1, 'State is required'),
  gstin: z.string().trim().optional().default(''),
  pan: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  email: z.string().trim().email('Valid email is required').optional().or(z.literal('')),
  website: z.string().trim().optional().default(''),
  logo: z.string().optional().default(''),
  bankDetails: z.object({
    accountName: z.string().trim().default(''),
    accountNumber: z.string().trim().default(''),
    ifsc: z.string().trim().default(''),
    bankName: z.string().trim().default(''),
  }).optional(),
  defaultPaymentTermsDays: z.coerce.number().min(0).default(30),
  defaultQuoteValidityDays: z.coerce.number().min(1).default(30),
  defaultTerms: z.string().optional().default(''),
  quotePrefix: z.string().trim().min(1).default('QT'),
  invoicePrefix: z.string().trim().min(1).default('INV'),
});

// Quote Line Item Schema
export const lineItemSchema = z.object({
  product: z.string().optional(),
  name: z.string().trim().min(1, 'Item name is required'),
  description: z.string().trim().optional().default(''),
  qty: z.coerce.number().min(1, 'Quantity must be at least 1').default(1),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'), // in paise
  discountPct: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(18),
});

// Quote Schemas
export const createQuoteSchema = z.object({
  deal: z.string().min(1, 'Deal reference is required'),
  account: z.string().min(1, 'Account reference is required'),
  contact: z.string().min(1, 'Contact reference is required'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  taxMode: z.enum(['intra', 'inter']).default('intra'),
  validUntil: z.string().or(z.date()),
  notes: z.string().optional().default(''),
  terms: z.string().optional().default(''),
  owner: z.string().optional(),
});

export const updateQuoteSchema = createQuoteSchema.partial();

export const quoteApprovalResponseSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional().default(''),
});

// Invoice Schemas
export const createInvoiceSchema = z.object({
  quote: z.string().optional(),
  deal: z.string().min(1, 'Deal reference is required'),
  account: z.string().min(1, 'Account reference is required'),
  contact: z.string().min(1, 'Contact reference is required'),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  taxMode: z.enum(['intra', 'inter']).default('intra'),
  issueDate: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().default(''),
  terms: z.string().optional().default(''),
  owner: z.string().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const voidInvoiceSchema = z.object({
  reason: z.string().trim().min(1, 'Void reason is required'),
});

// Payment Schema
export const createPaymentSchema = z.object({
  amount: z.coerce.number().min(1, 'Amount must be greater than zero'), // in paise
  method: z.enum(['bank_transfer', 'upi', 'card', 'cash', 'cheque', 'other']).default('bank_transfer'),
  reference: z.string().trim().optional().default(''),
  paidAt: z.string().or(z.date()).optional(),
  notes: z.string().trim().optional().default(''),
});

// Workflow Schemas
export const workflowConditionSchema = z.object({
  field: z.string().min(1, 'Field name is required'),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'is_empty']),
  value: z.any().optional(),
});

export const workflowActionSchema = z.object({
  type: z.enum(['create_task', 'send_email', 'send_notification', 'update_field', 'assign_owner']),
  config: z.record(z.any()),
});

export const workflowSchema = z.object({
  name: z.string().trim().min(1, 'Workflow name is required'),
  description: z.string().trim().optional().default(''),
  enabled: z.boolean().default(true),
  trigger: z.object({
    type: z.enum([
      'lead_created',
      'deal_created',
      'deal_stage_changed',
      'deal_won',
      'deal_lost',
      'task_overdue',
      'quote_accepted',
      'quote_declined',
      'invoice_overdue',
      'invoice_paid',
    ]),
    config: z.record(z.any()).optional().default({}),
  }),
  conditions: z.array(workflowConditionSchema).default([]),
  actions: z.array(workflowActionSchema).min(1, 'At least one action is required'),
  stopOnError: z.boolean().optional().default(false),
});

export const workflowUpdateSchema = workflowSchema.partial();

