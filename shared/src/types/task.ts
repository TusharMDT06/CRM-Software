import { z } from 'zod';

export const taskStatusEnum = z.enum(['open', 'done']);
export type TaskStatus = z.infer<typeof taskStatusEnum>;

export const taskPriorityEnum = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof taskPriorityEnum>;

export const taskTypeEnum = z.enum(['call', 'email', 'meeting', 'document', 'todo']);
export type TaskType = z.infer<typeof taskTypeEnum>;

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().optional().default(''),
  dueDate: z.string().or(z.date()),
  status: taskStatusEnum.default('open'),
  priority: taskPriorityEnum.default('medium'),
  type: taskTypeEnum.default('todo'),
  deal: z.string().nullable().optional(),
  owner: z.string().optional(),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const taskUpdateSchema = taskSchema.partial().extend({
  updatedAt: z.string().or(z.date()).optional(),
  version: z.number().optional(),
});
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export interface Task {
  _id: string;
  tenantId?: string;
  title: string;
  description: string;
  dueDate: string | Date;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  deal?: any | null;
  owner: any;
  createdAt: string | Date;
  updatedAt: string | Date;
}
