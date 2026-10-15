import { apiClient } from './client';

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type?: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export async function fetchNotifications(
  page: number = 1,
  limit: number = 20,
  unreadOnly: boolean = false
): Promise<NotificationListResponse> {
  const res = await apiClient.get<NotificationListResponse>(
    `/notifications?page=${page}&limit=${limit}&unread=${unreadOnly}`
  );
  return res.data;
}

export async function fetchUnreadCount(): Promise<{ unreadCount: number }> {
  const res = await apiClient.get<{ count: number; unreadCount: number }>('/notifications/unread-count');
  return { unreadCount: res.data.unreadCount ?? res.data.count ?? 0 };
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const res = await apiClient.patch<NotificationItem>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<{ message: string }> {
  const res = await apiClient.post<{ message: string }>('/notifications/read-all');
  return res.data;
}
