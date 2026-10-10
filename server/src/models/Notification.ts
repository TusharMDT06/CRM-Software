import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType =
  | 'task_assigned'
  | 'task_due_today'
  | 'task_overdue'
  | 'deal_assigned'
  | 'deal_won'
  | 'deal_lost'
  | 'quote_viewed'
  | 'quote_accepted'
  | 'quote_declined'
  | 'quote_needs_approval'
  | 'quote_approved'
  | 'quote_rejected'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'workflow_disabled'
  | 'import_finished'
  | 'general';

export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId; // recipient
  type: NotificationType;
  title: string;
  body: string;
  link?: string; // in-app URL path
  entityType?: string;
  entityId?: string;
  readAt?: Date | null;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '',
    },
    entityType: {
      type: String,
      default: '',
    },
    entityId: {
      type: String,
      default: '',
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: false,
  }
);

// TTL index to automatically delete notifications after 90 days (7,776,000 seconds)
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
