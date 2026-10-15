import { apiClient } from './client';

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'status_change'
  | 'stage_change'
  | 'system';

export interface ActivityItem {
  _id: string;
  type: ActivityType;
  subject: string;
  body?: string;
  entityType: 'lead' | 'contact' | 'account' | 'deal';
  entityId: string;
  createdBy: {
    _id: string;
    name: string;
    email?: string;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CreateActivityInput {
  type: ActivityType;
  subject: string;
  body?: string;
  entityType: 'lead' | 'contact' | 'account' | 'deal';
  entityId: string;
}

export async function fetchActivities(
  entityType: string,
  entityId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ data: ActivityItem[]; meta: { total: number } }> {
  const res = await apiClient.get<{ data: ActivityItem[]; meta: { total: number } }>(
    `/activities?entityType=${entityType}&entityId=${entityId}&page=${page}&limit=${limit}`
  );
  return res.data;
}

export async function createActivity(
  input: CreateActivityInput
): Promise<ActivityItem> {
  const res = await apiClient.post<ActivityItem>('/activities', input);
  return res.data;
}
