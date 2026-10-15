import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSessionStore } from '../auth/sessionStore';
import { initSocket, disconnectSocket } from './socket';
import { isRecentMutationId } from '../api/client';
import { useHighlightStore } from './highlightStore';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import { fetchMe } from '../api/users';
import { clearAuthTokens } from '../auth/secureStorage';
import { showToast } from '../components/Toast';
import { EntityChangedPayload } from '@flowdesk/shared';

const ENTITY_INVALIDATION_MAP: Record<string, (readonly unknown[])[]> = {
  lead: [queryKeys.leads.all, queryKeys.dashboard.all, queryKeys.leadSources.all],
  deal: [queryKeys.deals.all, queryKeys.dashboard.all, queryKeys.reports.all],
  task: [queryKeys.tasks.all, queryKeys.dashboard.all],
  contact: [queryKeys.contacts.all, queryKeys.dashboard.all],
  account: [queryKeys.accounts.all, queryKeys.dashboard.all],
  message: [queryKeys.messages.all],
  user: [queryKeys.users.all],
  leadSource: [queryKeys.leadSources.all],
  notification: [queryKeys.notifications.all],
};

export function useRealtimeSync() {
  const token = useSessionStore((state) => state.token);
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);
  const clearSession = useSessionStore((state) => state.clearSession);
  const triggerHighlight = useHighlightStore((state) => state.triggerHighlight);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!token || !user) {
      disconnectSocket();
      return;
    }

    const socket = initSocket(token);

    // 1. Invalidation on Socket Reconnect
    socket.on('reconnect', () => {
      console.log('[Realtime] Socket reconnected: invalidating active queries...');
      queryClient.invalidateQueries({ type: 'active' });
    });

    // 2. Entity Change Event
    socket.on('entity:changed', (payload: EntityChangedPayload) => {
      // Ignore self-initiated mutation echoes
      if (payload.clientMutationId && isRecentMutationId(payload.clientMutationId)) {
        return;
      }

      // Trigger 1.2s visual flash highlight on changed record
      if (payload.id) {
        triggerHighlight(payload.id, 1200);
      }

      // If current user was updated (e.g. role/permissions changed on web), refresh /auth/me immediately
      if (payload.entity === 'user' && payload.id === user._id) {
        fetchMe()
          .then(({ user: freshUser }) => {
            if (freshUser) {
              setUser(freshUser);
              showToast(`Account updated: Role is now ${freshUser.role}`, { type: 'info' });
            }
          })
          .catch((err) => console.warn('[Realtime] Failed to refresh /auth/me after user change:', err));
      }

      const entity = payload.entity;
      const targetQueryKeys = ENTITY_INVALIDATION_MAP[entity] || [[entity]];

      // Debounce query invalidations (250 ms)
      const existingTimer = debounceTimers.current.get(entity);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        debounceTimers.current.delete(entity);
        targetQueryKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key as any });
        });
      }, 250);

      debounceTimers.current.set(entity, timer);
    });

    // 3. Session Revoked Event (instant logout)
    socket.on('session:revoked', async (payload: { reason?: string }) => {
      console.warn('[Realtime] Session revoked by server:', payload?.reason);
      disconnectSocket();
      await clearAuthTokens();
      clearSession();
      showToast(payload?.reason || 'Session revoked by administrator. Please sign in again.', {
        type: 'error',
      });
    });

    // 4. New Notification Event
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    });

    // 5. Refetch on App Foreground (AppState)
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[Realtime] App brought to foreground: refreshing active queries...');
        queryClient.invalidateQueries({ type: 'active' });
      }
      appStateRef.current = nextAppState;
    });

    // 6. Refetch on Network Reconnect (NetInfo)
    const netInfoUnsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        queryClient.invalidateQueries({ type: 'active' });
      }
    });

    return () => {
      debounceTimers.current.forEach((t) => clearTimeout(t));
      debounceTimers.current.clear();
      appStateSub.remove();
      netInfoUnsub();
      disconnectSocket();
    };
  }, [token, user?._id, clearSession, triggerHighlight]);
}
