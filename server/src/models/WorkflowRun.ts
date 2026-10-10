import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWorkflowRunStep {
  action: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

export interface IWorkflowRun extends Document {
  workflow: Types.ObjectId;
  triggerEntity: {
    type: string;
    id: string;
  };
  status: 'success' | 'failed' | 'skipped';
  steps: IWorkflowRunStep[];
  startedAt: Date;
  finishedAt: Date;
  error?: string;
  createdAt: Date;
}

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    workflow: {
      type: Schema.Types.ObjectId,
      ref: 'Workflow',
      required: true,
      index: true,
    },
    triggerEntity: {
      type: {
        type: String,
        required: true,
      },
      id: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      required: true,
      index: true,
    },
    steps: [
      {
        action: { type: String, required: true },
        status: { type: String, enum: ['success', 'failed', 'skipped'], required: true },
        message: { type: String, default: '' },
      },
    ],
    startedAt: {
      type: Date,
      default: () => new Date(),
    },
    finishedAt: {
      type: Date,
      default: () => new Date(),
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

WorkflowRunSchema.index({ workflow: 1, createdAt: -1 });

export const WorkflowRun = mongoose.model<IWorkflowRun>('WorkflowRun', WorkflowRunSchema);
