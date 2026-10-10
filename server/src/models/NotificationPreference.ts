import mongoose, { Document, Schema, Types } from 'mongoose';
import { NotificationType } from './Notification.js';

export interface ITypePreference {
  inApp: boolean;
  email: boolean;
}

export interface INotificationPreference extends Document {
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
  general: { inApp: true, email: false },
};

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
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

export const NotificationPreference = mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
