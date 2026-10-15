import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { isRecentMutationId } from '../api/client.js';
import { EntityChangedPayload } from '../types/index.js';

function resolveSocketUrl(): string {
  const customSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (customSocketUrl) {
    return customSocketUrl.trim();
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    // Strip trailing /api or slash to get base server host
    const clean = apiUrl.trim().replace(/\/+$/, '');
    return clean.endsWith('/api') ? clean.slice(0, -4) : clean;
  }

  // Default to current browser origin (handled by Vite dev proxy or reverse proxy)
  return window.location.origin;
}

const ENTITY_QUERY_MAP: Record<string, string[][]> = {
  lead: [['leads'], ['lead'], ['dashboard-summary'], ['dashboard'], ['lead-sources']],
  contact: [['contacts'], ['contact'], ['dashboard-summary']],
  account: [['accounts'], ['account'], ['dashboard-summary']],
  deal: [['deals'], ['deal'], ['dashboard-summary'], ['reports'], ['reports-kpis']],
  task: [['tasks'], ['task'], ['dashboard-summary']],
  user: [['users'], ['users-list'], ['team']],
  leadSource: [['lead-sources'], ['marketing']],
  message: [['messages']],
  notification: [['notifications'], ['unread-count']],
};

export function useRealtime() {
  const { token, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { info, error: showError } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socketUrl = resolveSocketUrl();
    console.log('[Realtime] Connecting socket to', socketUrl);

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Realtime] Connected to Socket.IO room as', user.name, socket.id);
    });

    socket.on('reconnect', () => {
      console.log('[Realtime] Reconnected. Invalidating active queries...');
      queryClient.invalidateQueries({ type: 'active' });
    });

    socket.on('connect_error', (err) => {
      console.warn('[Realtime] Connection error:', err.message);
    });

    // 1. Entity Changed Event
    socket.on('entity:changed', (payload: EntityChangedPayload) => {
      // Ignore self-initiated mutations to prevent redundant refetches
      if (payload.clientMutationId && isRecentMutationId(payload.clientMutationId)) {
        return;
      }

      const entity = payload.entity;
      const targetQueryKeys = ENTITY_QUERY_MAP[entity] || [[`${entity}s`]];

      // Dispatch browser custom event for visual flash/highlights
      window.dispatchEvent(
        new CustomEvent('flowdesk:entity:changed', { detail: payload })
      );

      // Debounce query invalidation (250ms) per entity
      const existingTimer = debounceTimersRef.current.get(entity);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(entity);
        targetQueryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }, 250);

      debounceTimersRef.current.set(entity, timer);
    });

    // 2. Session Revoked Event
    socket.on('session:revoked', (payload: { reason?: string }) => {
      console.warn('[Realtime] Session revoked:', payload?.reason);
      showError('Your session has been terminated. Please log in again.');
      logout();
    });

    // 3. New Notification Event
    socket.on('notification:new', (payload: { notification?: any; title?: string; body?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });

      const title = payload.title || payload.notification?.title;
      const body = payload.body || payload.notification?.body;
      if (title) {
        info(`${title}${body ? `: ${body}` : ''}`);
      }
    });

    return () => {
      debounceTimersRef.current.forEach((t) => clearTimeout(t));
      debounceTimersRef.current.clear();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, user?._id, queryClient, logout, info, showError]);

  return {
    socket: socketRef.current,
    isConnected: Boolean(socketRef.current?.connected),
  };
}
