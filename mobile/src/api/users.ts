import { apiClient } from './client';
import { User } from '@flowdesk/shared';

export async function fetchUsers(): Promise<User[]> {
  const res = await apiClient.get<User[]>('/users');
  return res.data;
}

export async function fetchMe(): Promise<{ user: User; tenant: any }> {
  const res = await apiClient.get<{ user: User; tenant: any }>('/auth/me');
  return res.data;
}

export async function registerPushDevice(
  expoPushToken: string,
  platform: 'ios' | 'android' | 'web' = 'android',
  appVersion: string = '1.0.0'
): Promise<any> {
  const res = await apiClient.post('/users/me/devices', {
    expoPushToken,
    platform,
    appVersion,
  });
  return res.data;
}

export async function inviteUser(data: {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'sales';
}): Promise<{ message: string; user: any; inviteToken?: string }> {
  const res = await apiClient.post('/users/invite', data);
  return res.data;
}

export async function updateUser(
  id: string,
  data: Partial<User> & { password?: string }
): Promise<User> {
  const res = await apiClient.patch(`/users/${id}`, data);
  return res.data;
}

