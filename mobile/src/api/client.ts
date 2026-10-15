import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { showToast } from '../components/Toast';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api'
).replace(/\/+$/, '');

export const SOCKET_URL = (
  process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000'
).replace(/\/+$/, '');

// In-memory token cache for high-performance requests
let memoryToken: string | null = null;
let onAuthFailedCallback: (() => void) | null = null;

export function setMemoryToken(token: string | null) {
  memoryToken = token;
}

export function getMemoryToken(): string | null {
  return memoryToken;
}

export function registerAuthFailureHandler(callback: () => void) {
  onAuthFailedCallback = callback;
}

// Track recently generated mutation IDs to ignore local Socket.IO echoes
export const recentMutationIds = new Set<string>();

export function recordClientMutationId(id: string) {
  recentMutationIds.add(id);
  setTimeout(() => {
    recentMutationIds.delete(id);
  }, 60000);
}

export function isRecentMutationId(id?: string): boolean {
  if (!id) return false;
  return recentMutationIds.has(id);
}

function generateMutationId(): string {
  // RFC4122 version 4 compliant fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request Interceptor: Attach Token & X-Client-Mutation-Id
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 1. Resolve token from memory or SecureStore
    let token = memoryToken;
    if (!token) {
      try {
        token = await SecureStore.getItemAsync('flowdesk_auth_token');
        if (token) memoryToken = token;
      } catch {
        // SecureStore access fallback
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Attach idempotency header to every write operation
    const method = config.method?.toLowerCase();
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      let mutationId = config.headers['X-Client-Mutation-Id'] as string;
      if (!mutationId) {
        mutationId = generateMutationId();
        config.headers['X-Client-Mutation-Id'] = mutationId;
      }
      recordClientMutationId(mutationId);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Single-flight token refresh state
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

// Response Interceptor: Handle 401 with Single-Flight Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Avoid infinite retry loops on login or refresh endpoint itself
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('flowdesk_refresh_token');
        const tokenToUse = refreshToken || memoryToken;

        const refreshResponse = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            headers: {
              Authorization: `Bearer ${tokenToUse}`,
            },
          }
        );

        const newToken = refreshResponse.data.token;
        if (newToken) {
          memoryToken = newToken;
          await SecureStore.setItemAsync('flowdesk_auth_token', newToken);
          onRefreshed(newToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        // Refresh failed: clear session
        memoryToken = null;
        try {
          await SecureStore.deleteItemAsync('flowdesk_auth_token');
          await SecureStore.deleteItemAsync('flowdesk_refresh_token');
          await SecureStore.deleteItemAsync('flowdesk_user');
        } catch {}

        if (onAuthFailedCallback) {
          onAuthFailedCallback();
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 409 Version Conflict (spec 2.3)
    if (error.response?.status === 409) {
      const data = error.response.data as any;
      const latestDoc = data?.currentDocument;
      showToast('Updated on web — review', { type: 'warning' });

      const conflictError: any = new Error(data?.message || 'Updated on web — review');
      conflictError.status = 409;
      conflictError.isConflict = true;
      conflictError.currentDocument = latestDoc;
      return Promise.reject(conflictError);
    }

    // Standardize error message
    const message =
      (error.response?.data as any)?.message ||
      error.message ||
      'An unexpected network error occurred';
    return Promise.reject(new Error(message));
  }
);
