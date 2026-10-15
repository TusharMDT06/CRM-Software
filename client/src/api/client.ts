import axios from 'axios';

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (!envUrl) {
    return '/api';
  }
  const cleanUrl = envUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Set of recent clientMutationIds to ignore self events
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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('flowdesk_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = config.method?.toLowerCase();
  if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
    let mutationId = config.headers['X-Client-Mutation-Id'] as string;
    if (!mutationId) {
      mutationId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      config.headers['X-Client-Mutation-Id'] = mutationId;
    }
    recordClientMutationId(mutationId);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('flowdesk_token');
      localStorage.removeItem('flowdesk_user');
      // If not already on login, dispatch custom event or allow AuthContext to handle
      window.dispatchEvent(new Event('flowdesk-unauthorized'));
    }
    const message =
      error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);
