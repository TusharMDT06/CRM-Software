import mongoose, { Document, Schema, Types } from 'mongoose';

export type WorkflowTriggerType =
  | 'lead_created'
  | 'deal_created'
  | 'deal_stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'task_overdue'
  | 'quote_accepted'
  | 'quote_declined'
  | 'invoice_overdue'
  | 'invoice_paid';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'is_empty';

export interface IWorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
}

export type WorkflowActionType =
  | 'create_task'
  | 'send_email'
  | 'send_notification'
  | 'update_field'
  | 'assign_owner';

export interface IWorkflowAction {
  type: WorkflowActionType;
  config: {
    // create_task
    taskTitle?: string;
    taskDueInDays?: number;
    taskAssignee?: 'owner' | string; // 'owner' or specific userId

    // send_email
    templateId?: string;
    recipientType?: 'lead' | 'contact' | 'owner' | 'custom';
    customEmail?: string;

    // send_notification
    notificationRecipient?: 'owner' | 'managers' | string; // userId
    notificationTitle?: string;
    notificationBody?: string;

    // update_field (whitelist: lead.status, deal.stage, owner)
    targetField?: 'lead.status' | 'deal.stage' | 'owner';
    targetValue?: string;

    // assign_owner
    salesUserIds?: string[];
  };
}

export interface IWorkflow extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  enabled: boolean;
  stopOnError: boolean;
  trigger: {
    type: WorkflowTriggerType;
    config?: {
      fromStage?: string;
      toStage?: string;
    };
  };
  conditions: IWorkflowCondition[];
  actions: IWorkflowAction[];
  roundRobinIndex?: number;
  lastRunAt?: Date;
  runCount: number;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    stopOnError: {
      type: Boolean,
      default: false,
    },
    trigger: {
      type: {
        type: String,
        required: true,
        index: true,
      },
      config: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    conditions: [
      {
        field: { type: String, required: true },
        operator: { type: String, required: true },
        value: { type: Schema.Types.Mixed },
      },
    ],
    actions: [
      {
        type: { type: String, required: true },
        config: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    roundRobinIndex: {
      type: Number,
      default: 0,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    runCount: {
      type: Number,
      default: 0,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Workflow = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
