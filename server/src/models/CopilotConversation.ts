import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';

export interface IProposedAction {
  id: string;
  type: 'create_task' | 'change_deal_stage' | 'draft_email' | 'create_ticket';
  title: string;
  description: string;
  params: Record<string, any>;
  status: 'pending' | 'confirmed' | 'dismissed';
  executedResult?: any;
}

export interface ICopilotMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  proposedAction?: IProposedAction;
  toolCalls?: Array<{ name: string; args: Record<string, any> }>;
  toolResults?: Array<{ name: string; result: any }>;
  createdAt: Date;
}

export interface ICopilotConversation extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  entityType?: 'lead' | 'contact' | 'account' | 'deal' | 'ticket';
  entityId?: Types.ObjectId;
  messages: ICopilotMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ProposedActionSchema = new Schema<IProposedAction>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['create_task', 'change_deal_stage', 'draft_email', 'create_ticket'],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'dismissed'],
      default: 'pending',
    },
    executedResult: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const CopilotMessageSchema = new Schema<ICopilotMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ['user', 'model', 'system'], required: true },
    content: { type: String, required: true },
    proposedAction: { type: ProposedActionSchema },
    toolCalls: [{ type: Schema.Types.Mixed }],
    toolResults: [{ type: Schema.Types.Mixed }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CopilotConversationSchema = new Schema<ICopilotConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'New Conversation',
    },
    entityType: {
      type: String,
      enum: ['lead', 'contact', 'account', 'deal', 'ticket'],
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    messages: [CopilotMessageSchema],
  },
  {
    timestamps: true,
  }
);

CopilotConversationSchema.index({ tenantId: 1, userId: 1, updatedAt: -1 });

CopilotConversationSchema.plugin(tenantPlugin);

export const CopilotConversation = mongoose.model<ICopilotConversation>(
  'CopilotConversation',
  CopilotConversationSchema
);
