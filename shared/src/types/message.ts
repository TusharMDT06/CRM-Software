import { z } from 'zod';

export const messageChannelEnum = z.enum(['sms', 'email', 'whatsapp']);
export type MessageChannel = z.infer<typeof messageChannelEnum>;

export const messageDirectionEnum = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof messageDirectionEnum>;

export const messageStatusEnum = z.enum([
  'sent',
  'delivered',
  'failed',
  'received',
  'read',
]);
export type MessageStatus = z.infer<typeof messageStatusEnum>;

export const messageSchema = z.object({
  threadId: z.string().optional(),
  channel: messageChannelEnum,
  direction: messageDirectionEnum.default('outbound'),
  status: messageStatusEnum.default('sent'),
  from: z.string().trim().min(1, 'From address/number is required'),
  to: z.string().trim().min(1, 'To address/number is required'),
  subject: z.string().optional().default(''),
  body: z.string().min(1, 'Message body is required'),
  entityType: z.enum(['lead', 'contact', 'deal', 'account']).optional(),
  entityId: z.string().optional(),
});
export type MessageInput = z.infer<typeof messageSchema>;
export type SendMessageInput = MessageInput;

export interface Message {
  _id: string;
  tenantId?: string;
  threadId: string;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  from: string;
  to: string;
  subject?: string;
  body: string;
  entityType?: 'lead' | 'contact' | 'deal' | 'account';
  entityId?: string;
  readAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface MessageThread {
  threadId: string;
  participantName: string;
  participantContact: string; // phone or email
  channel: MessageChannel;
  lastMessage: Message;
  unreadCount: number;
}
