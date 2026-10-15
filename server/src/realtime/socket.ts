import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { runWithTenantContext, getTenantContext } from '../utils/tenantContext.js';
import { logger } from '../utils/logger.js';
import { EntityChangedPayload, RealtimeEntityType, RealtimeActionType } from '@flowdesk/shared';

let io: SocketIOServer | null = null;

interface AuthenticatedSocket extends Socket {
  data: {
    user: IUser;
    tenantId?: string;
  };
}

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // JWT Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization;

      if (!authHeader) {
        return next(new Error('Authentication error: Missing token'));
      }

      const token = String(authHeader).replace(/^Bearer\s+/i, '').trim();
      const secret = process.env.JWT_SECRET || 'flowdesk_super_secret_jwt_key_2026_crm';

      const decoded = jwt.verify(token, secret) as { userId: string };
      const user = await runWithTenantContext({ isBypassTenant: true }, async () => {
        return User.findById(decoded.userId);
      });

      if (!user || !user.active) {
        return next(new Error('Authentication error: Invalid or inactive user'));
      }

      socket.data = {
        user,
        tenantId: user.tenantId ? user.tenantId.toString() : undefined,
      };

      next();
    } catch (err: any) {
      logger.warn('[Socket.IO] Authentication handshake rejected:', err?.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const user = socket.data.user;
    const userId = user._id.toString();
    const orgId = socket.data.tenantId || 'global';

    // Join specific rooms
    socket.join(`user:${userId}`);
    if (orgId) {
      socket.join(`org:${orgId}`);
    }

    logger.info(`[Socket.IO] Client connected: user=${userId} (${user.email}) -> joined rooms org:${orgId}, user:${userId}`);

    socket.on('disconnect', (reason) => {
      logger.info(`[Socket.IO] Client disconnected: user=${userId} (reason: ${reason})`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export interface EmitChangeParams {
  entity: RealtimeEntityType;
  action: RealtimeActionType;
  id?: string;
  orgId?: string;
  actorId?: string;
  clientMutationId?: string;
  updatedAt?: Date | string;
  data?: any;
}

/**
 * Emits an `entity:changed` event to the organization room.
 * Echoes clientMutationId so the originating client can suppress unnecessary refetches.
 */
export function emitChange(params: EmitChangeParams): void {
  if (!io) {
    return;
  }

  // Attempt to fill missing context from AsyncLocalStorage
  const ctx = getTenantContext();
  const orgId = params.orgId || ctx?.tenantId;
  const actorId = params.actorId || ctx?.user?._id?.toString();
  const clientMutationId = params.clientMutationId || ctx?.clientMutationId;

  if (!orgId) {
    logger.debug('[Realtime] Cannot emitChange without orgId:', params);
    return;
  }

  const payload: EntityChangedPayload = {
    entity: params.entity,
    action: params.action,
    id: params.id,
    orgId,
    actorId,
    clientMutationId,
    updatedAt: params.updatedAt instanceof Date ? params.updatedAt.toISOString() : params.updatedAt || new Date().toISOString(),
    data: params.data,
  };

  io.to(`org:${orgId}`).emit('entity:changed', payload);
  logger.info(`[Realtime] Emitted entity:changed -> org:${orgId}`, {
    entity: payload.entity,
    action: payload.action,
    id: payload.id,
    actorId: payload.actorId,
    clientMutationId: payload.clientMutationId,
  });
}

/**
 * Emits a `session:revoked` event to a user's private room.
 */
export function emitSessionRevoked(userId: string, reason = 'Session revoked by administrator'): void {
  if (!io) return;
  io.to(`user:${userId}`).emit('session:revoked', { userId, reason });
  logger.info(`[Realtime] Emitted session:revoked -> user:${userId}`);
}

/**
 * Emits a `notification:new` event to a user's private room.
 */
export function emitNotificationNew(userId: string, notification: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:new', { notification });
  logger.info(`[Realtime] Emitted notification:new -> user:${userId}`);
}
