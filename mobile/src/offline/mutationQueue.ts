import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { apiClient } from '../api/client';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import { showToast } from '../components/Toast';

const STORAGE_KEY = 'flowdesk_offline_mutation_queue_v1';

export type MutationType =
  | 'COMPLETE_TASK'
  | 'ADD_NOTE'
  | 'UPDATE_LEAD'
  | 'MOVE_DEAL_STAGE'
  | 'CREATE_TASK';

export interface QueuedMutation {
  id: string; // Internal unique ID
  clientMutationId: string; // Header X-Client-Mutation-Id
  type: MutationType;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: any;
  createdAt: number;
  retryCount: number;
  entityType?: 'lead' | 'deal' | 'contact' | 'account' | 'task';
  entityId?: string;
  description?: string;
}

interface OfflineQueueState {
  queue: QueuedMutation[];
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  setQueue: (queue: QueuedMutation[]) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncedAt: (timestamp: number) => void;
  setLastError: (error: string | null) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  queue: [],
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null,
  setQueue: (queue) => set({ queue }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setLastError: (lastError) => set({ lastError }),
}));

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Load queued mutations from AsyncStorage
 */
export async function loadOfflineQueue(): Promise<QueuedMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const queue = Array.isArray(parsed) ? parsed : [];
    useOfflineQueueStore.getState().setQueue(queue);
    return queue;
  } catch (err) {
    console.warn('[OfflineQueue] Failed to load queue:', err);
    return [];
  }
}

/**
 * Persist queued mutations to AsyncStorage
 */
async function saveOfflineQueue(queue: QueuedMutation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    useOfflineQueueStore.getState().setQueue(queue);
  } catch (err) {
    console.warn('[OfflineQueue] Failed to save queue:', err);
  }
}

/**
 * Enqueue a mutation for background sync
 */
export async function enqueueOfflineMutation(params: {
  type: MutationType;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: any;
  clientMutationId?: string;
  entityType?: 'lead' | 'deal' | 'contact' | 'account' | 'task';
  entityId?: string;
  description?: string;
}): Promise<QueuedMutation> {
  const currentQueue = await loadOfflineQueue();
  const mutation: QueuedMutation = {
    id: generateUUID(),
    clientMutationId: params.clientMutationId || generateUUID(),
    type: params.type,
    endpoint: params.endpoint,
    method: params.method,
    payload: params.payload,
    createdAt: Date.now(),
    retryCount: 0,
    entityType: params.entityType,
    entityId: params.entityId,
    description: params.description,
  };

  const newQueue = [...currentQueue, mutation];
  await saveOfflineQueue(newQueue);
  showToast(params.description ? `${params.description} (queued offline)` : 'Saved offline. Will sync on reconnect.', {
    type: 'info',
  });

  return mutation;
}

/**
 * Replays all queued mutations sequentially in FIFO order.
 */
export async function processOfflineQueue(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  const store = useOfflineQueueStore.getState();
  if (store.isSyncing) {
    return { processed: 0, failed: 0, remaining: store.queue.length };
  }

  // Check network connectivity first
  const netState = await NetInfo.fetch();
  if (netState.isConnected === false || netState.isInternetReachable === false) {
    return { processed: 0, failed: 0, remaining: store.queue.length };
  }

  const queue = await loadOfflineQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  store.setIsSyncing(true);
  let processed = 0;
  let failed = 0;
  const remainingMutations: QueuedMutation[] = [];

  try {
    for (const mutation of queue) {
      try {
        await apiClient.request({
          url: mutation.endpoint,
          method: mutation.method,
          data: mutation.payload,
          headers: {
            'X-Client-Mutation-Id': mutation.clientMutationId,
          },
        });

        processed++;
        // Invalidate matching query caches
        invalidateEntityQueries(mutation);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 409) {
          // Version Conflict handled specifically: notify user and refresh
          showToast('Updated on web — review', { type: 'warning' });
          invalidateEntityQueries(mutation);
          // 409 considered resolved from queue perspective as server has newer document
          processed++;
        } else if (status >= 400 && status < 500) {
          // Unrecoverable client error: rollback and drop mutation
          failed++;
          const errorMsg = err?.response?.data?.message || err?.message || 'Mutation failed';
          showToast(`Offline sync failed: ${errorMsg}`, { type: 'error' });
          invalidateEntityQueries(mutation);
        } else {
          // 5xx or Network loss during replay: keep mutation to retry later
          mutation.retryCount += 1;
          remainingMutations.push(mutation);
          break; // Stop further replay until network stabilizes
        }
      }
    }
  } finally {
    await saveOfflineQueue(remainingMutations);
    store.setIsSyncing(false);
    store.setLastSyncedAt(Date.now());

    if (processed > 0 && remainingMutations.length === 0) {
      showToast(`Synced ${processed} offline change${processed > 1 ? 's' : ''}`, {
        type: 'success',
      });
    }
  }

  return { processed, failed, remaining: remainingMutations.length };
}

function invalidateEntityQueries(mutation: QueuedMutation) {
  if (mutation.type === 'COMPLETE_TASK' || mutation.type === 'CREATE_TASK' || mutation.entityType === 'task') {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
  } else if (mutation.type === 'UPDATE_LEAD' || mutation.entityType === 'lead') {
    queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    if (mutation.entityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(mutation.entityId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
  } else if (mutation.type === 'MOVE_DEAL_STAGE' || mutation.entityType === 'deal') {
    queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
    if (mutation.entityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.detail(mutation.entityId) });
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() });
  } else if (mutation.type === 'ADD_NOTE') {
    if (mutation.entityType && mutation.entityId) {
      queryClient.invalidateQueries({ queryKey: ['activities', mutation.entityType, mutation.entityId] });
    }
  }
}

/**
 * Initializes network listener to auto-process queue on reconnect
 */
export function initOfflineQueueSync(): () => void {
  // Load initially
  loadOfflineQueue();

  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      processOfflineQueue().catch((err) => {
        console.warn('[OfflineQueue] Auto-sync error:', err);
      });
    }
  });

  return unsubscribe;
}
