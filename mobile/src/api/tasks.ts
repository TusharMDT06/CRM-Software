import { apiClient } from './client';
import {
  Task,
  TaskInput,
  TaskUpdateInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface TaskListParams {
  cursor?: string;
  limit?: number;
  updatedSince?: string;
  search?: string;
  status?: string;
  priority?: string;
  type?: string;
  sort?: string;
}

export async function fetchTasks(
  params?: TaskListParams
): Promise<CursorPaginatedResponse<Task>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.updatedSince) query.append('updatedSince', params.updatedSince);
  if (params?.search) query.append('q', params.search);
  if (params?.status) query.append('status', params.status);
  if (params?.priority) query.append('priority', params.priority);
  if (params?.type) query.append('type', params.type);
  if (params?.sort) query.append('sort', params.sort);

  const res = await apiClient.get<CursorPaginatedResponse<Task>>(
    `/tasks?${query.toString()}`
  );
  return res.data;
}

export async function fetchTaskById(id: string): Promise<Task> {
  const res = await apiClient.get<Task>(`/tasks/${id}`);
  return res.data;
}

export async function createTask(data: TaskInput): Promise<Task> {
  const res = await apiClient.post<Task>('/tasks', data);
  return res.data;
}

export async function updateTask(
  id: string,
  data: Partial<TaskUpdateInput>
): Promise<Task> {
  const res = await apiClient.patch<Task>(`/tasks/${id}`, data);
  return res.data;
}

export async function toggleTaskStatus(
  id: string,
  currentStatus: 'open' | 'done'
): Promise<Task> {
  const newStatus = currentStatus === 'open' ? 'done' : 'open';
  const res = await apiClient.patch<Task>(`/tasks/${id}`, { status: newStatus });
  return res.data;
}

export async function deleteTask(id: string): Promise<{ id: string }> {
  const res = await apiClient.delete<{ id: string }>(`/tasks/${id}`);
  return res.data;
}
