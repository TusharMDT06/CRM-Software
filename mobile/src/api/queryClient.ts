import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 seconds stale time per spec 2.2
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60 * 24, // 24 hours offline cache retention
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'FLOWDESK_QUERY_OFFLINE_CACHE',
  throttleTime: 1000,
});
