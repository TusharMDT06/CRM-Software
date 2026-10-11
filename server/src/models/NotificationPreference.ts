import mongoose, { Document, Schema, Types } from 'mongoose';
import { NotificationType } from './Notification.js';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface ITypePreference {
  inApp: boolean;
  email: boolean;
}

export interface INotificationPreference extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  user: Types.ObjectId;
  preferences: Record<string, ITypePreference>;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PREFERENCES: Record<NotificationType, ITypePreference> = {
  task_assigned: { inApp: true, email: false },
  task_due_today: { inApp: true, email: false },
  task_overdue: { inApp: true, email: false },
  deal_assigned: { inApp: true, email: false },
  deal_won: { inApp: true, email: false },
  deal_lost: { inApp: true, email: false },
  quote_viewed: { inApp: true, email: false },
  quote_accepted: { inApp: true, email: true },
  quote_declined: { inApp: true, email: false },
  quote_needs_approval: { inApp: true, email: false },
  quote_approved: { inApp: true, email: false },
  quote_rejected: { inApp: true, email: false },
  invoice_paid: { inApp: true, email: true },
  invoice_overdue: { inApp: true, email: true },
  workflow_disabled: { inApp: true, email: false },
  import_finished: { inApp: true, email: false },
  ticket_assigned: { inApp: true, email: true },
  ticket_sla_warning: { inApp: true, email: true },
  ticket_sla_breached: { inApp: true, email: true },
  deal_risk_high: { inApp: true, email: false },
  lead_assigned: { inApp: true, email: true },
  lead_repeat_inquiry: { inApp: true, email: true },
  general: { inApp: true, email: false },
};

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    preferences: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_PREFERENCES }),
    },
  },
  {
    timestamps: true,
  }
);

NotificationPreferenceSchema.index({ tenantId: 1, user: 1 }, { unique: true });
NotificationPreferenceSchema.plugin(tenantPlugin);

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
