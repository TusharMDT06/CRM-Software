import { apiClient } from './client';
import {
  Message,
  SendMessageInput,
  CursorPaginatedResponse,
} from '@flowdesk/shared';

export interface MessageListParams {
  cursor?: string;
  limit?: number;
  threadId?: string;
}

export async function fetchMessages(
  params?: MessageListParams
): Promise<CursorPaginatedResponse<Message>> {
  const query = new URLSearchParams();
  if (params?.cursor) query.append('cursor', params.cursor);
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.threadId) query.append('threadId', params.threadId);

  const res = await apiClient.get<CursorPaginatedResponse<Message>>(
    `/messages?${query.toString()}`
  );
  return res.data;
}

export async function fetchThreads(
  channel?: string
): Promise<{ threads: import('@flowdesk/shared').MessageThread[] }> {
  const url = channel ? `/messages/threads?channel=${channel}` : '/messages/threads';
  const res = await apiClient.get<{ threads: import('@flowdesk/shared').MessageThread[] }>(url);
  return res.data;
}

export async function fetchThreadMessages(
  threadId: string
): Promise<{ messages: Message[] }> {
  const res = await apiClient.get<{ messages: Message[] }>(`/messages/thread/${encodeURIComponent(threadId)}`);
  return res.data;
}

export type SendMessagePayload = {
  channel: 'sms' | 'email' | 'whatsapp';
  to: string;
  body: string;
  from?: string;
  subject?: string;
  threadId?: string;
  direction?: 'inbound' | 'outbound';
  status?: 'sent' | 'delivered' | 'failed' | 'received' | 'read';
  entityType?: 'lead' | 'contact' | 'deal' | 'account';
  entityId?: string;
};

export async function sendMessage(data: SendMessagePayload): Promise<Message> {
  const res = await apiClient.post<Message>('/messages', {
    direction: 'outbound',
    status: 'sent',
    from: 'Flowdesk CRM',
    ...data,
  });
  return res.data;
}

