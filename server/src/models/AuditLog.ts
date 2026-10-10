import mongoose, { Document, Schema, Types } from 'mongoose';

export type AuditSource = 'user' | 'system' | 'automation' | 'public_link';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'export'
  | 'import'
  | 'send'
  | 'approve'
  | 'reject'
  | 'payment_recorded'
  | 'role_changed'
  | 'settings_changed';

export type AuditEntityType =
  | 'lead'
  | 'contact'
  | 'account'
  | 'deal'
  | 'task'
  | 'product'
  | 'quote'
  | 'invoice'
  | 'payment'
  | 'workflow'
  | 'user'
  | 'custom_field'
  | 'company_settings'
  | 'auth';

export interface FieldChange {
  field: string;
  from: any;
  to: any;
}

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  actorName: string;
  source: AuditSource;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel: string;
  changes: FieldChange[];
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const FieldChangeSchema = new Schema<FieldChange>(
  {
    field: { type: String, required: true },
    from: { type: Schema.Types.Mixed },
    to: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorName: {
      type: String,
      default: 'System',
      trim: true,
    },
    source: {
      type: String,
      enum: ['user', 'system', 'automation', 'public_link'],
      default: 'user',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'create',
        'update',
        'delete',
        'login',
        'login_failed',
        'logout',
        'export',
        'import',
        'send',
        'approve',
        'reject',
        'payment_recorded',
        'role_changed',
        'settings_changed',
      ],
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      index: true,
    },
    entityLabel: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    changes: {
      type: [FieldChangeSchema],
      default: [],
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // append-only
  }
);

// High performance compound indexes specified in requirements
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
