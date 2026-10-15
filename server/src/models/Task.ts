import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantPlugin } from '../utils/tenantPlugin.js';
import { realtimePlugin } from '../utils/realtimePlugin.js';

export type TaskStatus = 'open' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskType = 'call' | 'email' | 'meeting' | 'document' | 'todo';

export interface ITask extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  deal?: Types.ObjectId | null;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'done'],
      default: 'open',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['call', 'email', 'meeting', 'document', 'todo'],
      default: 'todo',
      required: true,
      index: true,
    },
    deal: {
      type: Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

TaskSchema.index({ name: 'text', description: 'text' });
TaskSchema.plugin(tenantPlugin);
TaskSchema.plugin(realtimePlugin('task'));

export const Task = mongoose.model<ITask>('Task', TaskSchema);
