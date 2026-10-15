import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'task_assigned',
  'task_due_today',
  'task_overdue',
  'deal_assigned',
  'deal_won',
  'deal_lost',
  'quote_viewed',
  'quote_accepted',
  'quote_declined',
  'quote_needs_approval',
  'quote_approved',
  'quote_rejected',
  'invoice_paid',
  'invoice_overdue',
  'workflow_disabled',
  'import_finished',
  'ticket_assigned',
  'ticket_sla_warning',
  'ticket_sla_breached',
  'deal_risk_high',
  'lead_assigned',
  'lead_repeat_inquiry',
  'general',
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export interface Notification {
  _id: string;
  tenantId?: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  readAt?: string | Date | null;
  createdAt: string | Date;
}

export interface TypePreference {
  inApp: boolean;
  email: boolean;
}

export interface NotificationPreference {
  _id?: string;
  tenantId?: string;
  user: string;
  preferences: Record<string, TypePreference>;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
