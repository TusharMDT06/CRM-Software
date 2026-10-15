import { z } from 'zod';
import { Notification } from './notification.js';

export const realtimeEntityEnum = z.enum([
  'lead',
  'contact',
  'account',
  'deal',
  'task',
  'message',
  'user',
  'leadSource',
]);
export type RealtimeEntityType = z.infer<typeof realtimeEntityEnum>;

export const realtimeActionEnum = z.enum([
  'created',
  'updated',
  'deleted',
  'bulk',
]);
export type RealtimeActionType = z.infer<typeof realtimeActionEnum>;

export const entityChangedPayloadSchema = z.object({
  entity: realtimeEntityEnum,
  action: realtimeActionEnum,
  id: z.string().optional(),
  orgId: z.string(),
  actorId: z.string().optional(),
  clientMutationId: z.string().optional(),
  updatedAt: z.string().or(z.date()).optional(),
  data: z.any().optional(),
});
export type EntityChangedPayload = z.infer<typeof entityChangedPayloadSchema>;

export const sessionRevokedPayloadSchema = z.object({
  userId: z.string(),
  reason: z.string().optional(),
});
export type SessionRevokedPayload = z.infer<typeof sessionRevokedPayloadSchema>;

export const notificationNewPayloadSchema = z.object({
  notification: z.any(),
});
export type NotificationNewPayload = {
  notification: Notification;
};

export type RealtimeServerToClientEvents = {
  'entity:changed': (payload: EntityChangedPayload) => void;
  'session:revoked': (payload: SessionRevokedPayload) => void;
  'notification:new': (payload: NotificationNewPayload) => void;
};
